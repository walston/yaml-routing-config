import * as Icons from 'lucide-react';
import type { ComponentType } from 'react';
import { NavLink } from 'react-router-dom';
import type { NavGroup, NavItem } from '../engine/types';

type IconComponent = ComponentType<{ size?: number; className?: string }>;

function NavEntry({ item }: { item: NavItem }) {
  const Icon = item.icon
    ? (Icons as unknown as Record<string, IconComponent>)[item.icon]
    : undefined;
  return (
    <NavLink
      to={item.path}
      className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
    >
      {Icon && <Icon size={16} />}
      <span>{item.title}</span>
    </NavLink>
  );
}

export function SideNav({ items, groups }: { items: NavItem[]; groups: NavGroup[] }) {
  const ungrouped = items.filter(i => !i.group && i.section !== 'bottom');
  const bottom    = items.filter(i => i.section === 'bottom');
  const groupMap  = new Map(groups.map(g => [g.id, g]));

  // Render groups in the order they appear in the groups array
  const usedGroups = groups.filter(g => items.some(i => i.group === g.id));

  return (
    <nav className="sidenav">
      <div className="sidenav-header">
        <span className="app-name">Studio</span>
      </div>

      <div className="sidenav-routes">
        {ungrouped.length > 0 && (
          <div className="sidenav-group">
            {ungrouped.map(item => <NavEntry key={item.path} item={item} />)}
          </div>
        )}
        {usedGroups.map(group => (
          <div key={group.id} className="sidenav-group">
            <span className="sidenav-group-label">{group.title}</span>
            {items
              .filter(i => i.group === group.id)
              .map(item => <NavEntry key={item.path} item={item} />)
            }
          </div>
        ))}
      </div>

      {bottom.length > 0 && (
        <div className="sidenav-bottom">
          {bottom.map(item => <NavEntry key={item.path} item={item} />)}
        </div>
      )}
    </nav>
  );
}
