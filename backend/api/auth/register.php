<?php
/**
 * StackClinic API - Register
 * POST /api/auth/register
 * 
 * Cria novo usuário + nova clínica + assinatura trial automaticamente
 */

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/Auth.php';
require_once __DIR__ . '/../helpers/Subscription.php';

/**
 * Helpers para compatibilidade com schemas diferentes no banco
 */
function tableExists(PDO $db, string $table): bool {
    try {
        $stmt = $db->prepare("SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = :table LIMIT 1");
        $stmt->execute([':table' => $table]);
        return (bool) $stmt->fetchColumn();
    } catch (Exception $e) {
        return false;
    }
}

function hasColumn(PDO $db, string $table, string $column): bool {
    try {
        $stmt = $db->prepare("SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = :table AND column_name = :column LIMIT 1");
        $stmt->execute([':table' => $table, ':column' => $column]);
        return (bool) $stmt->fetchColumn();
    } catch (Exception $e) {
        return false;
    }
}

function getColumnType(PDO $db, string $table, string $column): ?string {
    try {
        $stmt = $db->prepare("SELECT column_type FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = :table AND column_name = :column LIMIT 1");
        $stmt->execute([':table' => $table, ':column' => $column]);
        $type = $stmt->fetchColumn();
        return $type ? (string) $type : null;
    } catch (Exception $e) {
        return null;
    }
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::methodNotAllowed();
}

$data = json_decode(file_get_contents('php://input'), true);

$name = trim($data['name'] ?? '');
$email = trim($data['email'] ?? '');
$password = $data['password'] ?? '';
$referralCode = trim($data['referral_code'] ?? '');

if (empty($name) || empty($email) || empty($password)) {
    Response::badRequest('Nome, email e senha são obrigatórios');
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    Response::badRequest('Email inválido');
}

if (strlen($password) < 6) {
    Response::badRequest('Senha deve ter pelo menos 6 caracteres');
}

// Validate referral code if provided
$referrerClinicId = null;
if (!empty($referralCode)) {
    try {
        $database = new Database();
        $db = $database->getConnection();
        $stmt = $db->prepare("SELECT clinica_id FROM parceiros WHERE referral_code = :code LIMIT 1");
        $stmt->execute([':code' => strtoupper($referralCode)]);
        $referrer = $stmt->fetch();
        if ($referrer) {
            $referrerClinicId = (int) $referrer['clinica_id'];
        }
    } catch (Exception $e) {
        // Ignore referral code errors - don't block registration
        error_log("Referral code lookup error: " . $e->getMessage());
    }
}

