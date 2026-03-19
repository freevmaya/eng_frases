<?php

/**
 * Класс для статистики пользователя по фразам с анализом по неделям
 */
class UserPhraseStats {
    
    private mysqli $db;
    private int $userId;
    
    /**
     * Конструктор
     * 
     * @param int $userId ID пользователя
     */
    public function __construct(int $userId) {
        global $dbp;
        $this->db = $dbp->Mysqli();
        $this->userId = $userId;
    }
    
    /**
     * Получить статистику с разбивкой по неделям
     * 
     * @param int $days Количество дней для анализа (минимум 7)
     * @return array Статистика с разбивкой по неделям
     * @throws InvalidArgumentException
     */
    public function getWeeklyStats(int $days = 30): array {
        // Валидация
        if ($days < 7) {
            throw new InvalidArgumentException("Period must be at least 7 days");
        }
        
        // Получаем все записи за указанный период
        $allRecords = $this->fetchRecords($days);
        
        if (empty($allRecords)) {
            return $this->emptyResponse($days);
        }
        
        // Парсим записи
        $parsedRecords = $this->parseRecords($allRecords);
        
        // Разбиваем на недели
        $weeklyData = $this->splitIntoWeeks($parsedRecords, $days);
        
        // Рассчитываем статистику для каждой недели
        $result = [
            'total_days' => $days,
            'total_records' => count($parsedRecords),
            'date_range' => [
                'from' => date('Y-m-d H:i:s', $parsedRecords[0]['timestamp']),
                'to' => date('Y-m-d H:i:s', $parsedRecords[count($parsedRecords)-1]['timestamp'])
            ],
            'weeks' => []
        ];
        
        foreach ($weeklyData as $weekKey => $weekRecords) {
            $result['weeks'][$weekKey] = $this->calculateWeekStats($weekRecords);
        }
        
        return $result;
    }
    
    /**
     * Получить записи из БД
     * 
     * @param int $days Количество дней
     * @return array Записи
     */
    private function fetchRecords(int $days): array {
        $sql = "SELECT data, time 
                FROM user_stat 
                WHERE user_id = ? 
                    AND name = 'cur_phrase'
                    AND time >= DATE_SUB(NOW(), INTERVAL ? DAY)
                ORDER BY time ASC";
                
        $stmt = $this->db->prepare($sql);
        $stmt->bind_param('ii', $this->userId, $days);
        $stmt->execute();
        $result = $stmt->get_result();
        
        $records = [];
        while ($row = $result->fetch_assoc()) {
            $records[] = $row;
        }
        
        $stmt->close();
        
        return $records;
    }
    
    /**
     * Парсинг JSON записей
     * 
     * @param array $records Сырые записи
     * @return array Распарсенные записи
     */
    private function parseRecords(array $records): array {
        $parsed = [];
        
        foreach ($records as $record) {
            $data = json_decode($record['data'], true);
            $dbTime = strtotime($record['time']);
            
            if ($data && isset($data['time'], $data['type'], $data['pause'], $data['direction'])) {
                $timestamp = (int)($data['time'] / 1000); // из миллисекунд в секунды
                
                $parsed[] = [
                    'timestamp' => $timestamp,
                    'datetime' => date('Y-m-d H:i:s', $timestamp),
                    'date' => date('Y-m-d', $timestamp),
                    'week' => $this->getWeekNumber($timestamp),
                    'type' => trim($data['type']),
                    'pause' => (float)$data['pause'],
                    'direction' => $data['direction']
                ];
            }
        }
        
        // Сортируем по времени
        usort($parsed, fn($a, $b) => $a['timestamp'] <=> $b['timestamp']);
        
        return $parsed;
    }
    
    /**
     * Получить номер недели для метки времени
     * 
     * @param int $timestamp
     * @return string Номер недели в формате "Y-W"
     */
    private function getWeekNumber(int $timestamp): string {
        return date('Y-W', $timestamp);
    }
    
    /**
     * Разбить записи на недели
     * 
     * @param array $records Все записи
     * @param int $totalDays Общий период
     * @return array Записи, сгруппированные по неделям
     */
    private function splitIntoWeeks(array $records, int $totalDays): array {
        $weeks = [];
        
        foreach ($records as $record) {
            $weekKey = $record['week'];
            
            if (!isset($weeks[$weekKey])) {
                $weeks[$weekKey] = [];
            }
            
            $weeks[$weekKey][] = $record;
        }
        
        // Сортируем недели по ключу
        ksort($weeks);
        
        return $weeks;
    }
    
    /**
     * Рассчитать статистику для недели
     * 
     * @param array $records Записи за неделю
     * @return array Статистика недели
     */
    private function calculateWeekStats(array $records): array {
        if (empty($records)) {
            return [
                'total' => 0,
                'avg_interval' => 0,
                'avg_pause' => 0,
                'types' => [],
                'directions' => [],
                'unique_types' => 0,
                'first_date' => null,
                'last_date' => null
            ];
        }
        
        // Рассчитываем интервалы между записями (<= 10 секунд)
        $intervals = [];
        for ($i = 1; $i < count($records); $i++) {
            $interval = $records[$i]['timestamp'] - $records[$i - 1]['timestamp'];
            if ($interval <= 10) {
                $intervals[] = $interval;
            }
        }
        
        // Собираем типы фраз и направления
        $types = [];
        $directions = [];
        $totalPause = 0;
        
        foreach ($records as $record) {
            $types[$record['type']] = true;
            $directions[$record['direction']] = true;
            $totalPause += $record['pause'];
        }
        
        $typesList = array_keys($types);
        $directionsList = array_keys($directions);
        
        return [
            'total' => count($records),
            'avg_interval' => !empty($intervals) ? round(array_sum($intervals) / count($intervals), 2) : 0,
            'avg_pause' => round($totalPause / count($records), 2),
            'types' => $typesList,
            'directions' => $directionsList,
            'unique_types' => count($typesList),
            'unique_directions' => count($directionsList),
            'first_date' => $records[0]['date'],
            'last_date' => $records[count($records)-1]['date']
        ];
    }
    
