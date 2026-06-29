import { createContext, useContext } from 'react';
import type { NavGroup, NavItem } from './types';

export type NavContextValue = {
  navItems: NavItem[];
  groups: NavGroup[];
};

const empty: NavContextValue = { navItems: [], groups: [] };

export const NavContext = createContext<NavContextValue>(empty);
export const useNav = () => useContext(NavContext);
