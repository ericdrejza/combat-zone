import { createContext, useContext } from 'react';

/** Popout presentation stays local to its view and outside encounter history. */
export const StatusDashboardContext = createContext(false);

export function useStatusDashboard() { return useContext(StatusDashboardContext); }
