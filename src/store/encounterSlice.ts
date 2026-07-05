import { createSlice } from "@reduxjs/toolkit";

export type EncounterBootstrapState = {
  schemaVersion: 1;
  activeEncounterId: string | null;
};

const initialState: EncounterBootstrapState = {
  schemaVersion: 1,
  activeEncounterId: null
};

const encounterSlice = createSlice({
  name: "encounter",
  initialState,
  reducers: {}
});

export default encounterSlice.reducer;
