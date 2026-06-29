import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { buildApp } from './engine/buildApp';
import { NavContext } from './engine/navContext';
import './index.css';

const { router, navItems, groups } = buildApp();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <NavContext.Provider value={{ navItems, groups }}>
      <RouterProvider router={router} />
    </NavContext.Provider>
  </StrictMode>
);
