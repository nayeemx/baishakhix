import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  sendEmailVerification,
  updateProfile,
} from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, setDoc, getDoc, getDocs, collection, updateDoc } from "firebase/firestore";
// Import auth, db, firestore from your config
import { auth, db, firestore } from "../../firebase/firebase.config";

// Get ImageBB API Key from environment variables (Assuming uploadImageToImageBB is defined or imported elsewhere)
const IMGBB_API_KEY = import.meta.env.VITE_IMGBB_API_KEY;
const IMGBB_UPLOAD_URL = "https://api.imgbb.com/1/upload";

// Helper function to validate if avatarUrl is a proper URL
const isValidAvatarUrl = (url) => {
  if (!url) return false;
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
};

// Helper function to get the best available avatar URL
const getBestAvatarUrl = (firebasePhotoURL, firestoreAvatarUrl) => {
  // Prefer Firestore avatarUrl if it's valid
  if (firestoreAvatarUrl && isValidAvatarUrl(firestoreAvatarUrl)) {
    return firestoreAvatarUrl;
  }
  // Fall back to Firebase photoURL if it's valid
  if (firebasePhotoURL && isValidAvatarUrl(firebasePhotoURL)) {
    return firebasePhotoURL;
  }
  // Return null if neither is valid
  return null;
};

// Helper function to upload image to ImageBB (Keep this here or import it)
const uploadImageToImageBB = async (imageFile, uid) => {
    if (!imageFile) { console.log("No avatar file provided for upload."); return null; }
    console.log("Uploading image to ImageBB...");
    const formData = new FormData();
    formData.append("key", IMGBB_API_KEY);
    formData.append("image", imageFile);
    formData.append("name", `baishakhi/avatar/${uid}_${Date.now()}`);
    try {
        const response = await fetch(IMGBB_UPLOAD_URL, { method: 'POST', body: formData, });
        if (!response.ok) { const errorText = await response.text(); console.error("ImageBB upload failed:", response.status, errorText); throw new Error(`Image upload failed: ${errorText}`); }
        const result = await response.json();
        if (result && result.data && result.data.url) { console.log("Image uploaded successfully. URL:", result.data.url); return result.data.url; }
        else { console.error("ImageBB upload result missing URL:", result); throw new Error("Image upload successful, but URL not found in response."); }
    } catch (error) { console.error("Error during ImageBB upload:", error); throw error; }
};

// --- Firestore Helper Functions ---

// Helper function to fetch user data from Firestore
const fetchUserDataFromFirestore = async (uid) => {
  try {
    const userDoc = await getDoc(doc(firestore, "users", uid));
    if (userDoc.exists()) {
      return userDoc.data();
    } else {
      console.error("Firestore user entry not found for UID:", uid);
      return null;
    }
  } catch (error) {
    console.error("Error fetching Firestore data for UID:", uid, error);
    throw error; // Re-throw to be caught by the caller
  }
};

// --- End Firestore Helper Functions ---


// Initial state
const initialState = {
  user: null, // Will include role from RTDB and other user data
  loading: false, // Keep loading state for initial auth check + RTDB fetch
  error: null,
  authLoading: true, // add this
  firstUserCheckDone: false, // Local flag for optimization within session
};

let firstUserChecked = false; // Only check for first user once per session

// Signup thunk - Uses Firestore for initial entry
export const signupUser = createAsyncThunk(
  "auth/signupUser",
  async ({ name, gender, email, password, avatarFile }, thunkAPI) => {
    try {
      // Register user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      // Wait for authentication state to be ready
      await new Promise(resolve => {
        const unsubscribe = auth.onAuthStateChanged(user => {
          if (user && user.uid === firebaseUser.uid) {
            unsubscribe();
            resolve();
          }
        });
      });

      // Force refresh token so Firestore sees the authenticated user
      await firebaseUser.getIdToken(true);

      let avatarUrl = null;
      if (avatarFile) {
        try {
          avatarUrl = await uploadImageToImageBB(avatarFile, firebaseUser.uid);
        } catch (uploadError) {
          avatarUrl = null;
        }
      }

      await updateProfile(firebaseUser, { displayName: name, photoURL: avatarUrl });
      await sendEmailVerification(firebaseUser);

      // Store user in Firestore with status unverified and role user
      const userDocRef = doc(firestore, "users", firebaseUser.uid);
      await setDoc(userDocRef, {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        name,
        gender,
        role: "user",
        status: "unverified",
        avatarUrl,
        createdAt: new Date().toISOString(),
      });

      return {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        name,
        gender,
        role: "user",
        status: "unverified",
        avatarUrl,
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      return thunkAPI.rejectWithValue(error.message);
    }
  }
);

// Login thunk - Performs Auth login, checks verification, FETCHES Firestore data
export const loginUser = createAsyncThunk(
  "auth/loginUser",
  async ({ email, password }, thunkAPI) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      if (!firebaseUser.emailVerified) {
        await signOut(auth);
        throw new Error("Please verify your email before logging in.");
      }

      // Fetch user data from Firestore
      const userDocRef = doc(firestore, "users", firebaseUser.uid);
      let userDataFromFirestore = (await getDoc(userDocRef)).data();

      // If status is not verified, update it
      if (userDataFromFirestore.status !== "verified") {
        // Check if this is the first verified user
        const usersSnapshot = await getDocs(collection(firestore, "users"));
        const verifiedSuperUsers = usersSnapshot.docs.filter(doc => doc.data().role === "super_user" && doc.data().status === "verified");
        let newRole = userDataFromFirestore.role;
        if (verifiedSuperUsers.length === 0) {
          newRole = "super_user";
        }
        await updateDoc(userDocRef, { status: "verified", role: newRole });
        userDataFromFirestore = { ...userDataFromFirestore, status: "verified", role: newRole };
      }

      const mergedUserData = {
        ...userDataFromFirestore,
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        name: firebaseUser.displayName || userDataFromFirestore.name,
        photoURL: getBestAvatarUrl(firebaseUser.photoURL, userDataFromFirestore.avatarUrl),
        emailVerified: firebaseUser.emailVerified,
      };

      return mergedUserData;
    } catch (error) {
      let customMessage = "An unknown error occurred during login. Please try again.";
      return thunkAPI.rejectWithValue(customMessage);
    }
  }
);

