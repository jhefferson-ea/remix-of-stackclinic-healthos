<?php
/**
 * StackClinic - Response Helper
 */

class Response {
    public static function json($data, $statusCode = 200) {
        http_response_code($statusCode);
        echo json_encode($data, JSON_UNESCAPED_UNICODE);
        exit();
    }

    public static function success($data, $message = null) {
        $response = ['success' => true, 'data' => $data];
        if ($message) {
            $response['message'] = $message;
        }
        self::json($response);
    }

    public static function error($message, $statusCode = 400) {
        self::json([
            'success' => false,
            'error' => $message
        ], $statusCode);
    }

    public static function notFound($message = 'Recurso não encontrado') {
        self::error($message, 404);
    }

    public static function unauthorized($message = 'Não autorizado') {
        self::error($message, 401);
    }

    public static function serverError($message = 'Erro interno do servidor') {
        self::error($message, 500);
    }

    public static function badRequest($message = 'Requisição inválida') {
        self::error($message, 400);
    }

    public static function methodNotAllowed($message = 'Método não permitido') {
        self::error($message, 405);
    }
}
