import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/authSlice';
import themeReducer from '../features/themeSlice'; // add this line

const store = configureStore({
  reducer: {
    auth: authReducer,
    theme: themeReducer, // add this line
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export default store;