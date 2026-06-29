import { Outlet } from 'react-router-dom';
import { SideNav } from './SideNav';
import { useNav } from '../engine/navContext';

export function AppLayout() {
  const { navItems, groups } = useNav();
  return (
    <div className="app-layout">
      <SideNav items={navItems} groups={groups} />
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  );
}
