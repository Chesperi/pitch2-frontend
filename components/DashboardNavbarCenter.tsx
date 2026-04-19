"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type NavbarCenterApi = {
  centerContent: ReactNode;
  setCenter: (node: ReactNode | null) => void;
};

const NavbarCenterContext = createContext<NavbarCenterApi | null>(null);

export function DashboardNavbarCenterProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [centerContent, setCenterContent] = useState<ReactNode>(null);
  const setCenter = useCallback((node: ReactNode | null) => {
    setCenterContent(node);
  }, []);

  const api = useMemo(
    (): NavbarCenterApi => ({ centerContent, setCenter }),
    [centerContent, setCenter]
  );

  return (
    <NavbarCenterContext.Provider value={api}>
      {children}
    </NavbarCenterContext.Provider>
  );
}

export function useDashboardNavbarCenter(): NavbarCenterApi {
  const ctx = useContext(NavbarCenterContext);
  if (!ctx) {
    throw new Error(
      "useDashboardNavbarCenter must be used within DashboardNavbarCenterProvider"
    );
  }
  return ctx;
}
