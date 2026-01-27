-- StackClinic Database Update v5
-- Patient Groups Feature

-- Table for patient groups
CREATE TABLE IF NOT EXISTS grupos_pacientes (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    clinica_id INT UNSIGNED NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (clinica_id) REFERENCES clinica(id) ON DELETE CASCADE,
    UNIQUE KEY unique_group_per_clinic (clinica_id, name),
    INDEX idx_clinica (clinica_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table for group members (many-to-many relationship)
CREATE TABLE IF NOT EXISTS grupos_pacientes_membros (
    grupo_id INT UNSIGNED NOT NULL,
    paciente_id INT UNSIGNED NOT NULL,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (grupo_id, paciente_id),
    FOREIGN KEY (grupo_id) REFERENCES grupos_pacientes(id) ON DELETE CASCADE,
    FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
    INDEX idx_grupo (grupo_id),
    INDEX idx_paciente (paciente_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
