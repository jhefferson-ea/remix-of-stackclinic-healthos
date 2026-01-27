<?php
/**
 * StackClinic API Router
 * Main entry point - redirect to appropriate handler
 */

require_once __DIR__ . '/config/cors.php';
require_once __DIR__ . '/helpers/Response.php';

$uri = $_SERVER['REQUEST_URI'];
$uri = strtok($uri, '?'); // Remove query string

// Remove trailing slash
$uri = rtrim($uri, '/');

// Route mapping (order matters - more specific routes first)
$routes = [
    // Auth routes
    '/api/auth/login' => 'auth/login.php',
    '/api/auth/register' => 'auth/register.php',
    '/api/auth/update-profile' => 'auth/update-profile.php',
    
    // Subscription routes (SaaS)
    '/api/subscription/status' => 'subscription/status.php',
    '/api/subscription/plans' => 'subscription/plans.php',
    '/api/subscription/subscribe' => 'subscription/subscribe.php',
    
    // Onboarding routes
    '/api/onboarding/complete' => 'onboarding/complete.php',
    
    // Admin routes (SaaS)
    '/api/admin/dashboard' => 'admin/dashboard.php',
    '/api/admin/users' => 'admin/users.php',
    '/api/admin/clinics' => 'admin/clinics.php',
    '/api/admin/subscriptions' => 'admin/subscriptions.php',
    '/api/admin/saas-team' => 'admin/saas-team.php',
    
    // Team routes
    '/api/team/update' => 'team/update.php',
    '/api/team' => 'team/index.php',
    
    // Patient routes
    '/api/patients/create' => 'patients/create.php',
    
    // Procedures routes
    '/api/procedures/update' => 'procedures/update.php',
    '/api/procedures' => 'procedures/index.php',
    
    // Appointment routes
    '/api/appointments/block' => 'appointments/block.php',
    '/api/appointments/create' => 'appointments/create.php',
    '/api/appointments/waiting-list' => 'appointments/waiting-list.php',
    '/api/appointments/notify-waiting-list' => 'appointments/notify-waiting-list.php',
    '/api/appointments' => 'appointments/index.php',
    
    // Config routes
    '/api/config/upload-logo' => 'config/upload-logo.php',
    '/api/config/anamnese' => 'config/anamnese.php',
    '/api/config/clinic' => 'config/clinic.php',
    '/api/config/whatsapp' => 'config/whatsapp.php',
    
    // Webhook routes
    '/api/webhook/whatsapp' => 'webhook/whatsapp.php',
    
    // AI Custom Triggers routes
    '/api/ai/custom-triggers' => 'ai/custom-triggers.php',
    
    // Dashboard routes
    '/api/dashboard/summary' => 'dashboard/summary.php',
    '/api/dashboard/smart-feed' => 'dashboard/smart-feed.php',
    '/api/dashboard/humor' => 'dashboard/humor.php',
    
    // AI routes
    '/api/ai/suggestions' => 'ai/suggestions.php',
    '/api/ai/approve-slot' => 'ai/approve-slot.php',
    '/api/ai/reject-slot' => 'ai/reject-slot.php',
    '/api/ai/config' => 'ai/config.php',
    '/api/ai/live-chats' => 'ai/live-chats.php',
    '/api/ai/takeover' => 'ai/takeover.php',
    
    // Patient routes (base)
    '/api/patients/groups' => 'patients/groups.php',
    '/api/patients/groups/members' => 'patients/groups.php',
    '/api/patients' => 'patients/index.php',
    
    // Finance routes
    '/api/finance/procedure-payments' => 'finance/procedure-payments.php',
    '/api/finance/summary' => 'finance/summary.php',
    '/api/finance/cash-flow' => 'finance/cash-flow.php',
    '/api/finance/ocr' => 'finance/ocr.php',
    '/api/finance/receipts' => 'finance/receipts.php',
    '/api/finance/generate-tiss' => 'finance/generate-tiss.php',
    
    // Marketing routes
    '/api/marketing/stats' => 'marketing/stats.php',
    '/api/marketing/inactive-patients' => 'marketing/inactive-patients.php',
    '/api/marketing/send' => 'marketing/send.php',
    '/api/marketing/review-config' => 'marketing/review-config.php',
    
    // Library routes
    '/api/library/files' => 'library/files.php',
    '/api/library/upload' => 'library/upload.php',
    '/api/library/shortcuts' => 'library/shortcuts.php',
    
    // Partners routes
    '/api/partners/program' => 'partners/program.php',
    '/api/partners/referral-code' => 'partners/stats.php',
    '/api/partners/stats' => 'partners/stats.php',
    '/api/partners/validate-code' => 'partners/validate-code.php',
];

// Check static routes first (EXACT match only, no prefix matching)
foreach ($routes as $route => $file) {
    if ($uri === $route) {
        $filePath = __DIR__ . '/' . $file;
        if (file_exists($filePath)) {
            require_once $filePath;
            exit;
        }
    }
}

// Dynamic routes with regex
if (preg_match('/\/api\/appointments\/(\d+)/', $uri)) {
    require_once __DIR__ . '/appointments/detail.php';
} elseif (preg_match('/\/api\/patients\/(\d+)\/gallery\/upload/', $uri)) {
    require_once __DIR__ . '/patients/gallery-upload.php';
} elseif (preg_match('/\/api\/patients\/(\d+)\/documents\/upload/', $uri)) {
    require_once __DIR__ . '/patients/documents-upload.php';
} elseif (preg_match('/\/api\/patients\/(\d+)\/timeline/', $uri)) {
    require_once __DIR__ . '/patients/timeline.php';
} elseif (preg_match('/\/api\/patients\/(\d+)\/anamnesis/', $uri)) {
    require_once __DIR__ . '/patients/anamnesis.php';
} elseif (preg_match('/\/api\/patients\/(\d+)\/gallery/', $uri)) {
    require_once __DIR__ . '/patients/gallery.php';
} elseif (preg_match('/\/api\/patients\/(\d+)\/transcription\/start/', $uri)) {
    require_once __DIR__ . '/patients/transcription-start.php';
} elseif (preg_match('/\/api\/patients\/(\d+)\/transcription\/summary/', $uri)) {
    require_once __DIR__ . '/patients/transcription-summary.php';
} elseif (preg_match('/\/api\/patients\/(\d+)\/documents\/generate/', $uri)) {
    require_once __DIR__ . '/patients/documents-generate.php';
} elseif (preg_match('/\/api\/patients\/(\d+)/', $uri)) {
    require_once __DIR__ . '/patients/detail.php';
} elseif (preg_match('/\/api\/ai\/live-chats\/(.+)\/takeover/', $uri)) {
    require_once __DIR__ . '/ai/takeover.php';
} else {
    Response::notFound('Endpoint não encontrado: ' . $uri);
}
