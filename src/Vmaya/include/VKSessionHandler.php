<?
class VKSessionHandler {
    
    /**
     * Запуск сессии для VK Mini App
     */
    public static function startForVK(): string {
        // Получаем параметры из VK
        $initData = $_GET['tgWebAppInitData'] ?? '';
        
        if ($initData) {
            // Используем данные VK для создания стабильного session_id
            return self::startWithVKData($initData);
        } else {
            // Обычная сессия (для браузеров)
            return self::startNormal();
        }
    }
    
    /**
     * Создание session_id на основе данных VK
     */
    private static function startWithVKData(string $initData): string {
        // Парсим initData
        parse_str($initData, $parsed);
        
        // Получаем ID пользователя VK
        $userId = null;
        if (isset($parsed['user'])) {
            $userData = json_decode($parsed['user'], true);
            $userId = $userData['id'] ?? null;
        }
        
        // Создаем уникальный session_id на основе user_id и auth_date
        $authDate = $parsed['auth_date'] ?? time();
        $sessionId = self::generateVKSessionId($userId, $authDate);
        
        // Устанавливаем session_id
        session_id($sessionId);
        
        // Настраиваем куки для VK WebView
        self::configureVKCookies();
        
        // Стартуем сессию
        session_start();
        
        // Сохраняем данные VK в сессии
        if ($userId) {
            $_SESSION['vk_user_id'] = $userId;
            $_SESSION['vk_user_data'] = $userData;
            $_SESSION['vk_auth_date'] = $authDate;
            $_SESSION['vk_init_data'] = $parsed;
        }
        
        return $sessionId;
    }
    
    /**
     * Генерация стабильного session_id для VK
     */
    private static function generateVKSessionId($userId, $authDate): string {
        // Используем комбинацию user_id и auth_date
        $baseString = 'vk_' . ($userId ?? 'anonymous') . '_' . $authDate;
        
        // Добавляем соль из env
        $salt = $_ENV['VK_SESSION_SALT'] ?? 'default_salt';
        
        return hash('sha256', $baseString . $salt);
    }
    
    /**
     * Настройка кук для VK WebView
     */
    private static function configureVKCookies(): void {
        // Важно: для VK Mini Apps нужны особые настройки
        $isVK = self::isVKEnvironment();
        
        if ($isVK) {
            // Для VK
            session_set_cookie_params([
                'lifetime' => 86400 * 30, // 30 дней
                'path' => '/',
                'domain' => '', // Пустой domain для VK
                'secure' => true, // VK всегда использует HTTPS
                'httponly' => true,
                'samesite' => 'None' // Для кросс-сайтовых запросов
            ]);
            
            ini_set('session.cookie_samesite', 'None');
            ini_set('session.cookie_secure', '1');
        } else {
            // Для обычных браузеров
            session_set_cookie_params([
                'lifetime' => 86400 * 7,
                'path' => '/',
                'domain' => $_SERVER['HTTP_HOST'],
                'secure' => isset($_SERVER['HTTPS']),
                'httponly' => true,
                'samesite' => 'Lax'
            ]);
        }
    }
    
    /**
     * Определяем, работаем ли в VK Mini App
     */
    public static function isVKEnvironment(): bool {
        $checks = [
            !empty($_GET['tgWebAppPlatform']),
            !empty($_GET['tgWebAppInitData']),
            !empty($_GET['vk_access_token_settings']),
            !empty($_GET['vk_app_id']),
            !empty($_GET['vk_user_id']),
            strpos($_SERVER['HTTP_USER_AGENT'] ?? '', 'VK') !== false,
            strpos($_SERVER['HTTP_REFERER'] ?? '', 'vk.com') !== false
        ];
        
        return in_array(true, $checks, true);
    }
    
    /**
     * Обычный старт сессии
     */
    private static function startNormal(): string {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        return session_id();
    }
}

// Использование
$sessionId = VKSessionHandler::startForVK();