// StackClinic API Service Layer
// Conexão com backend PHP + MariaDB na Hostinger

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://stackclinic.stacklabz.io/api';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

class ApiService {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    
    // Check if body is FormData - if so, don't set Content-Type (browser will set it with boundary)
    const isFormData = options.body instanceof FormData;
    
    const defaultHeaders: HeadersInit = isFormData
      ? { 'Accept': 'application/json' }
      : { 'Content-Type': 'application/json', 'Accept': 'application/json' };

    const token = localStorage.getItem('stackclinic_token');
    if (token) {
      defaultHeaders['Authorization'] = `Bearer ${token}`;
      // Fallback header para servidores que removem Authorization
      defaultHeaders['X-Auth-Token'] = token;
    }

    try {
      // Debug (frontend): ajuda a identificar se está batendo no backend correto
      // (ex.: se estiver indo para ngrok/Evolution por engano)
      console.debug('[API] Request', {
        url,
        method: options.method || 'GET',
        hasBody: Boolean(options.body),
      });

      const response = await fetch(url, {
        ...options,
        headers: {
          ...defaultHeaders,
          ...options.headers,
        },
      });

      const contentType = response.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');
      const payloadText = await response.text();

      // Se vier HTML (ex.: ngrok warning) ou algo não-JSON, mostramos isso para debug
      if (!isJson) {
        console.warn('[API] Non-JSON response', {
          url,
          status: response.status,
          contentType,
          preview: payloadText.slice(0, 300),
        });
        return {
          success: false,
          error: `Resposta inválida do servidor (status ${response.status}).`,
        };
      }

      const jsonResponse = JSON.parse(payloadText);

      if (!response.ok || jsonResponse.success === false) {
        return {
          success: false,
          error: jsonResponse.error || jsonResponse.message || `Erro ${response.status}`,
        };
      }

      return {
        success: true,
        data: jsonResponse.data,
        message: jsonResponse.message,
      };
    } catch (error) {
      console.error('API Error:', error);
      return {
        success: false,
        error: 'Erro de conexão com o servidor',
      };
    }
  }

  // ==================== GENERIC METHODS ====================
  async get<T = unknown>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T = unknown>(endpoint: string, data?: Record<string, unknown>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T = unknown>(endpoint: string, data?: Record<string, unknown>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T = unknown>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  // ==================== AUTH ====================
  async login(email: string, password: string) {
    return this.request<{ 
      token: string; 
      user: { 
        id: number; 
        name: string; 
        email: string; 
        role: string; 
        avatar?: string; 
        clinic_name?: string;
        clinic_id?: number;
        subscription_status?: string;
        onboarding_completed?: boolean;
        is_saas_admin?: boolean;
        saas_role?: string;
      } 
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async register(name: string, email: string, password: string, referralCode?: string) {
    return this.request<{ 
      token: string; 
      user: { 
        id: number; 
        name: string; 
        email: string; 
        role: string; 
        avatar?: string; 
        clinic_name?: string;
        clinic_id?: number;
        subscription_status?: string;
        onboarding_completed?: boolean;
        is_saas_admin?: boolean;
        saas_role?: string;
      } 
    }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, referral_code: referralCode }),
    });
  }

  async validateReferralCode(code: string) {
    return this.request<{ valid: boolean; referrer_name?: string }>(`/partners/validate-code/?code=${encodeURIComponent(code)}`);
  }

  async updateProfile(data: { name?: string; phone?: string; password?: string }) {
    return this.request<{ user: { id: number; name: string; email: string; role: string; phone?: string; avatar?: string } }>('/auth/update-profile', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ==================== TEAM ====================
  async getTeamMembers() {
    return this.request<{ id: number; name: string; email: string; role: string; avatar?: string; phone?: string; active: boolean; status?: string; created_at: string }[]>('/team/');
  }

  async inviteTeamMember(data: { name: string; email: string; role: string }) {
    return this.request<{ id: number; name: string; email: string; role: string; temp_password?: string; active: boolean }>('/team/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTeamMember(id: number, data: { action: string; role?: string; active?: boolean }) {
    return this.request<{ updated: boolean; temp_password?: string }>('/team/update/', {
      method: 'PUT',
      body: JSON.stringify({ id, ...data }),
    });
  }

  async deleteTeamMember(id: number) {
    return this.request<{ deleted: boolean }>('/team/delete/', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
    });
  }

  // ==================== PATIENTS (Extended) ====================
  async createPatient(data: { name: string; phone: string; cpf?: string; email?: string }) {
    return this.request<{ id: number; name: string; phone: string }>('/patients/create', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ==================== APPOINTMENTS (Extended) ====================
  async blockTimeSlot(data: { title: string; days: number[]; start_time: string; end_time: string; recurring: boolean; specific_date?: string }) {
    return this.request<{ id: number }[]>('/appointments/block', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteBlock(id: number) {
    return this.request<{ deleted: boolean }>(`/appointments/block?id=${id}`, {
      method: 'DELETE',
    });
  }

  // ==================== CUSTOM TRIGGERS (AI) ====================
  async getCustomTriggers() {
    return this.request<CustomTrigger[]>('/ai/custom-triggers');
  }

  async saveCustomTrigger(data: Omit<CustomTrigger, 'created_at'>) {
    return this.request<CustomTrigger>('/ai/custom-triggers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteCustomTrigger(id: number) {
    return this.request<{ deleted: boolean }>(`/ai/custom-triggers?id=${id}`, {
      method: 'DELETE',
    });
  }

  // ==================== ANAMNESE ====================
  async getAnamneseQuestions() {
    return this.request<{ enabled: boolean; questions: { id: number; question: string; type: 'text' | 'yes_no' | 'options' | 'photo'; options?: string[]; is_alert: boolean; order: number }[] }>('/config/anamnese');
  }

  async saveAnamneseQuestions(data: { enabled: boolean; questions: { id: number; question: string; type: string; options?: string[]; is_alert: boolean; order: number }[] }) {
    return this.request<{ success: boolean }>('/config/anamnese', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ==================== DASHBOARD ====================
  async getDashboardSummary() {
    return this.request<DashboardSummary>('/dashboard/summary');
  }

  async getSmartFeed() {
    return this.request<SmartFeedItem[]>('/dashboard/smart-feed');
  }

  async getHumorChart() {
    return this.request<HumorData>('/dashboard/humor');
  }

  // ==================== AGENDA ====================
  async getAppointments(date?: string) {
    const query = date ? `?date=${date}` : '';
    return this.request<Appointment[]>(`/appointments/${query}`);
  }

  async createAppointment(data: CreateAppointmentData) {
    return this.request<Appointment>('/appointments/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateAppointment(id: number, data: Partial<Appointment>) {
    return this.request<Appointment>(`/appointments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getAppointmentConversation(appointmentId: number) {
    return this.request<{
      messages: Array<{ direction: string; message: string; created_at: string }>;
      has_conversation: boolean;
      message?: string;
    }>(`/appointments/${appointmentId}/conversation`);
  }

  async approveAiSlot(suggestionId: number) {
    return this.request<{ success: boolean }>('/ai/approve-slot', {
      method: 'POST',
      body: JSON.stringify({ suggestion_id: suggestionId }),
    });
  }

  async rejectAiSlot(suggestionId: number) {
    return this.request<{ success: boolean }>('/ai/reject-slot', {
      method: 'POST',
      body: JSON.stringify({ suggestion_id: suggestionId }),
    });
  }

  async getWaitingList() {
    return this.request<WaitingListPatient[]>('/appointments/waiting-list');
  }

  async notifyWaitingList() {
    return this.request<{ notified: number }>('/appointments/notify-waiting-list', {
      method: 'POST',
    });
  }

  async getAiSuggestions() {
    return this.request<AiSuggestion[]>('/ai/suggestions');
  }

  // ==================== PACIENTES ====================
  async getPatients(search?: string) {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    return this.request<Patient[]>(`/patients/${query}`);
  }

  // ==================== PATIENT GROUPS ====================
  async getPatientGroups() {
    return this.request<PatientGroup[]>('/patients/groups/');
  }

  async getPatientGroup(id: number) {
    return this.request<PatientGroupDetail>(`/patients/groups/?id=${id}`);
  }

  async createPatientGroup(data: { name: string; description?: string }) {
    return this.request<PatientGroup>('/patients/groups/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePatientGroup(id: number, data: { name: string; description?: string }) {
    return this.request<PatientGroup>('/patients/groups/', {
      method: 'PUT',
      body: JSON.stringify({ id, ...data }),
    });
  }

  async deletePatientGroup(id: number) {
    return this.request<{ deleted: boolean }>(`/patients/groups/?id=${id}`, {
      method: 'DELETE',
    });
  }

  async addPatientsToGroup(groupId: number, patientIds: number[]) {
    return this.request<{ added: number }>('/patients/groups/members/', {
      method: 'POST',
      body: JSON.stringify({ group_id: groupId, patient_ids: patientIds }),
    });
  }

  async removePatientsFromGroup(groupId: number, patientIds: number[]) {
    return this.request<{ removed: number }>('/patients/groups/members/', {
      method: 'DELETE',
      body: JSON.stringify({ group_id: groupId, patient_ids: patientIds }),
    });
  }

  async getPatientDetail(id: number) {
    return this.request<PatientDetail>(`/patients/${id}/`);
  }

  async getPatientTimeline(id: number) {
    return this.request<TimelineEvent[]>(`/patients/${id}/timeline/`);
  }

  async getPatientAnamnesis(id: number) {
    return this.request<Anamnesis>(`/patients/${id}/anamnesis/`);
  }

  async startTranscription(patientId: number) {
    return this.request<{ session_id: string }>(`/patients/${patientId}/transcription/start/`, {
      method: 'POST',
    });
  }

  async generateAiSummary(patientId: number, sessionId: string) {
    return this.request<{ summary: string }>(`/patients/${patientId}/transcription/summary/`, {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId }),
    });
  }

  async getPatientGallery(id: number) {
    return this.request<GalleryImage[]>(`/patients/${id}/gallery/`);
  }

  async generateDocument(patientId: number, type: 'atestado' | 'receita', data: DocumentData) {
    return this.request<{ pdf_url: string }>(`/patients/${patientId}/documents/generate/`, {
      method: 'POST',
      body: JSON.stringify({ type, ...data }),
    });
  }

  // ==================== IA CONFIG ====================
  async getAiConfig() {
    return this.request<AiConfig>('/ai/config');
  }

  async updateAiConfig(config: Partial<AiConfig>) {
    return this.request<AiConfig>('/ai/config', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  async getLiveChats() {
    return this.request<LiveChat[]>('/ai/live-chats');
  }

  async takeOverChat(chatId: string) {
    return this.request<{ success: boolean }>(`/ai/live-chats/${chatId}/takeover`, {
      method: 'POST',
    });
  }

  // ==================== FINANCEIRO ====================
  async getFinancialSummary() {
    return this.request<FinancialSummary>('/finance/summary');
  }

  async getCashFlow(period: 'week' | 'month' | 'year') {
    return this.request<CashFlowData[]>(`/finance/cash-flow?period=${period}`);
  }

  async processOcr(imageBase64: string) {
    return this.request<OcrResult>('/finance/ocr', {
      method: 'POST',
      body: JSON.stringify({ image: imageBase64 }),
    });
  }

  async getReceipts() {
    return this.request<Receipt[]>('/finance/receipts');
  }

  async generateTissDocument(receiptIds: number[]) {
    return this.request<{ pdf_url: string }>('/finance/generate-tiss', {
      method: 'POST',
      body: JSON.stringify({ receipt_ids: receiptIds }),
    });
  }

  // ==================== MARKETING ====================
  async getMarketingStats() {
    return this.request<MarketingStats>('/marketing/stats');
  }

  async getInactivePatients() {
    return this.request<InactivePatient[]>('/marketing/inactive-patients');
  }

  async sendCampaign(patientIds: number[], message: string) {
    return this.request<{ sent: number }>('/marketing/send', {
      method: 'POST',
      body: JSON.stringify({ patient_ids: patientIds, message }),
    });
  }

  async updateReviewConfig(config: ReviewConfig) {
    return this.request<ReviewConfig>('/marketing/review-config', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  // ==================== BIBLIOTECA ====================
  async getLibraryFiles() {
    return this.request<LibraryFile[]>('/library/files');
  }

  async uploadFile(file: File, category: string) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);
    
    return this.request<LibraryFile>('/library/upload', {
      method: 'POST',
      body: formData,
    });
  }

  async getShortcuts() {
    return this.request<Shortcut[]>('/library/shortcuts');
  }

  async saveShortcut(shortcut: Shortcut) {
    return this.request<Shortcut>('/library/shortcuts', {
      method: 'POST',
      body: JSON.stringify(shortcut),
    });
  }

  // ==================== PROCEDURES ====================
  async getProcedures() {
    return this.request<Procedure[]>('/procedures/');
  }

  async createProcedure(data: { name: string; price: number; duration: number }) {
    return this.request<Procedure>('/procedures/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProcedure(id: number, data: { name?: string; price?: number; duration?: number }) {
    return this.request<Procedure>('/procedures/update', {
      method: 'PUT',
      body: JSON.stringify({ id, ...data }),
    });
  }

  async deleteProcedure(id: number) {
    return this.request<{ deleted: boolean }>(`/procedures/update?id=${id}`, {
      method: 'DELETE',
    });
  }

  async deleteAppointment(id: number) {
    return this.request<{ deleted: boolean }>(`/appointments/${id}`, {
      method: 'DELETE',
    });
  }

  // ==================== PROCEDURE PAYMENTS ====================
  async getProcedurePayments(filters?: { date?: string; status?: string; period?: string }) {
    const params = new URLSearchParams(filters as Record<string, string>).toString();
    return this.request<ProcedurePayment[]>(`/finance/procedure-payments/?${params}`);
  }

  async updatePaymentStatus(id: number, status: 'a_receber' | 'pendente' | 'pago') {
    return this.request<ProcedurePayment>('/finance/procedure-payments/', {
      method: 'PUT',
      body: JSON.stringify({ id, status }),
    });
  }

  // ==================== PARCEIROS ====================
  async getPartnerProgram() {
    return this.request<PartnerProgram>('/partners/program/');
  }

  async getReferralCode() {
    return this.request<{ code: string }>('/partners/referral-code/');
  }

  async getPartnerStats() {
    return this.request<PartnerStats>('/partners/stats/');
  }

  // ==================== CONFIGURAÇÕES ====================
  async getClinicConfig() {
    return this.request<ClinicConfig>('/config/clinic/');
  }

  async updateClinicConfig(config: Partial<ClinicConfig>) {
    return this.request<ClinicConfig>('/config/clinic/', {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  }

  // ==================== WHATSAPP ====================
  async getWhatsAppConfig(includeQr?: boolean) {
    const qs = includeQr ? '?include_qr=1' : '';
    return this.request<WhatsAppConfig>(`/config/whatsapp/${qs}`);
  }

  async connectWhatsApp(payload?: { phone?: string }) {
    return this.request<WhatsAppConfig>('/config/whatsapp/', {
      method: 'POST',
      body: payload ? JSON.stringify(payload) : undefined,
    });
  }

  async disconnectWhatsApp() {
    return this.request<{ disconnected: boolean }>('/config/whatsapp/', {
      method: 'DELETE',
    });
  }

  async updateWhatsAppConfig(config: { ai_name?: string; ai_tone?: string; system_prompt_custom?: string }) {
    return this.request<{ updated: boolean }>('/config/whatsapp/', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  // ==================== CHAT SIMULATOR ====================
  async simulateChat(data: { message: string; session_phone?: string }) {
    return this.request<{
      response: string;
      session_phone: string;
      patient: { id: number; name: string; phone: string; is_lead: number };
      tokens_used: number;
      error?: string;
      function_calls?: Array<{ function: string; arguments: Record<string, unknown>; result: Record<string, unknown> }>;
      appointment_created?: { date: string; time: string; procedure?: string };
    }>('/ai/simulate-chat', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async clearSimulatorSession(sessionPhone: string) {
    return this.request<{ cleared: boolean }>('/ai/simulate-chat', {
      method: 'DELETE',
      body: JSON.stringify({ session_phone: sessionPhone }),
    });
  }

  async uploadLogo(file: File) {
    const formData = new FormData();
    formData.append('logo', file);
    
    return this.request<{ logo_url: string }>('/config/upload-logo.php', {
      method: 'POST',
      body: formData,
    });
  }

  // ==================== SUBSCRIPTION ====================
  async getSubscriptionStatus() {
    return this.request<{ 
      status: string; 
      plan?: string; 
      trial_ends_at?: string;
      current_period_end?: string;
      onboarding_completed?: boolean;
    }>('/subscription/status');
  }

  async getSubscriptionPlans() {
    return this.request<SubscriptionPlan[]>('/subscription/plans');
  }

  async subscribe(planId: string) {
    return this.request<{ 
      success: boolean; 
      subscription_status: string;
    }>('/subscription/subscribe', {
      method: 'POST',
      body: JSON.stringify({ plan_id: planId }),
    });
  }

  // ==================== ONBOARDING ====================
  async completeOnboarding(data: {
    category?: string;
    name: string;
    cnpj?: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    zip_code: string;
  }) {
    return this.request<{ 
      success: boolean; 
      clinic: ClinicConfig;
    }>('/onboarding/complete/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ==================== ADMIN (SaaS) ====================
  async getAdminDashboard() {
    return this.request<AdminDashboard>('/admin/dashboard');
  }

  async getAdminUsers() {
    return this.request<AdminUser[]>('/admin/users');
  }

  async getAdminClinics() {
    return this.request<AdminClinic[]>('/admin/clinics');
  }

  async updateAdminClinic(id: number, data: { subscription_status?: string; plan?: string }) {
    return this.request<{ success: boolean }>('/admin/clinics', {
      method: 'PUT',
      body: JSON.stringify({ id, ...data }),
    });
  }

  async getAdminSubscriptions() {
    return this.request<AdminSubscription[]>('/admin/subscriptions');
  }

  async updateAdminSubscription(id: number, data: { status?: string; plan?: string }) {
    return this.request<{ success: boolean }>('/admin/subscriptions', {
      method: 'PUT',
      body: JSON.stringify({ id, ...data }),
    });
  }

  async getSaasTeam() {
    return this.request<SaasTeamMember[]>('/admin/saas-team');
  }

  async addSaasTeamMember(data: { user_id: number; saas_role: string }) {
    return this.request<{ success: boolean }>('/admin/saas-team', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async removeSaasTeamMember(userId: number) {
    return this.request<{ success: boolean }>(`/admin/saas-team?user_id=${userId}`, {
      method: 'DELETE',
    });
  }
}

// ==================== TYPES ====================
export interface DashboardSummary {
  faturamento: {
    hoje: number;
    mes: number;
    variacao: number;
  };
  agendamentos: {
    realizados: number;
    pendentes: number;
    total: number;
  };
  novosPacientes: {
    total: number;
    crescimento: number;
  };
}

export interface SmartFeedItem {
  id: number;
  type: 'alert' | 'birthday' | 'reminder' | 'opportunity' | 'success';
  title: string;
  description: string;
  action?: string;
  priority: 'low' | 'medium' | 'high';
  created_at: string;
}

export interface HumorData {
  google_reviews: number;
  internal_rating: number;
  average: number;
  total_reviews: number;
}

export interface Appointment {
  id: number;
  patient_id: number;
  patient_name: string;
  patient_phone: string;
  date: string;
  time: string;
  duration: number;
  status: 'confirmed' | 'pending' | 'cancelled';
  procedure: string;
  notes?: string;
}

export interface CreateAppointmentData {
  patient_id: number;
  date: string;
  time: string;
  duration: number;
  procedure: string;
  procedimento_id?: number;
  notes?: string;
}

export interface Procedure {
  id: number;
  name: string;
  price: number;
  duration: number;
  active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface WaitingListPatient {
  id: number;
  name: string;
  phone: string;
  preferred_time: string;
  added_at: string;
}

export interface AiSuggestion {
  id: number;
  type: 'reschedule' | 'optimize' | 'emergency';
  description: string;
  affected_appointments: number[];
  suggested_action: string;
}

export interface Patient {
  id: number;
  name: string;
  phone: string;
  email: string;
  avatar?: string;
  convenio?: string;
  last_visit?: string;
}

export interface PatientDetail extends Patient {
  birth_date: string;
  address: string;
  cpf: string;
  created_at: string;
  total_appointments: number;
  total_spent: number;
}

export interface TimelineEvent {
  id: number;
  type: 'appointment' | 'payment' | 'file' | 'note';
  title: string;
  description: string;
  date: string;
  metadata?: Record<string, unknown>;
}

export interface Anamnesis {
  patient_id: number;
  questions: AnamnesisQuestion[];
  alerts: AnamnesisAlert[];
  updated_at: string;
}

export interface AnamnesisQuestion {
  id: number;
  question: string;
  answer: string;
  category: string;
}

export interface AnamnesisAlert {
  id: number;
  type: 'allergy' | 'condition' | 'medication';
  description: string;
  severity: 'low' | 'medium' | 'high';
}

export interface GalleryImage {
  id: number;
  url: string;
  type: 'before' | 'after';
  date: string;
  description?: string;
}

export interface DocumentData {
  content: string;
  cid?: string;
  days?: number;
}

export interface AiConfig {
  personality: 'nutri' | 'dentista' | 'psico';
  reminder_24h: boolean;
  request_confirmation: boolean;
  auto_cancel: boolean;
  auto_cancel_hours: number;
}

export interface WhatsAppConfig {
  connected: boolean;
  phone?: string;
  instance_id?: string;
  state?: string;
  ai_name?: string;
  ai_tone?: string;
  system_prompt_custom?: string;
  qrcode?: string;
  pairingCode?: string;
  pending?: boolean;
  message?: string;
}

export interface LiveChat {
  id: string;
  patient_name: string;
  patient_phone: string;
  last_message: string;
  status: 'bot' | 'human';
  unread: number;
  updated_at: string;
}

export interface FinancialSummary {
  total_revenue: number;
  total_expenses: number;
  balance: number;
  pending_payments: number;
}

export interface CashFlowData {
  date: string;
  entradas: number;
  saidas: number;
}

export interface OcrResult {
  valor: number;
  categoria: string;
  descricao: string;
  data: string;
  confidence: number;
}

export interface Receipt {
  id: number;
  patient_name: string;
  procedure: string;
  value: number;
  date: string;
  status: 'pending' | 'processed' | 'submitted';
}

export interface ProcedurePayment {
  id: number;
  agendamento_id: number;
  patient_id: number;
  patient_name: string;
  procedure_name: string;
  amount: number;
  status: 'a_receber' | 'pendente' | 'pago';
  date: string;
  time: string;
  payment_date?: string;
}

export interface MarketingStats {
  inactive_6months: number;
  pending_reviews: number;
  campaigns_sent: number;
  response_rate: number;
}

export interface InactivePatient {
  id: number;
  name: string;
  phone: string;
  last_visit: string;
  total_spent: number;
}

export interface ReviewConfig {
  auto_request: boolean;
  min_rating: number;
  delay_hours: number;
}

export interface LibraryFile {
  id: number;
  name: string;
  url: string;
  type: string;
  category: string;
  created_at: string;
}

export interface Shortcut {
  id?: number;
  command: string;
  file_id: number;
  file_name: string;
}

export interface PartnerProgram {
  current_referrals: number;
  target_referrals: number;
  total_savings: number;
  next_milestone: string;
}

export interface PartnerStats {
  total_referrals: number;
  active_referrals: number;
  total_commission: number;
}

export interface ClinicConfig {
  name: string;
  cnpj: string;
  phone: string;
  email: string;
  address: string;
  logo_url?: string;
  working_hours: WorkingHours[];
}

export interface WorkingHours {
  day: number;
  open: string;
  close: string;
  active: boolean;
}

export interface CustomTrigger {
  id?: number;
  name: string;
  message: string;
  trigger_type: 'recurring' | 'one_time' | 'event_based';
  interval_hours: number;
  target_type: 'all' | 'specific_patient' | 'patient_group';
  target_value?: string;
  enabled: boolean;
  created_at?: string;
}

export interface PatientGroup {
  id: number;
  name: string;
  description?: string;
  member_count: number;
  created_at?: string;
}

export interface PatientGroupDetail extends PatientGroup {
  members: { id: number; name: string; phone: string; email: string }[];
}

// ==================== SUBSCRIPTION & ADMIN TYPES ====================
export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  features: string[];
  popular?: boolean;
}

export interface AdminDashboard {
  total_clinics: number;
  active_subscriptions: number;
  trial_subscriptions: number;
  total_users: number;
  mrr: number;
  new_clinics_this_month: number;
}

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: string;
  clinic_id?: number;
  clinic_name?: string;
  subscription_status?: string;
  created_at: string;
}

export interface AdminClinic {
  id: number;
  name: string;
  owner_name?: string;
  owner_email?: string;
  subscription_status: string;
  plan?: string;
  onboarding_completed: boolean;
  created_at: string;
}

export interface AdminSubscription {
  id: number;
  clinic_id: number;
  clinic_name: string;
  status: string;
  plan: string;
  trial_ends_at?: string;
  current_period_end?: string;
  created_at: string;
}

export interface SaasTeamMember {
  id: number;
  user_id: number;
  user_name: string;
  user_email: string;
  saas_role: string;
  created_at: string;
}

// Export singleton instance
export const api = new ApiService(API_BASE_URL);
