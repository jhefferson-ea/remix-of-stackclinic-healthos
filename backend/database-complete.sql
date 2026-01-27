-- StackClinic Database - Complete Schema
-- Execute this script to create all necessary tables

-- Tabela de clínicas
CREATE TABLE IF NOT EXISTS clinica (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),
    address TEXT,
    logo VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de usuários
CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    clinica_id INT DEFAULT 1,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('owner', 'doctor', 'secretary') DEFAULT 'doctor',
    phone VARCHAR(20),
    avatar VARCHAR(500),
    specialty VARCHAR(100),
    crm VARCHAR(50),
    status ENUM('active', 'pending', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (clinica_id) REFERENCES clinica(id)
);

-- Tabela de pacientes
CREATE TABLE IF NOT EXISTS pacientes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    clinica_id INT DEFAULT 1,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20),
    cpf VARCHAR(14),
    birth_date DATE,
    gender ENUM('M', 'F', 'O'),
    address TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (clinica_id) REFERENCES clinica(id)
);

-- Tabela de agendamentos
CREATE TABLE IF NOT EXISTS agendamentos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    clinica_id INT DEFAULT 1,
    paciente_id INT NOT NULL,
    date DATE NOT NULL,
    time TIME NOT NULL,
    duration INT DEFAULT 30,
    procedure_name VARCHAR(255),
    `procedure` VARCHAR(255),
    notes TEXT,
    status ENUM('pending', 'confirmed', 'completed', 'cancelled', 'no_show') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (clinica_id) REFERENCES clinica(id),
    FOREIGN KEY (paciente_id) REFERENCES pacientes(id)
);

-- Tabela de bloqueios de agenda
CREATE TABLE IF NOT EXISTS bloqueios_agenda (
    id INT AUTO_INCREMENT PRIMARY KEY,
    clinica_id INT DEFAULT 1,
    title VARCHAR(255) NOT NULL,
    day_of_week INT,
    specific_date DATE,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    recurring BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (clinica_id) REFERENCES clinica(id)
);

-- Tabela de gatilhos customizados
CREATE TABLE IF NOT EXISTS gatilhos_customizados (
    id INT AUTO_INCREMENT PRIMARY KEY,
    clinica_id INT DEFAULT 1,
    name VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    trigger_type ENUM('recurring', 'one_time', 'event_based') DEFAULT 'recurring',
    interval_hours INT DEFAULT 24,
    target_type ENUM('all', 'specific_patient', 'patient_group') DEFAULT 'all',
    target_value VARCHAR(255),
    enabled BOOLEAN DEFAULT TRUE,
    last_executed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (clinica_id) REFERENCES clinica(id)
);

-- Tabela de biblioteca de arquivos
CREATE TABLE IF NOT EXISTS biblioteca_arquivos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    clinica_id INT DEFAULT 1,
    name VARCHAR(255) NOT NULL,
    url VARCHAR(500) NOT NULL,
    type VARCHAR(50),
    category VARCHAR(100) DEFAULT 'Geral',
    patient_id INT,
    whatsapp_shortcut VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (clinica_id) REFERENCES clinica(id),
    FOREIGN KEY (patient_id) REFERENCES pacientes(id)
);

-- Tabela de anamnese config
CREATE TABLE IF NOT EXISTS anamnese_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    clinica_id INT NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (clinica_id) REFERENCES clinica(id)
);

-- Tabela de template de anamnese
CREATE TABLE IF NOT EXISTS anamnese_template (
    id INT AUTO_INCREMENT PRIMARY KEY,
    clinica_id INT NOT NULL,
    question VARCHAR(500) NOT NULL,
    type ENUM('text', 'boolean', 'select', 'multiselect') DEFAULT 'text',
    options JSON,
    is_alert BOOLEAN DEFAULT FALSE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (clinica_id) REFERENCES clinica(id)
);

-- Tabela de galeria de paciente
CREATE TABLE IF NOT EXISTS galeria_paciente (
    id INT AUTO_INCREMENT PRIMARY KEY,
    paciente_id INT NOT NULL,
    image_url VARCHAR(500) NOT NULL,
    type ENUM('before', 'after', 'other') DEFAULT 'other',
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (paciente_id) REFERENCES pacientes(id)
);

-- Tabela de documentos de paciente
CREATE TABLE IF NOT EXISTS documentos_paciente (
    id INT AUTO_INCREMENT PRIMARY KEY,
    paciente_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    url VARCHAR(500) NOT NULL,
    type VARCHAR(50),
    category VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (paciente_id) REFERENCES pacientes(id)
);

-- Tabela de lista de espera
CREATE TABLE IF NOT EXISTS lista_espera (
    id INT AUTO_INCREMENT PRIMARY KEY,
    clinica_id INT DEFAULT 1,
    paciente_id INT NOT NULL,
    procedure_name VARCHAR(255),
    preferred_dates TEXT,
    notes TEXT,
    status ENUM('waiting', 'contacted', 'scheduled', 'cancelled') DEFAULT 'waiting',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (clinica_id) REFERENCES clinica(id),
    FOREIGN KEY (paciente_id) REFERENCES pacientes(id)
);

-- Tabela de sugestões de IA
CREATE TABLE IF NOT EXISTS sugestoes_ia (
    id INT AUTO_INCREMENT PRIMARY KEY,
    clinica_id INT DEFAULT 1,
    paciente_id INT,
    patient_name VARCHAR(255),
    date DATE NOT NULL,
    time TIME NOT NULL,
    procedure_name VARCHAR(255),
    confidence DECIMAL(3,2) DEFAULT 0.85,
    reason TEXT,
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (clinica_id) REFERENCES clinica(id),
    FOREIGN KEY (paciente_id) REFERENCES pacientes(id)
);

-- Tabela de transações financeiras
CREATE TABLE IF NOT EXISTS transacoes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    clinica_id INT DEFAULT 1,
    paciente_id INT,
    type ENUM('income', 'expense') NOT NULL,
    category VARCHAR(100),
    description TEXT,
    amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(50),
    date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (clinica_id) REFERENCES clinica(id),
    FOREIGN KEY (paciente_id) REFERENCES pacientes(id)
);

-- Inserir clínica padrão se não existir
INSERT IGNORE INTO clinica (id, name, email) VALUES (1, 'Minha Clínica', 'admin@clinica.com');

-- Inserir configuração de anamnese padrão
INSERT IGNORE INTO anamnese_config (id, clinica_id, enabled) VALUES (1, 1, TRUE);
