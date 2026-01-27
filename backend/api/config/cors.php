<?php
/**
 * StackClinic - CORS Configuration
 * This file must be included at the very beginning of each API endpoint
 */

// Set error handling to prevent HTML output
ini_set('display_errors', 0);
error_reporting(E_ALL);

// Set CORS headers before anything else
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With, X-Auth-Token");

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Custom error handler to return JSON errors
set_error_handler(function($severity, $message, $file, $line) {
    throw new ErrorException($message, 0, $severity, $file, $line);
});

// Custom exception handler
set_exception_handler(function($exception) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Erro interno do servidor',
        'debug' => $exception->getMessage()
    ]);
    exit();
});
