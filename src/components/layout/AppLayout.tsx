import { useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Calendar,
  ClipboardList,
  Users,
  Bot,
  DollarSign,
  Megaphone,
  FolderOpen,
  Gift,
  Settings,
  Menu,
  X,
  ChevronDown,
  LogOut,
  User,
  MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { GlobalSearch } from './GlobalSearch';
import { NotificationsPopover } from './NotificationsPopover';
import { ProfileModal } from './ProfileModal';

const allNavigation = [
  { name: 'Dashboard', href: '/app', icon: LayoutDashboard, permissions: [] },
  { name: 'Agenda', href: '/app/agenda', icon: Calendar, permissions: [] },
  { name: 'Procedimentos', href: '/app/procedimentos', icon: ClipboardList, permissions: [] },
  { name: 'Pacientes', href: '/app/pacientes', icon: Users, permissions: [] },
  { name: 'Central IA', href: '/app/ia-config', icon: Bot, permissions: [] },
  { name: 'WhatsApp', href: '/app/whatsapp', icon: MessageSquare, permissions: ['view_config'] },
  { name: 'Financeiro', href: '/app/financeiro', icon: DollarSign, permissions: ['view_financial'] },
  { name: 'Marketing', href: '/app/marketing', icon: Megaphone, permissions: ['view_marketing'] },
  { name: 'Biblioteca', href: '/app/biblioteca', icon: FolderOpen, permissions: [] },
  { name: 'Parceiros', href: '/app/parceiros', icon: Gift, permissions: [] },
  { name: 'Configurações', href: '/app/config', icon: Settings, permissions: ['view_config'] },
];

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, hasPermission } = useAuth();

  // Filter navigation based on user permissions
  const navigation = allNavigation.filter((item) => {
    if (item.permissions.length === 0) return true;
    return item.permissions.some((perm) => hasPermission(perm as 'view_financial' | 'view_marketing' | 'view_config' | 'view_team' | 'view_patients_full' | 'manage_appointments' | 'manage_team'));
  });

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  const getRoleLabel = (role?: string) => {
    const labels: Record<string, string> = {
      owner: 'Proprietário',
      doctor: 'Médico',
      secretary: 'Secretária',
    };
    return labels[role || ''] || role || 'Usuário';
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-sidebar transform transition-transform duration-300 ease-in-out lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between px-6 border-b border-sidebar-border">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">SC</span>
              </div>
              <span className="text-sidebar-foreground font-semibold text-lg">StackClinic</span>
            </div>
            <button
              className="lg:hidden text-sidebar-foreground/70 hover:text-sidebar-foreground"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              // Exact match for /app (Dashboard), startsWith for other routes
              const isActive = item.href === '/app' 
                ? location.pathname === '/app'
                : location.pathname.startsWith(item.href);
              
              return (
                <NavLink
                  key={item.name}
                  to={item.href}
                  className={cn('sidebar-item', isActive && 'active')}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon className="h-5 w-5" />
                  <span>{item.name}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-sidebar-border">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex w-full items-center gap-3 rounded-lg p-2 hover:bg-sidebar-accent transition-colors">
                  <div className="h-9 w-9 rounded-full bg-sidebar-primary/20 flex items-center justify-center">
                    <User className="h-5 w-5 text-sidebar-primary" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-sidebar-foreground truncate">
                      {user?.name || 'Usuário'}
                    </p>
                    <p className="text-xs text-sidebar-foreground/60">
                      {getRoleLabel(user?.role)}
                    </p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-sidebar-foreground/60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => setShowProfileModal(true)}>
                  <User className="mr-2 h-4 w-4" />
                  Meu Perfil
                </DropdownMenuItem>
                {hasPermission('view_config') && (
                  <DropdownMenuItem onClick={() => navigate('/app/config')}>
                    <Settings className="mr-2 h-4 w-4" />
                    Configurações
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 h-16 bg-background/80 backdrop-blur-md border-b border-border">
          <div className="flex h-full items-center justify-between px-4 lg:px-6">
            <div className="flex items-center gap-4">
              <button
                className="lg:hidden text-muted-foreground hover:text-foreground"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-6 w-6" />
              </button>
              
              <GlobalSearch />
            </div>

            <div className="flex items-center gap-3">
              <NotificationsPopover />
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6">
          <Outlet />
        </main>
      </div>

      {/* Profile Modal */}
      <ProfileModal open={showProfileModal} onOpenChange={setShowProfileModal} />
    </div>
  );
}
