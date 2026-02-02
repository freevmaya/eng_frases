-- Последние 10 ошибок
SELECT 
    created_at,
    error_type,
    error_message,
    page_url,
    browser,
    device_type
FROM error_logs 
ORDER BY created_at DESC 
LIMIT 10;

-- Статистика ошибок по дням
SELECT 
    DATE(created_at) as day,
    COUNT(*) as total_errors,
    COUNT(DISTINCT session_id) as affected_sessions
FROM error_logs 
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY DATE(created_at)
ORDER BY day DESC;

-- Самые частые ошибки
SELECT 
    error_message,
    COUNT(*) as count,
    MIN(created_at) as first_seen,
    MAX(created_at) as last_seen
FROM error_logs 
GROUP BY error_message 
ORDER BY count DESC 
LIMIT 20;

-- Медленные запросы
SELECT 
    request_url,
    response_time,
    response_status,
    created_at
FROM http_logs 
WHERE response_time > 1000
ORDER BY response_time DESC 
LIMIT 20;