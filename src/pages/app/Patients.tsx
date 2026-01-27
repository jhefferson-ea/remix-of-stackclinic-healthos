import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus, Phone, Mail, Calendar, ChevronRight, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api, type Patient } from '@/services/api';
import { cn } from '@/lib/utils';
import { NewPatientModal } from '@/components/patients/NewPatientModal';
import { PatientGroupsModal } from '@/components/patients/PatientGroupsModal';

export default function Patients() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isNewPatientOpen, setIsNewPatientOpen] = useState(false);
  const [isGroupsModalOpen, setIsGroupsModalOpen] = useState(false);

  useEffect(() => {
    loadPatients();
  }, []);

  async function loadPatients() {
    setIsLoading(true);
    const res = await api.getPatients(search);
    if (res.success && res.data) {
      setPatients(res.data);
    }
    setIsLoading(false);
  }

  const handleSearch = async () => {
    const res = await api.getPatients(search);
    if (res.success && res.data) {
      setPatients(res.data);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Meus Pacientes</h1>
          <p className="text-muted-foreground">Prontuário eletrônico avançado</p>
        </div>
        <Button variant="outline" onClick={() => setIsGroupsModalOpen(true)}>
          <Users className="h-4 w-4 mr-2" />
          Grupos
        </Button>
        <Button onClick={() => setIsNewPatientOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Paciente
        </Button>
      </div>

      {/* Search */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-10"
          />
        </div>
        <Button variant="secondary" onClick={handleSearch}>
          Buscar
        </Button>
      </div>

      {/* Patients Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : patients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Search className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">Nenhum paciente encontrado</h3>
          <p className="text-muted-foreground mt-1">
            {search ? 'Tente uma busca diferente' : 'Cadastre seu primeiro paciente'}
          </p>
          {!search && (
            <Button className="mt-4" onClick={() => setIsNewPatientOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Paciente
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {patients.map((patient) => (
            <Link
              key={patient.id}
              to={`/app/pacientes/${patient.id}`}
              className="group bg-card rounded-xl border border-border p-4 shadow-card hover:shadow-card-hover transition-all duration-200"
            >
              <div className="flex items-start gap-4">
                <div className={cn(
                  'h-12 w-12 rounded-full flex items-center justify-center text-lg font-semibold',
                  'bg-primary/10 text-primary'
                )}>
                  {patient.avatar ? (
                    <img
                      src={patient.avatar}
                      alt={patient.name || 'Paciente'}
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    (patient.name?.charAt(0) || 'P').toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-foreground truncate">{patient.name}</h3>
                      {patient.convenio && (
                        <span className="inline-flex items-center rounded-full bg-info/10 px-2 py-0.5 text-xs font-medium text-info mt-1">
                          {patient.convenio}
                        </span>
                      )}
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  <span>{patient.phone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  <span className="truncate">{patient.email}</span>
                </div>
                {patient.last_visit && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>Última visita: {patient.last_visit}</span>
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* New Patient Modal */}
      <NewPatientModal
        open={isNewPatientOpen}
        onOpenChange={setIsNewPatientOpen}
        onSuccess={loadPatients}
      />

      {/* Patient Groups Modal */}
      <PatientGroupsModal
        open={isGroupsModalOpen}
        onOpenChange={setIsGroupsModalOpen}
        patients={patients}
      />
    </div>
  );
}
