import { createSlice } from "@reduxjs/toolkit";

import { createEncounterState } from "../core/encounter/createEncounterState";

const initialState = createEncounterState({
  id: "active-encounter",
  name: "Untitled Encounter"
});

const encounterSlice = createSlice({
  name: "encounter",
  initialState,
  reducers: {}
});

export default encounterSlice.reducer;
