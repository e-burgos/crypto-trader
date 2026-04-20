import { useRef, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { SidebarContainer } from '../containers/sidebar-container';
import { DashboardHeader } from '../containers/dashboard-header-container';

export function DashboardLayout() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [pathname]);

  return (
    <div className="flex h-screen overflow-hidden">
      <SidebarContainer />
      <div className="flex flex-1 flex-col overflow-hidden">
        <DashboardHeader />
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto bg-background/50 backdrop-blur-[1px]"
        >
          <Outlet />
        </div>
      </div>
    </div>
  );
}
