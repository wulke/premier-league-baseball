// @spec CALWUI-009,RSSUI-006
import React, { createContext, useContext } from 'react';

type SimulateBusyContextValue = {
  simulateBusy: boolean;
  setSimulateBusy: (busy: boolean) => void;
};

const SimulateBusyContext = createContext<SimulateBusyContextValue | null>(null);

// @spec CALWUI-009,RSSUI-006 — lets the home CTA and NavRail rapid control preserve their
// existing in-flight cross-lock even though they render in different shell branches.
const useSimulateBusy = (): SimulateBusyContextValue => {
  const context = useContext(SimulateBusyContext);
  if (context == null) return { simulateBusy: false, setSimulateBusy: () => {} };
  return context;
};

export { SimulateBusyContext, useSimulateBusy };
