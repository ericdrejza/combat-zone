import { configureStore } from "@reduxjs/toolkit";

import interactionReducer from "@interaction/interactionState";
import encounterReducer from "./encounterSlice";
import encounterLogReducer from "./encounterLogSlice";
import { encounterLogMiddleware } from "./encounterLogMiddleware";
import libraryReducer from "@library/librarySlice";
import { persistenceWriteGuardMiddleware } from "./persistenceWriteGuardMiddleware";

export const store = configureStore({
  reducer: {
    encounter: encounterReducer,
    encounterLog: encounterLogReducer,
    interaction: interactionReducer,
    library: libraryReducer
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(
      persistenceWriteGuardMiddleware,
      encounterLogMiddleware
    )
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
