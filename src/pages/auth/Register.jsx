import { useState, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { signupUser } from '../../redux/features/authSlice';
import { Link, useNavigate } from 'react-router-dom';

const passwordRules = [
  { label: "At least 8 characters", test: v => v.length >= 8 },
  { label: "At least one uppercase letter", test: v => /[A-Z]/.test(v) },
  { label: "At least one lowercase letter", test: v => /[a-z]/.test(v) },
  { label: "At least one number", test: v => /\d/.test(v) },
  { label: "At least one symbol", test: v => /[^A-Za-z0-9]/.test(v) },
];

const Register = () => {
  const [form, setForm] = useState({
    name: '',
    gender: '',
    email: '',
    password: '',
    avatarFile: null,
  });
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const videoRef = useRef(null);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Password validation
  const passwordChecks = passwordRules.map(rule => rule.test(form.password));
  const passwordValid = passwordChecks.every(Boolean);

  // Camera logic
  const handleOpenCamera = async () => {
    setShowCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      alert('Unable to access camera');
    }
  };

  const handleCapture = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
    canvas.toBlob(blob => {
      const file = new File([blob], "selfie.png", { type: "image/png" });
      setForm(f => ({ ...f, avatarFile: file }));
      setAvatarPreview(URL.createObjectURL(blob));
      setShowCamera(false);
      cameraStream && cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }, 'image/png');
  };

  const handleFileChange = e => {
    const file = e.target.files[0];
    setForm(f => ({ ...f, avatarFile: file }));
    if (file) setAvatarPreview(URL.createObjectURL(file));
  };

  const handleChange = e => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!passwordValid) return;
    try {
      await dispatch(signupUser(form)).unwrap();
      alert('Registration successful! Please check your email to verify your account.');
      navigate('/login');
    } catch (err) {
      alert(err);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-8 p-4 bg-white rounded shadow">
      <h2 className="text-2xl font-bold mb-4">Register</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          name="name"
          type="text"
          placeholder="Full Name"
          value={form.name}
          onChange={handleChange}
          required
          className="w-full border p-2 rounded"
        />
        <select
          name="gender"
          value={form.gender}
          onChange={handleChange}
          required
          className="w-full border p-2 rounded"
        >
          <option value="">Select Gender</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </select>
        <input
          name="email"
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={handleChange}
          required
          className="w-full border p-2 rounded"
        />
        <input
          name="password"
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={e => { handleChange(e); setPasswordTouched(true); }}
          required
          className="w-full border p-2 rounded"
        />
        {passwordTouched && (
          <ul className="mb-2 text-sm">
            {passwordRules.map((rule, i) => (
              <li key={rule.label} className={passwordChecks[i] ? "text-green-600" : "text-red-600"}>
                {rule.label}
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center space-x-2">
          <input type="file" accept="image/*" onChange={handleFileChange} />
          <button type="button" onClick={handleOpenCamera} className="bg-blue-500 text-white px-2 py-1 rounded">Take Selfie</button>
        </div>
        {avatarPreview && (
          <div className="my-2">
            <img src={avatarPreview} alt="Preview" className="w-24 h-24 object-cover rounded-full border" />
          </div>
        )}
        {showCamera && (
          <div className="my-2">
            <video ref={videoRef} autoPlay className="w-full rounded" />
            <button type="button" onClick={handleCapture} className="bg-green-500 text-white px-2 py-1 rounded mt-2">Capture</button>
          </div>
        )}
        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded disabled:opacity-50"
          disabled={!passwordValid}
        >
          Register
        </button>
      </form>
      <div className="mt-4 text-center">
        <Link to="/login" className="text-blue-600 underline">Already have an account? Login</Link>
      </div>
    </div>
  );
};

export default Register;