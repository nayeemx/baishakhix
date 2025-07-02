import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  items: [], // { ...product, quantity }
};

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addToCart: (state, action) => {
      const payloadBarcode = String(action.payload.barcode).trim();
      const found = state.items.find(item => String(item.barcode).trim() === payloadBarcode);
      if (found) {
        found.quantity += action.payload.quantity || 1;
      } else {
        state.items.push({ ...action.payload, quantity: action.payload.quantity || 1 });
      }
    },
    removeFromCart: (state, action) => {
      const payloadBarcode = String(action.payload).trim();
      state.items = state.items.filter(item => String(item.barcode).trim() !== payloadBarcode);
    },
    updateQty: (state, action) => {
      const { barcode, quantity } = action.payload;
      const found = state.items.find(item => String(item.barcode).trim() === String(barcode).trim());
      if (found) {
        found.quantity = Math.max(1, quantity);
      }
    },
    clearCart: (state) => {
      state.items = [];
    },
  },
});

export const { addToCart, removeFromCart, updateQty, clearCart } = cartSlice.actions;
export default cartSlice.reducer;
