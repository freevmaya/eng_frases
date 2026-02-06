<?
class SessionManager {
    
    public static function start() {
        // Определяем протокол
        $protocol = self::detectProtocol();
        
        // Базовые настройки
        $cookieParams = [
            'lifetime' => 86400 * 30, // 30 дней
            'path' => '/',
            'domain' => self::getDomain(),
            'secure' => ($protocol === 'https'),
            'httponly' => true,
            'samesite' => ($protocol === 'https') ? 'None' : 'Lax'
        ];
        
        // Применяем настройки
        session_set_cookie_params($cookieParams);
        
        // Дополнительные настройки
        ini_set('session.cookie_secure', $cookieParams['secure'] ? '1' : '0');
        ini_set('session.cookie_samesite', $cookieParams['samesite']);
        ini_set('session.cookie_httponly', '1');
        ini_set('session.use_only_cookies', '1');
        ini_set('session.use_strict_mode', '1');
        ini_set('session.use_trans_sid', '0'); // Отключаем передачу в URL
        
        // Стартуем сессию
        session_start();
        
        // Регенерируем ID для безопасности
        if (empty($_SESSION['created_at'])) {
            $_SESSION['created_at'] = time();
            session_regenerate_id(true);
        }
        
        // Логирование для отладки
        self::logSession();
    }
    
    private static function detectProtocol(): string {
        $isHttps = false;
        
        // Все возможные способы проверки
        $checks = [
            'HTTPS' => isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on',
            'HTTP_X_FORWARDED_PROTO' => isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && 
                                       $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https',
            'HTTP_X_FORWARDED_SSL' => isset($_SERVER['HTTP_X_FORWARDED_SSL']) && 
                                     $_SERVER['HTTP_X_FORWARDED_SSL'] === 'on',
            'REQUEST_SCHEME' => isset($_SERVER['REQUEST_SCHEME']) && 
                               $_SERVER['REQUEST_SCHEME'] === 'https',
            'SERVER_PORT' => isset($_SERVER['SERVER_PORT']) && 
                            $_SERVER['SERVER_PORT'] == 443,
            'HTTP_CF_VISITOR' => isset($_SERVER['HTTP_CF_VISITOR']) && 
                                strpos($_SERVER['HTTP_CF_VISITOR'], 'https') !== false,
        ];
        
        foreach ($checks as $check) {
            if ($check) {
                $isHttps = true;
                break;
            }
        }
        
        return $isHttps ? 'https' : 'http';
    }
    
    private static function getDomain(): string {
        $domain = $_SERVER['HTTP_HOST'];
        
        // Убираем порт если есть
        if (strpos($domain, ':') !== false) {
            $domain = substr($domain, 0, strpos($domain, ':'));
        }
        
        // Для локального development
        if ($domain === 'localhost' || substr($domain, -10) === '.localhost') {
            return '';
        }
        
        return $domain;
    }
    
    private static function logSession() {
        if (isset($_GET['debug_session'])) {
            error_log('Session started: ' . json_encode([
                'id' => session_id(),
                'protocol' => self::detectProtocol(),
                'cookie_params' => session_get_cookie_params(),
                'client_ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown'
            ]));
        }
    }
}

// Использование
// SessionManager::start();