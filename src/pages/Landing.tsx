import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Menu,
  X,
  MessageCircle,
  Mic,
  DollarSign,
  Megaphone,
  Check,
  ChevronDown,
  ChevronUp,
  Calendar,
  Users,
  Bot,
  Shield,
  Smartphone,
  Star,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

export default function Landing() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const painPoints = [
    {
      icon: Calendar,
      title: 'Paciente esquece consulta?',
      description: 'Redução de até 30% nas faltas com lembretes automáticos inteligentes.',
    },
    {
      icon: Users,
      title: 'Secretária sobrecarregada?',
      description: 'IA que agenda, confirma e remarca automaticamente pelo WhatsApp.',
    },
    {
      icon: DollarSign,
      title: 'Glosa de convênio?',
      description: 'Geração automática de guias TISS com validação inteligente.',
    },
  ];

  const features = [
    {
      icon: Smartphone,
      title: 'Zero App',
      description: 'Seu paciente não baixa nada. Tudo acontece no WhatsApp que ele já usa.',
    },
    {
      icon: Mic,
      title: 'IA Scribe',
      description: 'Transcrevemos sua consulta automaticamente e geramos resumos clínicos.',
    },
    {
      icon: Shield,
      title: 'Financeiro Blindado',
      description: 'Controle de caixa, repasses e OCR para leitura de notas fiscais.',
    },
    {
      icon: Megaphone,
      title: 'Marketing Automático',
      description: 'Resgate pacientes sumidos com campanhas personalizadas de reativação.',
    },
  ];

  const pricing = [
    {
      name: 'Autônomo',
      price: 'R$ 97',
      period: '/mês',
      description: 'Para profissionais individuais',
      features: [
        '1 profissional',
        '500 mensagens/mês',
        'Agendamento inteligente',
        'Lembretes automáticos',
        'Suporte por email',
      ],
      popular: false,
    },
    {
      name: 'Clínica',
      price: 'R$ 197',
      period: '/mês',
      description: 'Para clínicas em crescimento',
      features: [
        'Até 5 profissionais',
        'Mensagens ilimitadas',
        'IA Scribe (transcrição)',
        'Financeiro + OCR',
        'Marketing CRM',
        'Suporte prioritário',
      ],
      popular: true,
    },
    {
      name: 'Enterprise',
      price: 'Sob consulta',
      period: '',
      description: 'Para redes e hospitais',
      features: [
        'Profissionais ilimitados',
        'API customizada',
        'Multi-unidades',
        'Integração ERP/PEP',
        'Gerente de sucesso dedicado',
        'SLA garantido',
      ],
      popular: false,
    },
  ];

  const faqs = [
    {
      question: 'Preciso instalar algo?',
      answer: 'Não! O StackClinic funciona 100% na nuvem. Você acessa pelo navegador e seus pacientes interagem pelo WhatsApp que já usam.',
    },
    {
      question: 'Funciona para dentistas?',
      answer: 'Sim! Temos personalidades de IA específicas para dentistas, nutricionistas, psicólogos e outras especialidades. O bot se adapta ao tom de comunicação ideal para sua área.',
    },
    {
      question: 'Como funciona a integração com WhatsApp?',
      answer: 'Usamos a Evolution API, uma integração oficial e segura. Você conecta seu número comercial do WhatsApp e nosso bot passa a responder automaticamente.',
    },
    {
      question: 'Meus dados estão seguros?',
      answer: 'Absolutamente. Seguimos todas as normas da LGPD, usamos criptografia de ponta a ponta e armazenamos dados em servidores brasileiros com certificação ISO 27001.',
    },
  ];

  const partners = [
    'Clínica Sorriso',
    'Odonto Excellence',
    'NutriVida',
    'PsicoCenter',
    'DermaClinic',
    'OrthoMed',
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">SC</span>
              </div>
              <span className="font-semibold text-lg text-foreground">StackClinic</span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Funcionalidades
              </a>
              <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Preços
              </a>
              <a href="#faq" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                FAQ
              </a>
            </div>

            {/* CTA */}
            <div className="hidden md:flex items-center gap-3">
              <Button variant="outline" asChild>
                <Link to="/auth">Entrar</Link>
              </Button>
            </div>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden text-foreground"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="md:hidden bg-background border-b border-border"
          >
            <div className="container mx-auto px-4 py-4 space-y-4">
              <a href="#features" className="block text-muted-foreground hover:text-foreground">
                Funcionalidades
              </a>
              <a href="#pricing" className="block text-muted-foreground hover:text-foreground">
                Preços
              </a>
              <a href="#faq" className="block text-muted-foreground hover:text-foreground">
                FAQ
              </a>
              <Button className="w-full" asChild>
                <Link to="/auth">Entrar</Link>
              </Button>
            </div>
          </motion.div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
            className="max-w-4xl mx-auto text-center"
          >
            <motion.div variants={fadeInUp} className="mb-6">
              <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
                <Bot className="h-4 w-4" />
                Powered by IA
              </span>
            </motion.div>

            <motion.h1
              variants={fadeInUp}
              className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight"
            >
              A gestão da sua clínica{' '}
              <span className="text-primary">direto no WhatsApp</span>
            </motion.h1>

            <motion.p
              variants={fadeInUp}
              className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto"
            >
              Sem aplicativos para baixar. Sem login para o paciente.{' '}
              <strong>Reduza faltas em 30%</strong> com nossa IA de agendamento invisível.
            </motion.p>

            <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="text-lg px-8" asChild>
                <Link to="/auth">
                  Começar Teste Grátis
                  <MessageCircle className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="text-lg px-8" asChild>
                <a href="#features">Ver Funcionalidades</a>
              </Button>
            </motion.div>

            {/* Hero Visual */}
            <motion.div
              variants={fadeInUp}
              className="mt-16 relative"
            >
              <div className="relative mx-auto max-w-4xl">
                <div className="grid md:grid-cols-2 gap-6 items-center">
                  {/* WhatsApp Mockup */}
                  <div className="bg-card rounded-2xl border border-border p-4 shadow-xl">
                    <div className="flex items-center gap-3 pb-3 border-b border-border">
                      <div className="h-10 w-10 rounded-full bg-success flex items-center justify-center">
                        <MessageCircle className="h-5 w-5 text-success-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">StackClinic Bot</p>
                        <p className="text-xs text-muted-foreground">online</p>
                      </div>
                    </div>
                    <div className="py-4 space-y-3">
                      <div className="flex justify-end">
                        <div className="bg-success/20 rounded-lg px-4 py-2 max-w-[80%]">
                          <p className="text-sm text-foreground">Olá! Gostaria de agendar uma consulta</p>
                        </div>
                      </div>
                      <div className="flex justify-start">
                        <div className="bg-muted rounded-lg px-4 py-2 max-w-[80%]">
                          <p className="text-sm text-foreground">
                            Olá Maria! 👋 Tenho horários disponíveis amanhã às 14h ou 16h. Qual prefere?
                          </p>
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <div className="bg-success/20 rounded-lg px-4 py-2 max-w-[80%]">
                          <p className="text-sm text-foreground">14h está ótimo!</p>
                        </div>
                      </div>
                      <div className="flex justify-start">
                        <div className="bg-muted rounded-lg px-4 py-2 max-w-[80%]">
                          <p className="text-sm text-foreground">
                            Perfeito! ✅ Agendei sua consulta para amanhã, 14h. Enviarei um lembrete 24h antes!
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Dashboard Preview */}
                  <div className="bg-card rounded-2xl border border-border p-4 shadow-xl">
                    <div className="flex items-center gap-2 pb-3 border-b border-border">
                      <div className="h-3 w-3 rounded-full bg-destructive" />
                      <div className="h-3 w-3 rounded-full bg-warning" />
                      <div className="h-3 w-3 rounded-full bg-success" />
                    </div>
                    <div className="py-4 space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-primary/10 rounded-lg p-3">
                          <p className="text-xs text-muted-foreground">Hoje</p>
                          <p className="text-xl font-bold text-primary">R$ 2.450</p>
                        </div>
                        <div className="bg-success/10 rounded-lg p-3">
                          <p className="text-xs text-muted-foreground">Consultas</p>
                          <p className="text-xl font-bold text-success">12</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between bg-muted/50 rounded-lg p-2">
                          <span className="text-sm text-foreground">09:00 - Maria Silva</span>
                          <span className="text-xs bg-success/20 text-success px-2 py-0.5 rounded">Confirmado</span>
                        </div>
                        <div className="flex items-center justify-between bg-muted/50 rounded-lg p-2">
                          <span className="text-sm text-foreground">10:30 - João Santos</span>
                          <span className="text-xs bg-warning/20 text-warning px-2 py-0.5 rounded">Pendente</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Pain Points */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="max-w-5xl mx-auto"
          >
            <motion.div variants={fadeInUp} className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Problemas que resolvemos
              </h2>
              <p className="text-lg text-muted-foreground">
                Automatize tarefas repetitivas e foque no que importa: seus pacientes.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-6">
              {painPoints.map((point, index) => (
                <motion.div
                  key={index}
                  variants={fadeInUp}
                  className="bg-card rounded-xl border border-border p-6 shadow-card hover:shadow-card-hover transition-shadow"
                >
                  <div className="h-12 w-12 rounded-lg bg-secondary/10 flex items-center justify-center mb-4">
                    <point.icon className="h-6 w-6 text-secondary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{point.title}</h3>
                  <p className="text-muted-foreground">{point.description}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-4">
        <div className="container mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="max-w-5xl mx-auto"
          >
            <motion.div variants={fadeInUp} className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Tudo que você precisa em um só lugar
              </h2>
              <p className="text-lg text-muted-foreground">
                Uma plataforma completa para gestão da sua clínica
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 gap-6">
              {features.map((feature, index) => (
                <motion.div
                  key={index}
                  variants={fadeInUp}
                  className="bg-card rounded-xl border border-border p-6 shadow-card hover:shadow-card-hover transition-shadow group"
                >
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <feature.icon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
                      <p className="text-muted-foreground">{feature.description}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="text-center"
          >
            <p className="text-lg text-muted-foreground mb-8">
              Mais de <strong className="text-foreground">200 clínicas</strong> já usam StackClinic
            </p>
            <div className="flex flex-wrap justify-center gap-8 opacity-50">
              {partners.map((partner, index) => (
                <div
                  key={index}
                  className="text-lg font-semibold text-muted-foreground"
                >
                  {partner}
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-4">
        <div className="container mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="max-w-5xl mx-auto"
          >
            <motion.div variants={fadeInUp} className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Planos para todos os tamanhos
              </h2>
              <p className="text-lg text-muted-foreground">
                Comece grátis por 14 dias. Sem cartão de crédito.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-6">
              {pricing.map((plan, index) => (
                <motion.div
                  key={index}
                  variants={fadeInUp}
                  className={cn(
                    'bg-card rounded-xl border p-6 shadow-card relative',
                    plan.popular
                      ? 'border-primary ring-2 ring-primary/20'
                      : 'border-border'
                  )}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                        <Star className="h-3 w-3" />
                        Mais Popular
                      </span>
                    </div>
                  )}
                  <div className="text-center mb-6">
                    <h3 className="text-xl font-semibold text-foreground mb-2">{plan.name}</h3>
                    <p className="text-sm text-muted-foreground mb-4">{plan.description}</p>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                      <span className="text-muted-foreground">{plan.period}</span>
                    </div>
                  </div>
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, fIndex) => (
                      <li key={fIndex} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Check className="h-4 w-4 text-success flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full"
                    variant={plan.popular ? 'default' : 'outline'}
                    asChild
                  >
                    <Link to="/auth">
                      {plan.price === 'Sob consulta' ? 'Falar com Vendas' : 'Começar Agora'}
                    </Link>
                  </Button>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="max-w-3xl mx-auto"
          >
            <motion.div variants={fadeInUp} className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Perguntas Frequentes
              </h2>
              <p className="text-lg text-muted-foreground">
                Tire suas dúvidas sobre o StackClinic
              </p>
            </motion.div>

            <div className="space-y-4">
              {faqs.map((faq, index) => (
                <motion.div
                  key={index}
                  variants={fadeInUp}
                  className="bg-card rounded-xl border border-border overflow-hidden"
                >
                  <button
                    onClick={() => setOpenFaq(openFaq === index ? null : index)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
                  >
                    <span className="font-medium text-foreground">{faq.question}</span>
                    {openFaq === index ? (
                      <ChevronUp className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    )}
                  </button>
                  {openFaq === index && (
                    <div className="px-4 pb-4">
                      <p className="text-muted-foreground">{faq.answer}</p>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="max-w-3xl mx-auto text-center"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Pronto para revolucionar sua clínica?
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Comece agora mesmo e veja resultados em poucos dias.
            </p>
            <Button size="lg" className="text-lg px-8" asChild>
              <Link to="/auth">
                Começar Teste Grátis
                <MessageCircle className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-border bg-muted/30">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <Link to="/" className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center">
                  <span className="text-primary-foreground font-bold text-sm">SC</span>
                </div>
                <span className="font-semibold text-lg text-foreground">StackClinic</span>
              </Link>
              <p className="text-sm text-muted-foreground">
                Automação inteligente para clínicas de saúde.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Produto</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground transition-colors">Funcionalidades</a></li>
                <li><a href="#pricing" className="hover:text-foreground transition-colors">Preços</a></li>
                <li><a href="#faq" className="hover:text-foreground transition-colors">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Empresa</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Sobre</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Contato</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Privacidade</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Termos de Uso</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">LGPD</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-border text-center text-sm text-muted-foreground">
            <p>© 2025 StackLabz. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
