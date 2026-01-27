import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface SaasAdminRouteProps {
  children: React.ReactNode;
  minRole?: 'super_admin' | 'admin' | 'support' | 'viewer';
}

const roleHierarchy: Record<string, number> = {
  super_admin: 4,
  admin: 3,
  support: 2,
  viewer: 1,
};

export function SaasAdminRoute({ children, minRole = 'viewer' }: SaasAdminRouteProps) {
  const { user, isLoading, isSaasAdmin } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!isSaasAdmin()) {
    return <Navigate to="/app" replace />;
  }

  // Check role hierarchy
  const userLevel = roleHierarchy[user.saas_role || 'viewer'] || 0;
  const requiredLevel = roleHierarchy[minRole] || 0;

  if (userLevel < requiredLevel) {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
}
