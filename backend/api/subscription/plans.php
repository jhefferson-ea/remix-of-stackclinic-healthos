<?php
/**
 * StackClinic API - Subscription Plans
 * GET /api/subscription/plans
 */

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../helpers/Response.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    Response::methodNotAllowed();
}

// Planos disponíveis (por enquanto estáticos)
$plans = [
    [
        'id' => 'basic',
        'name' => 'Basic',
        'price' => 149.90,
        'billing' => 'monthly',
        'features' => [
            'Até 100 pacientes',
            'Agenda básica',
            'Lembretes via WhatsApp',
            '1 usuário',
            'Suporte por email'
        ],
        'popular' => false
    ],
    [
        'id' => 'professional',
        'name' => 'Professional',
        'price' => 299.90,
        'billing' => 'monthly',
        'features' => [
            'Pacientes ilimitados',
            'Agenda inteligente com IA',
            'Lembretes + Confirmações automáticas',
            'Até 5 usuários',
            'Financeiro completo',
            'Marketing & CRM',
            'Suporte prioritário'
        ],
        'popular' => true
    ],
    [
        'id' => 'enterprise',
        'name' => 'Enterprise',
        'price' => 599.90,
        'billing' => 'monthly',
        'features' => [
            'Tudo do Professional',
            'Usuários ilimitados',
            'Multi-clínicas',
            'API personalizada',
            'Integrações avançadas',
            'Gerente de conta dedicado',
            'SLA garantido'
        ],
        'popular' => false
    ]
];

Response::success($plans);
