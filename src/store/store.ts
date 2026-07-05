import { configureStore } from "@reduxjs/toolkit";

import encounterReducer from "./encounterSlice";

export const store = configureStore({
  reducer: {
    encounter: encounterReducer
  }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