// Google login thunk - Performs Auth login, FETCHES Firestore data
export const googleLogin = createAsyncThunk(
  "auth/googleLogin",
  async (_, thunkAPI) => {
    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      const firebaseUser = userCredential.user;

      let role = "user";
      if (!firstUserChecked) {
        const usersSnapshot = await getDocs(collection(firestore, "users"));
        if (usersSnapshot.empty) {
          role = "super_user";
        }
        firstUserChecked = true;
        sessionStorage.setItem("firstUserChecked", "true");
      }

      // Check if user exists in Firestore
      const userDocRef = doc(firestore, "users", firebaseUser.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        await setDoc(userDocRef, {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          name: firebaseUser.displayName,
          role,
          avatarUrl: firebaseUser.photoURL,
          createdAt: new Date().toISOString(),
        });
      } else {
        // If user exists, use their stored role
        const data = userDoc.data();
        role = data.role || "user";
      }

      const mergedUserData = {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        name: firebaseUser.displayName,
        emailVerified: firebaseUser.emailVerified,
        avatarUrl: getBestAvatarUrl(firebaseUser.photoURL, userDoc.exists() ? userDoc.data().avatarUrl : null),
        role,
      };

      return mergedUserData;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.message);
    }
  }
);

// Reset password thunk (No Change)
export const resetPassword = createAsyncThunk(
  "auth/resetPassword",
  async (email, thunkAPI) => {
    try { console.log("Attempting password reset for email:", email); await sendPasswordResetEmail(auth, email); console.log("Password reset email sent successfully (if email exists)."); return true;
    } catch (error) {
       console.error("Reset password thunk caught an error:", error); const errorCode = error.code; let customMessage = "An error occurred while sending the reset link.";
       switch (errorCode) { case 'auth/user-not-found': customMessage = "No user found with that email address."; break; case 'auth/invalid-email': customMessage = "Please enter a valid email address."; break; default: customMessage = error.message; }
       console.log("Rejecting reset password thunk with message:", customMessage); return thunkAPI.rejectWithValue(customMessage);
    }
  }
);

// Logout thunk (No Change)
export const logoutUser = createAsyncThunk(
  "auth/logoutUser",
  async (_, thunkAPI) => {
    try { console.log("Attempting user logout..."); await signOut(auth); console.log("User logged out successfully."); return null; }
    catch (error) { console.error("Logout thunk caught an error:", error); return thunkAPI.rejectWithValue(error.message); }
  }
);

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setUser(state, action) {
      console.log("Dispatching setUser:", action.payload); state.user = action.payload; 
      if(action.payload !== null) { state.firstUserCheckDone = true; console.log("Redux state: user set, firstUserCheckDone set to true."); }
      else { state.firstUserCheckDone = false; console.log("Redux state: user set to null, firstUserCheckDone reset to false."); }
    },
    clearError(state) { state.error = null; },
    setAuthLoading(state, action) { state.authLoading = action.payload; },
    resetFirstUserCheckDone(state) { state.firstUserCheckDone = false; console.log("Redux state: firstUserCheckDone manually reset to false."); }
  },
  extraReducers: (builder) => {
    builder
      .addCase(signupUser.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(signupUser.fulfilled, (state, action) => {
        state.loading = false;
        state.error = null;
        state.user = action.payload;
      })
      .addCase(signupUser.rejected, (state, action) => { state.loading = false; state.error = action.payload; state.user = null; })

      .addCase(loginUser.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(loginUser.fulfilled, (state, action) => { state.loading = false; state.error = null; state.user = action.payload; })
      .addCase(loginUser.rejected, (state, action) => { state.loading = false; state.user = null; state.error = action.payload; })

      .addCase(googleLogin.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(googleLogin.fulfilled, (state, action) => { state.loading = false; state.error = null; state.user = action.payload; })
      .addCase(googleLogin.rejected, (state, action) => { state.loading = false; state.error = action.payload; state.user = null; })

      .addCase(resetPassword.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(resetPassword.fulfilled, (state) => { state.loading = false; state.error = null; })
      .addCase(resetPassword.rejected, (state, action) => { state.loading = false; state.error = action.payload; })

      .addCase(logoutUser.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(logoutUser.fulfilled, (state) => { state.loading = false; state.user = null; state.error = null; })
      .addCase(logoutUser.rejected, (state, action) => { state.loading = false; state.error = action.payload; });
  },
});

export const { setUser, clearError, setAuthLoading, resetFirstUserCheckDone } = authSlice.actions;
export default authSlice.reducer;