import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '@/services/api';

export type UserRole = 'owner' | 'doctor' | 'secretary';
export type SaasRole = 'super_admin' | 'admin' | 'support' | 'viewer';
export type SubscriptionStatus = 'pending' | 'active' | 'suspended' | 'trial';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  clinic_id?: number;
  clinic_name?: string;
  subscription_status?: SubscriptionStatus;
  onboarding_completed?: boolean;
  is_saas_admin?: boolean;
  saas_role?: SaasRole;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; user?: User }>;
  register: (name: string, email: string, password: string, referralCode?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  hasPermission: (permission: Permission) => boolean;
  hasActiveSubscription: () => boolean;
  needsOnboarding: () => boolean;
  needsSubscription: () => boolean;
  isSaasAdmin: () => boolean;
  updateUserData: (data: Partial<User>) => void;
  refreshSubscriptionStatus: () => Promise<void>;
}

type Permission = 
  | 'view_financial'
  | 'view_marketing'
  | 'view_config'
  | 'view_team'
  | 'view_patients_full'
  | 'manage_appointments'
  | 'manage_team';

const rolePermissions: Record<UserRole, Permission[]> = {
  owner: [
    'view_financial',
    'view_marketing',
    'view_config',
    'view_team',
    'view_patients_full',
    'manage_appointments',
    'manage_team',
  ],
  doctor: [
    'view_patients_full',
    'manage_appointments',
  ],
  secretary: [
    'manage_appointments',
  ],
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    const token = localStorage.getItem('stackclinic_token');
    const userData = localStorage.getItem('stackclinic_user');
    
    if (token && userData) {
      try {
        const parsedUser = JSON.parse(userData);
        // Use the role as stored - it's already mapped during login
        const role = parsedUser.role;
        const isFrontendRole = ['owner', 'doctor', 'secretary'].includes(role);
        const finalRole = isFrontendRole ? role : mapBackendRole(role);
        setUser({ ...parsedUser, role: finalRole });
      } catch {
        localStorage.removeItem('stackclinic_token');
        localStorage.removeItem('stackclinic_user');
      }
    }
    setIsLoading(false);
  }

  function mapBackendRole(backendRole: string): UserRole {
    const roleMap: Record<string, UserRole> = {
      'admin': 'owner',
      'doctor': 'doctor',
      'assistant': 'secretary',
    };
    return roleMap[backendRole] || 'doctor';
  }

  async function login(email: string, password: string) {
    try {
      const res = await api.login(email, password);
      
      if (res.success && res.data) {
        const { token, user: userData } = res.data;
        const mappedRole = mapBackendRole(userData.role);
        const userWithMappedRole: User = { 
          ...userData, 
          role: mappedRole,
          subscription_status: userData.subscription_status as SubscriptionStatus,
          onboarding_completed: userData.onboarding_completed,
          is_saas_admin: userData.is_saas_admin,
          saas_role: userData.saas_role as SaasRole
        };
        
        localStorage.setItem('stackclinic_token', token);
        localStorage.setItem('stackclinic_user', JSON.stringify(userWithMappedRole));
        setUser(userWithMappedRole);
        
        return { success: true, user: userWithMappedRole };
      }
      
      return { success: false, error: res.error || 'Credenciais inválidas' };
    } catch {
      return { success: false, error: 'Erro de conexão' };
    }
  }

  async function register(name: string, email: string, password: string, referralCode?: string) {
    try {
      const res = await api.register(name, email, password, referralCode);
      
      if (res.success && res.data) {
        const { token, user: userData } = res.data;
        const mappedRole = mapBackendRole(userData.role);
        const userWithMappedRole: User = { 
          ...userData, 
          role: mappedRole,
          subscription_status: userData.subscription_status as SubscriptionStatus,
          onboarding_completed: userData.onboarding_completed,
          is_saas_admin: userData.is_saas_admin,
          saas_role: userData.saas_role as SaasRole
        };
        
        localStorage.setItem('stackclinic_token', token);
        localStorage.setItem('stackclinic_user', JSON.stringify(userWithMappedRole));
        setUser(userWithMappedRole);
        
        return { success: true };
      }
      
      return { success: false, error: res.error || 'Erro ao criar conta' };
    } catch {
      return { success: false, error: 'Erro de conexão' };
    }
  }

  function logout() {
    localStorage.removeItem('stackclinic_token');
    localStorage.removeItem('stackclinic_user');
    setUser(null);
  }

  function hasPermission(permission: Permission): boolean {
    if (!user) return false;
    return rolePermissions[user.role]?.includes(permission) || false;
  }

  function hasActiveSubscription(): boolean {
    if (!user) return false;
    // SaaS admins always have access
    if (user.is_saas_admin) return true;
    return user.subscription_status === 'active' || user.subscription_status === 'trial';
  }

  function needsOnboarding(): boolean {
    if (!user) return false;
    // SaaS admins don't need onboarding
    if (user.is_saas_admin) return false;
    // User needs onboarding if has active subscription but hasn't completed onboarding
    // "Active" means 'active' or 'trial' status
    const isActive = user.subscription_status === 'active' || user.subscription_status === 'trial';
    return isActive && !user.onboarding_completed;
  }

  function needsSubscription(): boolean {
    if (!user) return false;
    if (user.is_saas_admin) return false;
    return user.subscription_status === 'pending';
  }

  function isSaasAdmin(): boolean {
    return user?.is_saas_admin || false;
  }

  function updateUserData(data: Partial<User>) {
    if (!user) return;
    const updatedUser = { ...user, ...data };
    setUser(updatedUser);
    localStorage.setItem('stackclinic_user', JSON.stringify(updatedUser));
  }

  async function refreshSubscriptionStatus() {
    try {
      const res = await api.getSubscriptionStatus();
      if (res.success && res.data && user) {
        const status = res.data.status === 'active' || res.data.status === 'trial' 
          ? 'active' 
          : res.data.status as SubscriptionStatus;
        updateUserData({
          subscription_status: status,
          onboarding_completed: res.data.onboarding_completed
        });
      }
    } catch (e) {
      console.error('Failed to refresh subscription status', e);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        hasPermission,
        hasActiveSubscription,
        needsOnboarding,
        needsSubscription,
        isSaasAdmin,
        updateUserData,
        refreshSubscriptionStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
