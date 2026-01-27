import { useEffect, useState, useRef } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Clock,
  Camera,
  Download,
  CheckCircle,
  AlertCircle,
  Loader2,
  Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { cn } from '@/lib/utils';
import { api, type FinancialSummary, type CashFlowData, type Receipt, type OcrResult, type ProcedurePayment } from '@/services/api';
import { toast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ProfessionalFilter } from '@/components/agenda/ProfessionalFilter';

export default function Financial() {
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [cashFlow, setCashFlow] = useState<CashFlowData[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedReceipts, setSelectedReceipts] = useState<number[]>([]);
  const [yesterdayPayments, setYesterdayPayments] = useState<ProcedurePayment[]>([]);
  const [pendingPayments, setPendingPayments] = useState<ProcedurePayment[]>([]);
  const [paidPayments, setPaidPayments] = useState<ProcedurePayment[]>([]);
  const [updatingPayment, setUpdatingPayment] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'history'>('overview');
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, [selectedProfessionalId]);

  async function loadData() {
    setIsLoading(true);
    const [summaryRes, cashFlowRes, receiptsRes, yesterdayRes, pendingRes, paidRes] = await Promise.all([
      api.getFinancialSummary(selectedProfessionalId || undefined),
      api.getCashFlow('month'),
      api.getReceipts(),
      api.getProcedurePayments({ date: 'yesterday', professional_id: selectedProfessionalId || undefined }),
      api.getProcedurePayments({ status: 'pending', professional_id: selectedProfessionalId || undefined }),
      api.getProcedurePayments({ status: 'pago', professional_id: selectedProfessionalId || undefined }),
    ]);

    if (summaryRes.success && summaryRes.data) setSummary(summaryRes.data);
    if (cashFlowRes.success && cashFlowRes.data) setCashFlow(cashFlowRes.data);
    if (receiptsRes.success && receiptsRes.data) setReceipts(receiptsRes.data);
    if (yesterdayRes.success && yesterdayRes.data) setYesterdayPayments(yesterdayRes.data);
    if (pendingRes.success && pendingRes.data) setPendingPayments(pendingRes.data);
    if (paidRes.success && paidRes.data) setPaidPayments(paidRes.data);
    setIsLoading(false);
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      const res = await api.processOcr(base64);
      if (res.success && res.data) {
        setOcrResult(res.data);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateTiss = async () => {
    if (selectedReceipts.length === 0) return;
    const res = await api.generateTissDocument(selectedReceipts);
    if (res.success && res.data) {
      window.open(res.data.pdf_url, '_blank');
    }
  };

  const toggleReceiptSelection = (id: number) => {
    setSelectedReceipts((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  };

  const handleUpdatePaymentStatus = async (id: number, status: 'pago' | 'pendente') => {
    setUpdatingPayment(id);
    try {
      const res = await api.updatePaymentStatus(id, status);
      if (res.success) {
        toast({
          title: status === 'pago' ? 'Pagamento confirmado!' : 'Marcado como pendente',
          description: status === 'pago' 
            ? 'O valor foi adicionado à receita.' 
            : 'O valor permanece na lista de pendentes.',
        });
        loadData();
      } else {
        toast({
          title: 'Erro',
          description: res.error || 'Não foi possível atualizar o status',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Erro',
        description: 'Erro ao atualizar status de pagamento',
        variant: 'destructive',
      });
    } finally {
      setUpdatingPayment(null);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const totalPending = pendingPayments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Financeiro</h1>
          <p className="text-muted-foreground">Controle de fluxo de caixa e reembolsos</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Professional Filter */}
          <ProfessionalFilter 
            value={selectedProfessionalId} 
            onChange={setSelectedProfessionalId} 
          />
          
          <Button
            variant={activeTab === 'overview' ? 'default' : 'outline'}
            onClick={() => setActiveTab('overview')}
            size="sm"
          >
            Visão Geral
          </Button>
          <Button
            variant={activeTab === 'history' ? 'default' : 'outline'}
            onClick={() => setActiveTab('history')}
            size="sm"
          >
            Histórico de Pagamentos
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Receita Total"
          value={summary ? formatCurrency(summary.total_revenue) : 'R$ 0'}
          icon={<TrendingUp className="h-6 w-6" />}
          variant="success"
        />
        <KpiCard
          title="Despesas"
          value={summary ? formatCurrency(summary.total_expenses) : 'R$ 0'}
          icon={<TrendingDown className="h-6 w-6" />}
        />
        <KpiCard
          title="Saldo"
          value={summary ? formatCurrency(summary.balance) : 'R$ 0'}
          icon={<DollarSign className="h-6 w-6" />}
          variant="primary"
        />
        <KpiCard
          title="A Receber"
          value={formatCurrency(totalPending)}
          icon={<Clock className="h-6 w-6" />}
          variant="warning"
        />
      </div>

      {activeTab === 'overview' ? (
        <>
          {/* Procedure Payments Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Yesterday's Procedures */}
            <div className="bg-card rounded-xl border border-border p-6 shadow-card">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Procedimentos de Ontem</h2>
              </div>
              
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : yesterdayPayments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhum procedimento realizado ontem
                </p>
              ) : (
                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                  {yesterdayPayments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{payment.patient_name}</p>
                        <p className="text-sm text-muted-foreground truncate">{payment.procedure_name}</p>
                        <p className="text-xs text-muted-foreground">{payment.time}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="font-semibold text-foreground">{formatCurrency(payment.amount)}</p>
                        {payment.status === 'pago' ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-success bg-success/10 px-2 py-1 rounded-full">
                            <CheckCircle className="h-3 w-3" />
                            Pago
                          </span>
                        ) : (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleUpdatePaymentStatus(payment.id, 'pendente')}
                              disabled={updatingPayment === payment.id || payment.status === 'pendente'}
                              className="text-xs h-7"
                            >
                              {updatingPayment === payment.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                'Pendente'
                              )}
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleUpdatePaymentStatus(payment.id, 'pago')}
                              disabled={updatingPayment === payment.id}
                              className="text-xs h-7"
                            >
                              {updatingPayment === payment.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <>
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Pago
                                </>
                              )}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pending Payments */}
            <div className="bg-card rounded-xl border border-border p-6 shadow-card">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-warning" />
                  <h2 className="text-lg font-semibold">Valores Pendentes Total</h2>
                </div>
                <span className="text-sm font-medium text-warning bg-warning/10 px-2 py-1 rounded-full">
                  {pendingPayments.length} pendente{pendingPayments.length !== 1 ? 's' : ''}
                </span>
              </div>
              
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : pendingPayments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhum valor pendente 🎉
                </p>
              ) : (
                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                  {pendingPayments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-warning/30 bg-warning/5"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{payment.patient_name}</p>
                        <p className="text-sm text-muted-foreground truncate">{payment.procedure_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(parseISO(payment.date), "dd/MM/yyyy", { locale: ptBR })} às {payment.time}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="font-semibold text-warning">{formatCurrency(payment.amount)}</p>
                        <Button
                          size="sm"
                          onClick={() => handleUpdatePaymentStatus(payment.id, 'pago')}
                          disabled={updatingPayment === payment.id}
                          className="text-xs h-7"
                        >
                          {updatingPayment === payment.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Pago
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        /* History Tab - Paid Payments */
        <div className="bg-card rounded-xl border border-border p-6 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-success" />
              <h2 className="text-lg font-semibold">Transações Concluídas</h2>
            </div>
            <span className="text-sm font-medium text-success bg-success/10 px-2 py-1 rounded-full">
              {paidPayments.length} pago{paidPayments.length !== 1 ? 's' : ''}
            </span>
          </div>
          
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : paidPayments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma transação concluída ainda
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Paciente</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Procedimento</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Valor</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Data do Agendamento</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Data do Pagamento</th>
                  </tr>
                </thead>
                <tbody>
                  {paidPayments.map((payment) => (
                    <tr key={payment.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="py-3 px-4 font-medium">{payment.patient_name}</td>
                      <td className="py-3 px-4 text-muted-foreground">{payment.procedure_name}</td>
                      <td className="py-3 px-4 font-semibold text-success">{formatCurrency(payment.amount)}</td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {format(parseISO(payment.date), "dd/MM/yyyy", { locale: ptBR })}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {payment.payment_date 
                          ? format(parseISO(payment.payment_date), "dd/MM/yyyy HH:mm", { locale: ptBR })
                          : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cash Flow Chart */}
        <div className="lg:col-span-2 bg-card rounded-xl border border-border p-6 shadow-card">
          <h2 className="text-lg font-semibold mb-6">Fluxo de Caixa</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashFlow}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Bar dataKey="entradas" name="Entradas" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="saidas" name="Saídas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* OCR Scanner */}
        <div className="bg-card rounded-xl border border-border p-6 shadow-card">
          <h2 className="text-lg font-semibold mb-4">Leitor de Despesas (OCR)</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Escaneie notas fiscais e recibos para registro automático
          </p>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/*"
            className="hidden"
          />

          <Button
            className="w-full"
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
          >
            <Camera className="h-4 w-4 mr-2" />
            Escanear Documento
          </Button>

          {ocrResult && (
            <div className="mt-6 rounded-lg bg-muted/50 p-4 space-y-2">
              <p className="text-sm font-medium text-foreground">Resultado do OCR:</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-muted-foreground">Valor</p>
                  <p className="font-semibold">{formatCurrency(ocrResult.valor)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Categoria</p>
                  <p className="font-semibold">{ocrResult.categoria}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground">Descrição</p>
                  <p className="font-semibold">{ocrResult.descricao}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Confiança: {Math.round(ocrResult.confidence * 100)}%
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Receipts Table */}
      <div className="bg-card rounded-xl border border-border p-6 shadow-card">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold">Gestão de Reembolso</h2>
            <p className="text-sm text-muted-foreground">Recibos para envio ao convênio</p>
          </div>
          <Button onClick={handleGenerateTiss} disabled={selectedReceipts.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Gerar PDF TISS ({selectedReceipts.length})
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                  <input
                    type="checkbox"
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedReceipts(receipts.map((r) => r.id));
                      } else {
                        setSelectedReceipts([]);
                      }
                    }}
                    checked={selectedReceipts.length === receipts.length && receipts.length > 0}
                    className="rounded border-border"
                  />
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                  Paciente
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                  Procedimento
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                  Valor
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                  Data
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((receipt) => (
                <tr key={receipt.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="py-3 px-4">
                    <input
                      type="checkbox"
                      checked={selectedReceipts.includes(receipt.id)}
                      onChange={() => toggleReceiptSelection(receipt.id)}
                      className="rounded border-border"
                    />
                  </td>
                  <td className="py-3 px-4 font-medium">{receipt.patient_name}</td>
                  <td className="py-3 px-4 text-muted-foreground">{receipt.procedure}</td>
                  <td className="py-3 px-4">{formatCurrency(receipt.value)}</td>
                  <td className="py-3 px-4 text-muted-foreground">{receipt.date}</td>
                  <td className="py-3 px-4">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                        receipt.status === 'pending' && 'bg-warning/10 text-warning',
                        receipt.status === 'processed' && 'bg-info/10 text-info',
                        receipt.status === 'submitted' && 'bg-success/10 text-success'
                      )}
                    >
                      {receipt.status === 'pending' && 'Pendente'}
                      {receipt.status === 'processed' && 'Processado'}
                      {receipt.status === 'submitted' && 'Enviado'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
