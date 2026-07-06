import { configureStore } from "@reduxjs/toolkit";

import interactionReducer from "../interaction/interactionState";
import encounterReducer from "./encounterSlice";

export const store = configureStore({
  reducer: {
    encounter: encounterReducer,
    interaction: interactionReducer
  }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
