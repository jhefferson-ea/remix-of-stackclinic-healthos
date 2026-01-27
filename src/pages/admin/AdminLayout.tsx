import { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  Building2,
  CreditCard,
  UserCog,
  LogOut,
  ChevronLeft,
  Menu,
  Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

const adminNavItems = [
  { path: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { path: '/admin/users', label: 'Usuários', icon: Users },
  { path: '/admin/clinics', label: 'Clínicas', icon: Building2 },
  { path: '/admin/subscriptions', label: 'Assinaturas', icon: CreditCard },
  { path: '/admin/team', label: 'Equipe SaaS', icon: UserCog },
];

export default function AdminLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  const isActive = (path: string, exact?: boolean) => {
    if (exact) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen flex bg-slate-950">
      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarCollapsed ? 80 : 280 }}
        className="fixed left-0 top-0 h-screen border-r border-slate-800 bg-slate-900 z-50 flex flex-col"
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <div>
                <span className="font-bold text-white">StackClinic</span>
                <p className="text-xs text-slate-400">Admin Panel</p>
              </div>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="text-slate-400 hover:text-white hover:bg-slate-800"
          >
            {sidebarCollapsed ? <Menu className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {adminNavItems.map((item) => {
            const active = isActive(item.path, item.exact);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
                  active
                    ? 'bg-violet-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                )}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {!sidebarCollapsed && <span className="font-medium">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-slate-800">
          {/* Go to Clinic Dashboard */}
          <Link
            to="/app"
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 mb-2',
              'text-slate-400 hover:text-white hover:bg-slate-800'
            )}
          >
            <Building2 className="h-5 w-5 flex-shrink-0" />
            {!sidebarCollapsed && <span className="font-medium text-sm">Ir para Clínica</span>}
          </Link>

          {/* User info */}
          <div className={cn(
            'flex items-center gap-3 px-3 py-2',
            sidebarCollapsed && 'justify-center'
          )}>
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-violet-600 text-white text-sm">
                {user?.name?.charAt(0) || 'A'}
              </AvatarFallback>
            </Avatar>
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{user?.name}</p>
                <p className="text-xs text-slate-400 truncate capitalize">{user?.saas_role?.replace('_', ' ')}</p>
              </div>
            )}
          </div>

          {/* Logout */}
          <Button
            variant="ghost"
            onClick={handleLogout}
            className={cn(
              'w-full mt-2 text-slate-400 hover:text-white hover:bg-slate-800',
              sidebarCollapsed ? 'justify-center px-0' : 'justify-start'
            )}
          >
            <LogOut className="h-5 w-5" />
            {!sidebarCollapsed && <span className="ml-3">Sair</span>}
          </Button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main
        className={cn(
          'flex-1 transition-all duration-300',
          sidebarCollapsed ? 'ml-20' : 'ml-[280px]'
        )}
      >
        <div className="min-h-screen bg-slate-950 text-white">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
