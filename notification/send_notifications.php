#!/usr/bin/env php
<?php
/**
 * Скрипт рассылки уведомлений ВКонтакте
 * Запуск по крону: * * * * * /usr/bin/php /path/to/send_notifications.php
 */


require_once '../src/Vmaya/engine.php';

define('VK_API_VERSION', '5.199');
define('BATCH_SIZE', 25); // Количество пользователей за один проход
define('SLEEP_TIME', 100000); // Микросекунды между батчами (0.1 сек)

class VKNotificationService
{
    private $pdo;
    private $token;
    private $apiVersion;
    private $batchSize;
    private $sleepTime;
    
    public function __construct($pdo, $token, $apiVersion, $batchSize, $sleepTime)
    {
        $this->pdo = $pdo;
        $this->token = $token;
        $this->apiVersion = $apiVersion;
        $this->batchSize = $batchSize;
        $this->sleepTime = $sleepTime;
    }
    
    /**
     * Запуск обработки уведомлений
     */
    public function run()
    {
        // Получаем активные уведомления (processed = 0)
        $notifications = $this->getActiveNotifications();
        
        foreach ($notifications as $notification) {
            $this->processNotification($notification);
        }
    }
    
    /**
     * Получение активных уведомлений
     */
    private function getActiveNotifications()
    {
        $stmt = $this->pdo->prepare("
            SELECT * FROM notifications 
            WHERE processed = 0 AND source = 'vk'
            ORDER BY submit_time ASC
            LIMIT 5
        ");
        $stmt->execute();
        return $stmt->fetchAll();
    }
    
    /**
     * Обработка одного уведомления
     */
    private function processNotification($notification)
    {
        $notificationId = $notification['id'];
        $usersIds = json_decode($notification['users_ids'], true);
        $sentUserIds = json_decode($notification['sent_user_ids'] ?? '[]', true);
        $errorUserIds = json_decode($notification['error_user_ids'] ?? '[]', true);
        
        // Определяем список пользователей для рассылки
        $targetUserIds = $this->getTargetUserIds($usersIds, $sentUserIds, $errorUserIds);
        
        if (empty($targetUserIds)) {
            // Все пользователи обработаны
            $this->completeNotification($notificationId);
            return;
        }
        
        // Берем следующую порцию пользователей
        $batchUserIds = array_slice($targetUserIds, 0, $this->batchSize);
        
        // Отправляем сообщения
        $results = $this->sendMessages($batchUserIds, $notification['message']);
        
        // Обновляем статусы
        $this->updateNotificationStatus(
            $notificationId,
            $sentUserIds,
            $errorUserIds,
            $results
        );
        
        // Задержка между батчами
        usleep($this->sleepTime);
    }
    
    /**
     * Получение списка пользователей для отправки
     */
    private function getTargetUserIds($usersIds, $sentUserIds, $errorUserIds)
    {
        $excludeIds = array_merge($sentUserIds, $errorUserIds);
        
        // Если [*] - все пользователи из таблицы users
        if ($usersIds === ['*']) {
            $stmt = $this->pdo->prepare("
                SELECT source_id FROM users 
                WHERE source = 'vk'
                ORDER BY id ASC
            ");
            $stmt->execute();
            $allUsers = $stmt->fetchAll(PDO::FETCH_COLUMN);
            return array_diff($allUsers, $excludeIds);
        }
        
        // Иначе - только указанные пользователи
        return array_diff($usersIds, $excludeIds);
    }
    
    /**
     * Отправка сообщений через VK API
     */
    private function sendMessages($userIds, $message)
    {
        $results = [
            'sent' => [],
            'errors' => []
        ];
        
        foreach ($userIds as $userId) {
            try {
                $response = $this->callVkApi('messages.send', [
                    'user_id' => $userId,
                    'message' => $message,
                    'random_id' => random_int(1, PHP_INT_MAX)
                ]);
                
                if (isset($response['response'])) {
                    $results['sent'][] = $userId;
                } else {
                    $results['errors'][] = $userId;
                    $this->logError($userId, $response);
                }
                
            } catch (Exception $e) {
                $results['errors'][] = $userId;
                $this->logError($userId, ['error' => $e->getMessage()]);
            }
            
            // Небольшая задержка между запросами
            usleep(50000); // 0.05 сек
        }
        
        return $results;
    }
    
    /**
     * Вызов VK API
     */
    private function callVkApi($method, $params = [])
    {
        $params['access_token'] = $this->token;
        $params['v'] = $this->apiVersion;

        trace($params);
        
        $url = "https://api.vk.com/method/{$method}?" . http_build_query($params);
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        
        if (curl_error($ch)) {
            throw new Exception('Curl error: ' . curl_error($ch));
        }
        
        if ($httpCode !== 200) {
            throw new Exception("HTTP error: {$httpCode}");
        }
        
        $data = json_decode($response, true);
        
        if (isset($data['error'])) {
            throw new Exception("VK API error: " . json_encode($data['error']));
        }
        
        return $data;
    }
    
    /**
     * Обновление статуса уведомления
     */
    private function updateNotificationStatus($notificationId, $sentUserIds, $errorUserIds, $results)
    {
        $newSentIds = array_merge($sentUserIds, $results['sent']);
        $newErrorIds = array_merge($errorUserIds, $results['errors']);
        
        $stmt = $this->pdo->prepare("
            UPDATE notifications 
            SET sent_user_ids = :sent_ids,
                error_user_ids = :error_ids
            WHERE id = :id
        ");
        
        $stmt->execute([
            ':id' => $notificationId,
            ':sent_ids' => json_encode($newSentIds, JSON_UNESCAPED_UNICODE),
            ':error_ids' => json_encode($newErrorIds, JSON_UNESCAPED_UNICODE)
        ]);
    }
    
    /**
     * Завершение уведомления
     */
    private function completeNotification($notificationId)
    {
        $stmt = $this->pdo->prepare("
            UPDATE notifications 
            SET processed = 1 
            WHERE id = :id
        ");
        $stmt->execute([':id' => $notificationId]);
        
        echo "Notification {$notificationId} completed\n";
    }
    
    /**
     * Логирование ошибок
     */
    private function logError($userId, $errorData)
    {
        $errorLog = date('Y-m-d H:i:s') . " | User: {$userId} | Error: " . json_encode($errorData) . PHP_EOL;
        file_put_contents(LOGPATH . '/vk_notification_errors.log', $errorLog, FILE_APPEND);
    }
}

try {
    $pdo = new PDO(
        "mysql:host=" . _dbhost . ";dbname=" . _dbname_default . ";charset=" . _db_charset,
        _dbuser,
        _dbpassword,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]
    );


    // Запуск сервиса
    $service = new VKNotificationService(
        $pdo,
        VK_API_TOKEN,
        VK_API_VERSION,
        BATCH_SIZE,
        SLEEP_TIME
    );

    $service->run();

    echo "Notification processing completed at " . date('Y-m-d H:i:s') . "\n";

} catch (PDOException $e) {
    // В консольном скрипте лучше выводить ошибку и завершать работу
    die("Connection failed: " . $e->getMessage() . "\n");
}