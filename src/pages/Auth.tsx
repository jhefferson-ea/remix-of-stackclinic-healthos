import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Loader2, Mail, Lock, User, ArrowLeft, Shield, Building2, Gift, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth, User as AuthUser } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/services/api';

export default function Auth() {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showAdminChoice, setShowAdminChoice] = useState(false);
  
  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Register form
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [referralStatus, setReferralStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [referrerName, setReferrerName] = useState('');
  
  const { login, register, hasActiveSubscription } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  
  const from = location.state?.from?.pathname || '/app';

  const handleRedirect = (user: AuthUser) => {
    // Check if user is SaaS admin - show choice dialog
    if (user.is_saas_admin) {
      setShowAdminChoice(true);
      return;
    }
    
    // Check if needs onboarding
    if (hasActiveSubscription() && !user.onboarding_completed) {
      navigate('/onboarding', { replace: true });
      return;
    }
    
    // Check subscription status
    if (user.subscription_status === 'pending' || user.subscription_status === 'suspended') {
      navigate('/pricing', { replace: true });
      return;
    }
    
    navigate(from, { replace: true });
  };

  const handleAdminChoice = (destination: 'admin' | 'clinic') => {
    setShowAdminChoice(false);
    if (destination === 'admin') {
      navigate('/admin', { replace: true });
    } else {
      navigate('/app', { replace: true });
    }
  };

  // Debounced referral code validation
  const validateReferralCode = useCallback(async (code: string) => {
    if (!code || code.length < 4) {
      setReferralStatus('idle');
      setReferrerName('');
      return;
    }
    
    setReferralStatus('checking');
    const res = await api.validateReferralCode(code);
    
    if (res.success && res.data?.valid) {
      setReferralStatus('valid');
      setReferrerName(res.data.referrer_name || '');
    } else {
      setReferralStatus('invalid');
      setReferrerName('');
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (referralCode) {
        validateReferralCode(referralCode);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [referralCode, validateReferralCode]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!loginEmail || !loginPassword) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha email e senha',
        variant: 'destructive',
      });
      return;
    }
    
    setIsLoading(true);
    
    const result = await login(loginEmail, loginPassword);
    
    if (result.success && result.user) {
      toast({
        title: 'Bem-vindo!',
        description: 'Login realizado com sucesso',
      });
      handleRedirect(result.user);
    } else {
      toast({
        title: 'Erro no login',
        description: result.error || 'Credenciais inválidas',
        variant: 'destructive',
      });
    }
    
    setIsLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!registerName || !registerEmail || !registerPassword) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha todos os campos',
        variant: 'destructive',
      });
      return;
    }
    
    if (registerPassword.length < 6) {
      toast({
        title: 'Senha fraca',
        description: 'A senha deve ter pelo menos 6 caracteres',
        variant: 'destructive',
      });
      return;
    }

    // Block registration if referral code is entered but invalid
    if (referralCode && referralStatus === 'invalid') {
      toast({
        title: 'Código inválido',
        description: 'Verifique o código de indicação ou deixe o campo vazio',
        variant: 'destructive',
      });
      return;
    }
    
    setIsLoading(true);
    
    const result = await register(
      registerName, 
      registerEmail, 
      registerPassword,
      referralStatus === 'valid' ? referralCode : undefined
    );
    
    if (result.success) {
      toast({
        title: 'Conta criada!',
        description: 'Bem-vindo ao StackClinic',
      });
      navigate('/app', { replace: true });
    } else {
      toast({
        title: 'Erro no cadastro',
        description: result.error || 'Erro ao criar conta',
        variant: 'destructive',
      });
    }
    
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Image */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-primary via-primary/90 to-primary/80">
        <div className="absolute inset-0 opacity-50" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />
        <div className="relative z-10 flex flex-col justify-center items-center p-12 text-primary-foreground">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-md text-center"
          >
            <div className="h-16 w-16 rounded-2xl bg-primary-foreground/20 backdrop-blur-sm flex items-center justify-center mb-8 mx-auto">
              <span className="text-3xl font-bold">SC</span>
            </div>
            <h1 className="text-3xl font-bold mb-4">StackClinic</h1>
            <p className="text-lg text-primary-foreground/80 mb-8">
              A plataforma completa para gestão inteligente da sua clínica. 
              Automatize agendamentos, gerencie pacientes e aumente sua produtividade.
            </p>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-primary-foreground/10 backdrop-blur-sm rounded-lg p-4">
                <p className="text-2xl font-bold">200+</p>
                <p className="text-sm text-primary-foreground/70">Clínicas</p>
              </div>
              <div className="bg-primary-foreground/10 backdrop-blur-sm rounded-lg p-4">
                <p className="text-2xl font-bold">30%</p>
                <p className="text-sm text-primary-foreground/70">Menos Faltas</p>
              </div>
              <div className="bg-primary-foreground/10 backdrop-blur-sm rounded-lg p-4">
                <p className="text-2xl font-bold">24/7</p>
                <p className="text-sm text-primary-foreground/70">Atendimento</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="flex-1 flex flex-col justify-center items-center p-8 bg-background">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {/* Back to landing */}
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao início
          </Link>

          {/* Logo for mobile */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="h-10 w-10 rounded-lg gradient-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold">SC</span>
            </div>
            <span className="font-semibold text-xl text-foreground">StackClinic</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground">
              {activeTab === 'login' ? 'Bem-vindo de volta!' : 'Crie sua conta'}
            </h2>
            <p className="text-muted-foreground mt-1">
              {activeTab === 'login'
                ? 'Entre para acessar sua clínica'
                : 'Comece seu teste grátis de 14 dias'}
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'login' | 'register')}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Criar Conta</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder="seu@email.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="pl-10"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Senha
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="pl-10 pr-10"
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-end">
                  <a href="#" className="text-sm text-primary hover:underline">
                    Esqueceu a senha?
                  </a>
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Entrando...
                    </>
                  ) : (
                    'Acessar Sistema'
                  )}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Nome Completo
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Dr. João Silva"
                      value={registerName}
                      onChange={(e) => setRegisterName(e.target.value)}
                      className="pl-10"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder="seu@email.com"
                      value={registerEmail}
                      onChange={(e) => setRegisterEmail(e.target.value)}
                      className="pl-10"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Senha
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Mínimo 6 caracteres"
                      value={registerPassword}
                      onChange={(e) => setRegisterPassword(e.target.value)}
                      className="pl-10 pr-10"
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Código de Indicação <span className="text-muted-foreground font-normal">(opcional)</span>
                  </label>
                  <div className="relative">
                    <Gift className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Ex: STACK1A2B3C"
                      value={referralCode}
                      onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                      className="pl-10 pr-10"
                      disabled={isLoading}
                    />
                    {referralStatus === 'checking' && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                    {referralStatus === 'valid' && (
                      <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-success" />
                    )}
                    {referralStatus === 'invalid' && (
                      <XCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive" />
                    )}
                  </div>
                  {referralStatus === 'valid' && referrerName && (
                    <p className="text-xs text-success mt-1">
                      ✓ Indicado por {referrerName}
                    </p>
                  )}
                  {referralStatus === 'invalid' && (
                    <p className="text-xs text-destructive mt-1">
                      Código de indicação inválido
                    </p>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Criando conta...
                    </>
                  ) : (
                    'Criar Conta'
                  )}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  Ao criar uma conta, você concorda com nossos{' '}
                  <a href="#" className="text-primary hover:underline">
                    Termos de Uso
                  </a>{' '}
                  e{' '}
                  <a href="#" className="text-primary hover:underline">
                    Política de Privacidade
                  </a>
                </p>
              </form>
            </TabsContent>
          </Tabs>

          {/* Demo credentials */}
          <div className="mt-8 p-4 rounded-lg bg-muted/50 border border-border">
            <p className="text-xs text-muted-foreground text-center mb-2">
              <strong>Credenciais de teste:</strong>
            </p>
            <p className="text-xs text-muted-foreground text-center">
              admin@stackclinic.com.br / password
            </p>
          </div>
        </motion.div>
      </div>

      {/* Admin Choice Dialog */}
      <Dialog open={showAdminChoice} onOpenChange={setShowAdminChoice}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Escolha seu destino
            </DialogTitle>
            <DialogDescription>
              Você é administrador do SaaS. Para onde deseja ir?
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <Button
              variant="outline"
              className="h-auto py-6 flex flex-col gap-2"
              onClick={() => handleAdminChoice('admin')}
            >
              <Shield className="h-8 w-8 text-violet-500" />
              <span className="font-semibold">Painel Admin</span>
              <span className="text-xs text-muted-foreground">Gerenciar SaaS</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-6 flex flex-col gap-2"
              onClick={() => handleAdminChoice('clinic')}
            >
              <Building2 className="h-8 w-8 text-primary" />
              <span className="font-semibold">Dashboard Clínica</span>
              <span className="text-xs text-muted-foreground">Acessar clínica</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
