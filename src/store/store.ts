import { configureStore } from "@reduxjs/toolkit";

import interactionReducer from "../interaction/interactionState";
import encounterReducer from "./encounterSlice";
import libraryReducer from "../library/librarySlice";

export const store = configureStore({
  reducer: {
    encounter: encounterReducer,
    interaction: interactionReducer,
    library: libraryReducer
  }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
