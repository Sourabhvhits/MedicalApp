import { combineReducers } from '@reduxjs/toolkit';
import userReducer from './userReducer/reducer';

const rootReducer = combineReducers({
  userReducer,
});

export default rootReducer;
