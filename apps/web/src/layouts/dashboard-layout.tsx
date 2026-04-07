import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/ui/sidebar';
import { DashboardHeader } from '../components/dashboard-header';

export function DashboardLayout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <DashboardHeader />
        <div className="flex-1 overflow-y-auto bg-background/50 backdrop-blur-[1px]">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