    /**
     * Пустой ответ
     * 
     * @param int $days Запрошенный период
     * @return array Пустой результат
     */
    private function emptyResponse(int $days): array {
        return [
            'total_days' => $days,
            'total_records' => 0,
            'date_range' => [
                'from' => null,
                'to' => null
            ],
            'weeks' => []
        ];
    }
    
    /**
     * Получить данные для LLM
     * 
     * @param int $days Количество дней
     * @return array Данные для промпта
     */
    public function getLLMData(int $days = 30): array {
        $stats = $this->getWeeklyStats($days);
        
        if ($stats['total_records'] === 0) {
            return [
                'has_data' => false,
                'message' => 'Нет данных за указанный период'
            ];
        }
        
        // Форматируем для LLM
        $llmData = [
            'period_days' => $days,
            'total_records' => $stats['total_records'],
            'weeks_count' => count($stats['weeks']),
            'weeks' => []
        ];
        
        foreach ($stats['weeks'] as $weekKey => $weekData) {
            // Разбираем ключ недели (2025-12)
            list($year, $weekNum) = explode('-', $weekKey);
            
            $llmData['weeks'][] = [
                'year' => (int)$year,
                'week' => (int)$weekNum,
                'period' => $weekData['first_date'] . ' - ' . $weekData['last_date'],
                'total_attempts' => $weekData['total'],
                'avg_interval' => $weekData['avg_interval'],
                'avg_pause' => $weekData['avg_pause'],
                'types' => $weekData['types'],
                'directions' => $weekData['directions'],
                'unique_types' => $weekData['unique_types']
            ];
        }
        
        return $llmData;
    }
    
    /**
     * Получить сводку по прогрессу (сравнение первой и последней недели)
     * 
     * @param int $days Количество дней
     * @return array Сводка прогресса
     */
    public function getProgressSummary(int $days = 30): array {
        $stats = $this->getWeeklyStats($days);
        
        if ($stats['total_records'] === 0 || count($stats['weeks']) < 2) {
            return [
                'has_progress' => false,
                'message' => 'Недостаточно данных для анализа прогресса'
            ];
        }
        
        $weeks = array_values($stats['weeks']);
        $firstWeek = $weeks[0];
        $lastWeek = $weeks[count($weeks) - 1];
        
        // Новые типы фраз
        $newTypes = array_diff($lastWeek['types'], $firstWeek['types']);
        
        // Типы, которые перестали практиковаться
        $lostTypes = array_diff($firstWeek['types'], $lastWeek['types']);
        
        return [
            'has_progress' => true,
            'first_week' => [
                'period' => $firstWeek['first_date'] . ' - ' . $firstWeek['last_date'],
                'total_attempts' => $firstWeek['total'],
                'avg_interval' => $firstWeek['avg_interval'],
                'avg_pause' => $firstWeek['avg_pause'],
                'types_count' => $firstWeek['unique_types']
            ],
            'last_week' => [
                'period' => $lastWeek['first_date'] . ' - ' . $lastWeek['last_date'],
                'total_attempts' => $lastWeek['total'],
                'avg_interval' => $lastWeek['avg_interval'],
                'avg_pause' => $lastWeek['avg_pause'],
                'types_count' => $lastWeek['unique_types']
            ],
            'changes' => [
                'attempts_change' => $lastWeek['total'] - $firstWeek['total'],
                'interval_change' => round($lastWeek['avg_interval'] - $firstWeek['avg_interval'], 2),
                'pause_change' => round($lastWeek['avg_pause'] - $firstWeek['avg_pause'], 2),
                'types_change' => $lastWeek['unique_types'] - $firstWeek['unique_types'],
                'new_types' => array_values($newTypes),
                'lost_types' => array_values($lostTypes)
            ],
            'trends' => [
                'activity' => $lastWeek['total'] > $firstWeek['total'] ? 'increasing' : ($lastWeek['total'] < $firstWeek['total'] ? 'decreasing' : 'stable'),
                'speed' => $lastWeek['avg_interval'] < $firstWeek['avg_interval'] ? 'faster' : ($lastWeek['avg_interval'] > $firstWeek['avg_interval'] ? 'slower' : 'stable'),
                'pause' => $lastWeek['avg_pause'] < $firstWeek['avg_pause'] ? 'improving' : ($lastWeek['avg_pause'] > $firstWeek['avg_pause'] ? 'worsening' : 'stable'),
                'diversity' => $lastWeek['unique_types'] > $firstWeek['unique_types'] ? 'expanding' : ($lastWeek['unique_types'] < $firstWeek['unique_types'] ? 'contracting' : 'stable')
            ]
        ];
    }
}

/**
 * Пример использования:
 */
/*
try {
    // Создаем объект статистики
    $stats = new UserPhraseStats(123);
    
    // Получаем статистику за 30 дней с разбивкой по неделям
    $weeklyStats = $stats->getWeeklyStats(30);
    
    // Получаем данные для LLM
    $llmData = $stats->getLLMData(30);
    
    // Получаем сводку прогресса
    $progressSummary = $stats->getProgressSummary(30);
    
    // Выводим результаты
    echo "<pre>";
    print_r($weeklyStats);
    print_r($llmData);
    print_r($progressSummary);
    echo "</pre>";
    
} catch (Exception $e) {
    echo "Ошибка: " . $e->getMessage();
}
*/