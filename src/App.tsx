import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SaasAdminRoute } from "@/components/SaasAdminRoute";
import { AppLayout } from "@/components/layout/AppLayout";

// Public Pages
import Landing from "@/pages/Landing";
import Auth from "@/pages/Auth";
import Pricing from "@/pages/Pricing";
import Onboarding from "@/pages/Onboarding";

// App Pages
import Dashboard from "@/pages/app/Dashboard";
import Agenda from "@/pages/app/Agenda";
import Procedures from "@/pages/app/Procedures";
import Patients from "@/pages/app/Patients";
import PatientDetail from "@/pages/app/PatientDetail";
import IaConfig from "@/pages/app/IaConfig";
import Financial from "@/pages/app/Financial";
import Marketing from "@/pages/app/Marketing";
import Library from "@/pages/app/Library";
import Partners from "@/pages/app/Partners";
import Config from "@/pages/app/Config";
import WhatsAppConfig from "@/pages/app/WhatsAppConfig";
import NotFound from "@/pages/NotFound";

// Admin Pages
import AdminLayout from "@/pages/admin/AdminLayout";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminClinics from "@/pages/admin/AdminClinics";
import AdminSubscriptions from "@/pages/admin/AdminSubscriptions";
import AdminTeam from "@/pages/admin/AdminTeam";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/onboarding" element={
              <ProtectedRoute>
                <Onboarding />
              </ProtectedRoute>
            } />
            
            {/* SaaS Admin Routes */}
            <Route path="/admin" element={
              <SaasAdminRoute>
                <AdminLayout />
              </SaasAdminRoute>
            }>
              <Route index element={<AdminDashboard />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="clinics" element={<AdminClinics />} />
              <Route path="subscriptions" element={<AdminSubscriptions />} />
              <Route path="team" element={
                <SaasAdminRoute minRole="super_admin">
                  <AdminTeam />
                </SaasAdminRoute>
              } />
            </Route>
            
            {/* Protected App Routes */}
            <Route path="/app" element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }>
              <Route index element={<Dashboard />} />
              <Route path="agenda" element={<Agenda />} />
              <Route path="procedimentos" element={<Procedures />} />
              <Route path="pacientes" element={<Patients />} />
              <Route path="pacientes/:id" element={<PatientDetail />} />
              <Route path="ia-config" element={<IaConfig />} />
              <Route path="financeiro" element={<Financial />} />
              <Route path="marketing" element={<Marketing />} />
              <Route path="biblioteca" element={<Library />} />
              <Route path="parceiros" element={<Partners />} />
              <Route path="config" element={<Config />} />
              <Route path="whatsapp" element={<WhatsAppConfig />} />
            </Route>

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
