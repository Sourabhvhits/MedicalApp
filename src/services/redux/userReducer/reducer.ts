import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { AuthProfile, AuthTokens, UserReducerState } from './interface';

const initialState: UserReducerState = {
  user: null,
  token: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: false,
};

const userSlice = createSlice({
  name: 'userReducer',
  initialState,
  reducers: {
    loginSuccess: (
      state,
      action: PayloadAction<{ user: AuthProfile; tokens: AuthTokens }>,
    ) => {
      state.user = action.payload.user;
      state.token = action.payload.tokens.accessToken;
      state.refreshToken = action.payload.tokens.refreshToken;
      state.isAuthenticated = true;
      state.isLoading = false;
    },
    updateTokens: (state, action: PayloadAction<AuthTokens>) => {
      state.token = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
    },
    updateUserProfile: (state, action: PayloadAction<AuthProfile>) => {
      state.user = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
      state.isLoading = false;
    },
  },
});

export const { loginSuccess, updateTokens, updateUserProfile, setLoading, logout } =
  userSlice.actions;

export default userSlice.reducer;
