import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Building2, Mail, Phone, MapPin, Check, 
  ArrowRight, ArrowLeft, Loader2, Sparkles, Stethoscope 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/api';
import { useToast } from '@/hooks/use-toast';

const steps = [
  { id: 1, title: 'Especialidade', icon: Stethoscope },
  { id: 2, title: 'Dados da Clínica', icon: Building2 },
  { id: 3, title: 'Contato', icon: Phone },
  { id: 4, title: 'Endereço', icon: MapPin },
  { id: 5, title: 'Finalizar', icon: Check },
];

const categories = [
  { value: 'dentista', label: 'Odontologia', emoji: '🦷' },
  { value: 'nutricionista', label: 'Nutrição', emoji: '🥗' },
  { value: 'psicologo', label: 'Psicologia', emoji: '🧠' },
  { value: 'dermatologista', label: 'Dermatologia', emoji: '✨' },
  { value: 'fisioterapeuta', label: 'Fisioterapia', emoji: '💪' },
  { value: 'esteticista', label: 'Estética', emoji: '💆' },
  { value: 'pediatra', label: 'Pediatria', emoji: '👶' },
  { value: 'oftalmologista', label: 'Oftalmologia', emoji: '👁️' },
  { value: 'cardiologista', label: 'Cardiologia', emoji: '❤️' },
  { value: 'outro', label: 'Outro', emoji: '🏥' },
];

export default function Onboarding() {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    category: '',
    clinic_name: '',
    cnpj: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
  });
  
  const { user, updateUserData } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return formData.category !== '';
      case 2:
        return formData.clinic_name.trim().length >= 3;
      case 3:
        return formData.email.includes('@') && formData.phone.length >= 10;
      case 4:
        return formData.address.trim().length >= 10;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (currentStep < 5) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    
    try {
      const res = await api.completeOnboarding({
        category: formData.category,
        name: formData.clinic_name,
        cnpj: formData.cnpj,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        zip_code: formData.zip_code,
      });
      
      if (res.success) {
        toast({
          title: 'Configuração Concluída! 🎉',
          description: 'Sua clínica está pronta para uso.',
        });
        
        updateUserData({ 
          onboarding_completed: true,
          clinic_name: formData.clinic_name 
        });
        
        navigate('/app');
      } else {
        toast({
          title: 'Erro',
          description: res.error || 'Não foi possível salvar os dados',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Erro',
        description: 'Erro de conexão. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <div className="hidden lg:flex w-80 bg-sidebar p-8 flex-col">
        <div className="flex items-center gap-2 mb-12">
          <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">SC</span>
          </div>
          <span className="text-sidebar-foreground font-semibold text-lg">StackClinic</span>
        </div>

        <div className="space-y-4">
          {steps.map((step) => {
            const isActive = step.id === currentStep;
            const isCompleted = step.id < currentStep;
            
            return (
              <div 
                key={step.id}
                className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                  isActive 
                    ? 'bg-sidebar-accent text-sidebar-foreground' 
                    : isCompleted 
                      ? 'text-sidebar-primary' 
                      : 'text-sidebar-foreground/50'
                }`}
              >
                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  isActive 
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground' 
                    : isCompleted 
                      ? 'bg-sidebar-primary/20 text-sidebar-primary'
                      : 'bg-sidebar-accent text-sidebar-foreground/50'
                }`}>
                  {isCompleted ? <Check className="h-4 w-4" /> : step.id}
                </div>
                <span className="font-medium">{step.title}</span>
              </div>
            );
          })}
        </div>

        <div className="mt-auto">
          <p className="text-sidebar-foreground/60 text-sm">
            Olá, {user?.name?.split(' ')[0]}! Configure sua clínica para começar.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-lg">
          {/* Mobile Steps */}
          <div className="lg:hidden flex justify-center gap-2 mb-8">
            {steps.map((step) => (
              <div 
                key={step.id}
                className={`h-2 w-8 rounded-full transition-colors ${
                  step.id <= currentStep ? 'bg-primary' : 'bg-muted'
                }`}
              />
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {currentStep === 1 && (
                <div>
                  <h2 className="text-2xl font-bold text-foreground mb-2">
                    Qual é a especialidade da sua clínica?
                  </h2>
                  <p className="text-muted-foreground mb-8">
                    Selecione a categoria principal de atendimento
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    {categories.map((cat) => (
                      <button
                        key={cat.value}
                        type="button"
                        onClick={() => updateField('category', cat.value)}
                        className={`p-4 rounded-lg border-2 text-left transition-all hover:border-primary/50 ${
                          formData.category === cat.value
                            ? 'border-primary bg-primary/5'
                            : 'border-border'
                        }`}
                      >
                        <span className="text-2xl mb-2 block">{cat.emoji}</span>
                        <span className="font-medium">{cat.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div>
                  <h2 className="text-2xl font-bold text-foreground mb-2">
                    Dados da Clínica
                  </h2>
                  <p className="text-muted-foreground mb-8">
                    Informe o nome e CNPJ da sua clínica
                  </p>

                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Nome da Clínica *
                      </label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Ex: Clínica Saúde & Bem-Estar"
                          value={formData.clinic_name}
                          onChange={(e) => updateField('clinic_name', e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        CNPJ (opcional)
                      </label>
                      <Input
                        placeholder="00.000.000/0001-00"
                        value={formData.cnpj}
                        onChange={(e) => updateField('cnpj', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 3 && (
                <div>
                  <h2 className="text-2xl font-bold text-foreground mb-2">
                    Informações de Contato
                  </h2>
                  <p className="text-muted-foreground mb-8">
                    Como seus pacientes podem entrar em contato
                  </p>

                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Email Comercial *
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="email"
                          placeholder="contato@suaclinica.com"
                          value={formData.email}
                          onChange={(e) => updateField('email', e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Telefone / WhatsApp *
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="(11) 99999-9999"
                          value={formData.phone}
                          onChange={(e) => updateField('phone', e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 4 && (
                <div>
                  <h2 className="text-2xl font-bold text-foreground mb-2">
                    Endereço
                  </h2>
                  <p className="text-muted-foreground mb-8">
                    Onde sua clínica está localizada
                  </p>

                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Endereço Completo *
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Textarea
                        placeholder="Rua, número, bairro, cidade - estado, CEP"
                        value={formData.address}
                        onChange={(e) => updateField('address', e.target.value)}
                        className="pl-10 min-h-[100px]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 5 && (
                <div className="text-center">
                  <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                    <Sparkles className="h-10 w-10 text-primary" />
                  </div>

                  <h2 className="text-2xl font-bold text-foreground mb-2">
                    Tudo Pronto!
                  </h2>
                  <p className="text-muted-foreground mb-8">
                    Revise os dados e clique em "Começar" para acessar sua clínica
                  </p>

                  <div className="bg-muted/50 rounded-lg p-4 text-left mb-8">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Especialidade:</span>
                        <span className="font-medium">
                          {categories.find(c => c.value === formData.category)?.label || formData.category}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Clínica:</span>
                        <span className="font-medium">{formData.clinic_name}</span>
                      </div>
                      {formData.cnpj && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">CNPJ:</span>
                          <span className="font-medium">{formData.cnpj}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Email:</span>
                        <span className="font-medium">{formData.email}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Telefone:</span>
                        <span className="font-medium">{formData.phone}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex justify-between mt-8">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 1}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>

            {currentStep < 5 ? (
              <Button onClick={handleNext} disabled={!canProceed()}>
                Próximo
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button 
                onClick={handleComplete} 
                disabled={loading}
                className="gradient-primary text-primary-foreground"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    Começar a Usar
                    <Sparkles className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
