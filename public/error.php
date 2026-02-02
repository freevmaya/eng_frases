<?php

require dirname(__FILE__, 2).'/src/Vmaya/engine.php';

class ErrorLoggerDB {
    private $pdo;
    
    public function __construct() {
        $dsn = "mysql:host=" . _dbhost . ";dbname=" . _dbname_default . ";charset=" . _db_charset;
        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false
        ];
    
        try {
            $this->pdo = new PDO($dsn, _dbuser, _dbpassword, $options);
            $this->pdo->exec("SET NAMES "._db_charset." COLLATE "._db_charset."_unicode_ci");
        } catch (PDOException $e) {
            trace_error("Database connection failed: " . $e->getMessage());
            throw $e;
        }
    }
    
    /**
     * Сохранение ошибки из браузера
     */
    public function saveClientError($data) {
        $sql = "INSERT INTO error_logs (
            error_type, error_message, error_stack, error_file, error_line, error_column,
            error_context, severity, user_id, session_id, app_id, user_agent, browser,
            browser_version, os, device_type, platform, language, page_url, referrer_url,
            viewport_size, load_time, memory_usage, connection_type, effective_type,
            downlink, rtt, tags, client_timestamp
        ) VALUES (
            :error_type, :error_message, :error_stack, :error_file, :error_line, :error_column,
            :error_context, :severity, :user_id, :session_id, :app_id, :user_agent, :browser,
            :browser_version, :os, :device_type, :platform, :language, :page_url, :referrer_url,
            :viewport_size, :load_time, :memory_usage, :connection_type, :effective_type,
            :downlink, :rtt, :tags, :client_timestamp
        )";
        
        try {
            $stmt = $this->pdo->prepare($sql);
            
            // Подготовка данных
            $error_context = isset($data['context']) ? json_encode($data['context'], JSON_UNESCAPED_UNICODE) : null;
            $tags = isset($data['tags']) ? json_encode($data['tags'], JSON_UNESCAPED_UNICODE) : null;
            
            // Определение устройства
            $device_type = $this->detectDeviceType($data['user_agent'] ?? '');
            
            $stmt->execute([
                ':error_type' => $data['type'] ?? 'unknown',
                ':error_message' => $this->truncateString($data['message'] ?? '', 1000),
                ':error_stack' => $data['stack'] ?? null,
                ':error_file' => $data['filename'] ?? $data['file'] ?? null,
                ':error_line' => $data['lineno'] ?? $data['line'] ?? null,
                ':error_column' => $data['colno'] ?? $data['column'] ?? null,
                ':error_context' => $error_context,
                ':severity' => $data['severity'] ?? 'error',
                ':user_id' => $data['userId'] ?? $data['user_id'] ?? null,
                ':session_id' => $data['sessionId'] ?? $data['session_id'] ?? null,
                ':app_id' => $data['appId'] ?? $data['app_id'] ?? 'web-app',
                ':user_agent' => $data['userAgent'] ?? $data['user_agent'] ?? '',
                ':browser' => $this->parseBrowser($data['user_agent'] ?? ''),
                ':browser_version' => $this->parseBrowserVersion($data['user_agent'] ?? ''),
                ':os' => $this->parseOS($data['user_agent'] ?? ''),
                ':device_type' => $device_type,
                ':platform' => $data['platform'] ?? '',
                ':language' => $data['language'] ?? '',
                ':page_url' => $data['url'] ?? $data['page_url'] ?? '',
                ':referrer_url' => $data['referrer'] ?? $data['referrer_url'] ?? '',
                ':viewport_size' => $data['viewport'] ?? $data['viewport_size'] ?? '',
                ':load_time' => $data['loadTime'] ?? $data['load_time'] ?? null,
                ':memory_usage' => $data['memoryUsage'] ?? $data['memory_usage'] ?? null,
                ':connection_type' => $data['connectionType'] ?? $data['connection_type'] ?? null,
                ':effective_type' => $data['effectiveType'] ?? $data['effective_type'] ?? null,
                ':downlink' => $data['downlink'] ?? null,
                ':rtt' => $data['rtt'] ?? null,
                ':tags' => $tags,
                ':client_timestamp' => $data['timestamp'] ?? time() * 1000
            ]);
            
            return $this->pdo->lastInsertId();
            
        } catch (PDOException $e) {
            trace_error("Failed to save error log: " . $e->getMessage());
            
            // Fallback: запись в файл
            $this->saveToFile($data);
            return false;
        }
    }
    
    /**
     * Сохранение HTTP лога
     */
    public function saveHttpLog($data) {
        $sql = "INSERT INTO http_logs (
            request_method, request_url, request_headers, request_body, query_params,
            response_status, response_headers, response_body, response_size,
            response_time, db_query_time, memory_peak_usage,
            error_message, error_stack, error_code,
            user_id, session_id, ip_address, user_agent,
            controller, action, route_name, started_at
        ) VALUES (
            :method, :url, :req_headers, :req_body, :query_params,
            :status, :res_headers, :res_body, :res_size,
            :response_time, :db_time, :memory_peak,
            :error_msg, :error_stack, :error_code,
            :user_id, :session_id, :ip, :user_agent,
            :controller, :action, :route, :started_at
        )";
        
        try {
            $stmt = $this->pdo->prepare($sql);
            
            $stmt->execute([
                ':method' => $data['method'] ?? 'GET',
                ':url' => $data['url'] ?? '',
                ':req_headers' => isset($data['request_headers']) ? json_encode($data['request_headers'], JSON_UNESCAPED_UNICODE) : null,
                ':req_body' => isset($data['request_body']) ? $this->truncateString($data['request_body'], 5000) : null,
                ':query_params' => isset($data['query_params']) ? json_encode($data['query_params'], JSON_UNESCAPED_UNICODE) : null,
                ':status' => $data['status'] ?? 200,
                ':res_headers' => isset($data['response_headers']) ? json_encode($data['response_headers'], JSON_UNESCAPED_UNICODE) : null,
                ':res_body' => isset($data['response_body']) ? $this->truncateString($data['response_body'], 10000) : null,
                ':res_size' => $data['response_size'] ?? null,
                ':response_time' => $data['response_time'] ?? 0,
                ':db_time' => $data['db_query_time'] ?? null,
                ':memory_peak' => $data['memory_peak_usage'] ?? null,
                ':error_msg' => $data['error_message'] ?? null,
                ':error_stack' => $data['error_stack'] ?? null,
                ':error_code' => $data['error_code'] ?? null,
                ':user_id' => $data['user_id'] ?? null,
                ':session_id' => $data['session_id'] ?? null,
                ':ip' => $data['ip_address'] ?? $_SERVER['REMOTE_ADDR'] ?? null,
                ':user_agent' => $data['user_agent'] ?? $_SERVER['HTTP_USER_AGENT'] ?? '',
                ':controller' => $data['controller'] ?? null,
                ':action' => $data['action'] ?? null,
                ':route' => $data['route_name'] ?? null,
                ':started_at' => isset($data['started_at']) ? date('Y-m-d H:i:s', $data['started_at'] / 1000) : null
            ]);
            
            return $this->pdo->lastInsertId();
            
        } catch (PDOException $e) {
            trace_error("Failed to save HTTP log: " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Получение статистики ошибок
     */
    public function getErrorStats($startDate, $endDate) {
        $sql = "SELECT 
            DATE(created_at) as date,
            COUNT(*) as total_errors,
            SUM(CASE WHEN severity = 'error' THEN 1 ELSE 0 END) as errors,
            SUM(CASE WHEN severity = 'warning' THEN 1 ELSE 0 END) as warnings,
            error_type,
            browser,
            device_type
        FROM error_logs 
        WHERE created_at BETWEEN :start_date AND :end_date
        GROUP BY DATE(created_at), error_type, browser, device_type
        ORDER BY date DESC, total_errors DESC";
        
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([
            ':start_date' => $startDate,
            ':end_date' => $endDate
        ]);
        
        return $stmt->fetchAll();
    }
    
    /**
     * Получение частых ошибок
     */
    public function getFrequentErrors($limit = 10) {
        $sql = "SELECT 
            error_message,
            error_type,
            COUNT(*) as occurrence_count,
            MIN(created_at) as first_occurrence,
            MAX(created_at) as last_occurrence
        FROM error_logs 
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        GROUP BY error_message, error_type
        ORDER BY occurrence_count DESC
        LIMIT :limit";
        
        $stmt = $this->pdo->prepare($sql);
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->execute();
        
        return $stmt->fetchAll();
    }
    
    /**
     * Очистка старых логов
     */
    public function cleanupOldLogs($days = 30) {
        $tables = ['error_logs', 'http_logs', 'performance_logs', 'custom_events'];
        
        foreach ($tables as $table) {
            $sql = "DELETE FROM {$table} WHERE created_at < DATE_SUB(NOW(), INTERVAL :days DAY)";
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([':days' => $days]);
            
            $deleted = $stmt->rowCount();
            trace_error("Cleaned up {$deleted} rows from {$table}");
        }
        
        // Оптимизация таблиц
        foreach ($tables as $table) {
            $this->pdo->exec("OPTIMIZE TABLE {$table}");
        }
    }
    
    // Вспомогательные методы
    
    private function detectDeviceType($user_agent) {
        $user_agent = strtolower($user_agent);
        
        if (strpos($user_agent, 'mobile') !== false) {
            return 'mobile';
        } elseif (strpos($user_agent, 'tablet') !== false || strpos($user_agent, 'ipad') !== false) {
            return 'tablet';
        } else {
            return 'desktop';
        }
    }
    
    private function parseBrowser($user_agent) {
        if (strpos($user_agent, 'Chrome') !== false) return 'Chrome';
        if (strpos($user_agent, 'Firefox') !== false) return 'Firefox';
        if (strpos($user_agent, 'Safari') !== false) return 'Safari';
        if (strpos($user_agent, 'Edge') !== false) return 'Edge';
        if (strpos($user_agent, 'MSIE') !== false || strpos($user_agent, 'Trident') !== false) return 'IE';
        return 'Other';
    }
    
    private function parseBrowserVersion($user_agent) {
        // Упрощенный парсинг версии
        preg_match('/(Chrome|Firefox|Safari|Edge|MSIE|Version)[\/ ]([0-9.]+)/', $user_agent, $matches);
        return $matches[2] ?? null;
    }
    
    private function parseOS($user_agent) {
        if (strpos($user_agent, 'Windows') !== false) return 'Windows';
        if (strpos($user_agent, 'Mac') !== false) return 'macOS';
        if (strpos($user_agent, 'Linux') !== false) return 'Linux';
        if (strpos($user_agent, 'Android') !== false) return 'Android';
        if (strpos($user_agent, 'iOS') !== false || strpos($user_agent, 'iPhone') !== false) return 'iOS';
        return 'Unknown';
    }
    
    private function truncateString($string, $length) {
        if (mb_strlen($string, 'UTF-8') > $length) {
            return mb_substr($string, 0, $length - 3, 'UTF-8') . '...';
        }
        return $string;
    }
    
    private function saveToFile($data) {
        $logDir = __DIR__ . '/../logs/';
        if (!is_dir($logDir)) {
            mkdir($logDir, 0755, true);
        }
        
        $logFile = $logDir . 'errors_' . date('Y-m-d') . '.log';
        $logEntry = date('Y-m-d H:i:s') . " - " . json_encode($data, JSON_UNESCAPED_UNICODE) . PHP_EOL;
        
        file_put_contents($logFile, $logEntry, FILE_APPEND | LOCK_EX);
    }
}

// API endpoint для приема логов
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    header('Content-Type: application/json');
    
    try {
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new Exception('Invalid JSON');
        }

        try {
            
            $logger = new ErrorLoggerDB();
            $result = $logger->saveClientError($input);
        } catch (Exception $e) {
            trace_error($e);
        }
        
        if ($result) {
            echo json_encode(['success' => true, 'id' => $result]);
        } else {
            echo json_encode(['success' => false, 'error' => 'Failed to save log']);
        }
        
    } catch (Exception $e) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
    
    exit;
}