try {
    $database = new Database();
    $db = $database->getConnection();

    // Check if email already exists
    $stmt = $db->prepare("SELECT id FROM usuarios WHERE email = :email LIMIT 1");
    $stmt->execute([':email' => $email]);
    if ($stmt->fetch()) {
        Response::badRequest('Este email já está cadastrado');
    }

    // Iniciar transação
    $db->beginTransaction();

    try {
        // 1. Criar nova clínica (compatível com schemas antigos/novos)
        $clinicCols = ['name', 'email'];
        $clinicVals = [':name', ':email'];
        $clinicParams = [
            ':name' => 'Clínica de ' . $name,
            ':email' => $email
        ];

        if (hasColumn($db, 'clinica', 'onboarding_completed')) {
            $clinicCols[] = 'onboarding_completed';
            $clinicVals[] = ':onboarding_completed';
            $clinicParams[':onboarding_completed'] = 0;
        }

        $stmtClinic = $db->prepare(
            "INSERT INTO clinica (" . implode(', ', $clinicCols) . ") VALUES (" . implode(', ', $clinicVals) . ")"
        );
        $stmtClinic->execute($clinicParams);
        $clinicId = $db->lastInsertId();

        // 2. Hash password e criar usuário como owner/admin (compatível com schemas)
        $hashedPassword = password_hash($password, PASSWORD_DEFAULT);

        $userCols = ['name', 'email', 'password'];
        $userVals = [':name', ':email', ':password'];
        $userParams = [
            ':name' => $name,
            ':email' => $email,
            ':password' => $hashedPassword
        ];

        // role pode ser ('admin'...) ou ('owner'...)
        if (hasColumn($db, 'usuarios', 'role')) {
            $roleType = getColumnType($db, 'usuarios', 'role') ?? '';
            $roleValue = 'admin';
            if (stripos($roleType, "'owner'") !== false) {
                $roleValue = 'owner';
            } elseif (stripos($roleType, "'admin'") !== false) {
                $roleValue = 'admin';
            }

            $userCols[] = 'role';
            $userVals[] = ':role';
            $userParams[':role'] = $roleValue;
        }

        if (hasColumn($db, 'usuarios', 'clinica_id')) {
            $userCols[] = 'clinica_id';
            $userVals[] = ':clinica_id';
            $userParams[':clinica_id'] = $clinicId;
        }

        if (hasColumn($db, 'usuarios', 'subscription_status')) {
            $userCols[] = 'subscription_status';
            $userVals[] = ':subscription_status';
            $userParams[':subscription_status'] = 'pending';
        }

        // schema antigo usa `status`, schema novo usa `active`
        if (hasColumn($db, 'usuarios', 'active')) {
            $userCols[] = 'active';
            $userVals[] = ':active';
            $userParams[':active'] = 1;
        } elseif (hasColumn($db, 'usuarios', 'status')) {
            $userCols[] = 'status';
            $userVals[] = ':status';
            $userParams[':status'] = 'active';
        }

        $stmt = $db->prepare(
            "INSERT INTO usuarios (" . implode(', ', $userCols) . ") VALUES (" . implode(', ', $userVals) . ")"
        );
        $stmt->execute($userParams);
        $userId = $db->lastInsertId();

        // 3. Atualizar clínica com owner_user_id (se existir)
        if (hasColumn($db, 'clinica', 'owner_user_id')) {
            $stmtOwner = $db->prepare("UPDATE clinica SET owner_user_id = :user_id WHERE id = :id");
            $stmtOwner->execute([':user_id' => $userId, ':id' => $clinicId]);
        }

        // 4. Criar assinatura trial de 14 dias (se tabela existir)
        if (tableExists($db, 'assinaturas')) {
            Subscription::createTrial($clinicId, $db);
        }

        // 5. Process referral code - increment referrer's count
        if ($referrerClinicId) {
            try {
                $stmtRef = $db->prepare("
                    UPDATE parceiros 
                    SET current_referrals = current_referrals + 1 
                    WHERE clinica_id = :clinica_id
                ");
                $stmtRef->execute([':clinica_id' => $referrerClinicId]);
                
                // Create referral record if table exists
                if (tableExists($db, 'indicacoes')) {
                    $stmtInd = $db->prepare("
                        INSERT INTO indicacoes (referrer_clinica_id, referred_clinica_id, created_at)
                        VALUES (:referrer_id, :referred_id, NOW())
                    ");
                    $stmtInd->execute([
                        ':referrer_id' => $referrerClinicId,
                        ':referred_id' => $clinicId
                    ]);
                }
            } catch (Exception $e) {
                // Log but don't fail registration
                error_log("Referral tracking error: " . $e->getMessage());
            }
        }

        $db->commit();

    } catch (Exception $e) {
        $db->rollBack();
        throw $e;
    }

    // Generate JWT token with clinica_id for multi-tenancy
    $token = Auth::generateToken($userId, $email, 'admin', $clinicId);

    Response::success([
        'token' => $token,
        'user' => [
            'id' => (int)$userId,
            'name' => $name,
            'email' => $email,
            'role' => 'admin',
            'avatar' => null,
            'clinic_id' => (int)$clinicId,
            'clinic_name' => 'Clínica de ' . $name,
            'subscription_status' => 'pending', // Ainda precisa ativar
            'onboarding_completed' => false,
            'is_saas_admin' => false,
            'saas_role' => null
        ]
    ], 'Conta criada com sucesso! Complete a configuração da sua clínica.');

} catch (Exception $e) {
    error_log("Register error: " . $e->getMessage());
    Response::serverError('Erro ao criar conta');
}
