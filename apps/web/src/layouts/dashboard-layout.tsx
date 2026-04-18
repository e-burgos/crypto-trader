import { Outlet } from 'react-router-dom';
import { SidebarContainer } from '../containers/sidebar-container';
import { DashboardHeader } from '../components/dashboard-header';

export function DashboardLayout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <SidebarContainer />
      <div className="flex flex-1 flex-col overflow-hidden">
        <DashboardHeader />
        <div className="flex-1 overflow-y-auto bg-background/50 backdrop-blur-[1px]">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
