<?php

/**
 * Класс для статистики пользователя по фразам с анализом прогресса
 */
class UserPhraseStats {
    
    private mysqli $db;
    private int $userId;
    
    // Внутренние периоды для разбивки
    private const INNER_PERIODS = [
        'day' => 1,
        '3days' => 3,
        'week' => 7
    ];
    
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
     * Получить статистику с разбивкой по внутренним периодам
     * 
     * @param int $days Количество дней для анализа (минимум 7, максимум 90)
     * @return array Статистика с разбивкой по периодам
     * @throws InvalidArgumentException
     */
    public function getStatsWithProgress(int $days = 30): array {
        // Валидация
        if ($days < 7) {
            throw new InvalidArgumentException("Period must be at least 7 days");
        }
        if ($days > 90) {
            throw new InvalidArgumentException("Period must not exceed 90 days");
        }
        
        // Получаем все записи за указанный период
        $allRecords = $this->fetchRecords($days);
        
        if (empty($allRecords)) {
            return $this->emptyProgressResponse($days);
        }
        
        // Парсим записи
        $parsedRecords = $this->parseRecords($allRecords);
        
        // Разбиваем на внутренние периоды
        $periodsData = $this->splitIntoPeriods($parsedRecords, $days);
        
        // Рассчитываем статистику для каждого периода
        $progress = [];
        foreach ($periodsData as $periodName => $periodRecords) {
            $progress[$periodName] = $this->calculatePeriodStats($periodRecords);
        }
        
        // Добавляем общую статистику за весь период
        $overall = $this->calculatePeriodStats($parsedRecords);
        
        // Анализируем прогресс
        $trends = $this->analyzeProgress($progress);
        
        return [
            'total_days' => $days,
            'date_range' => [
                'from' => date('Y-m-d H:i:s', $parsedRecords[0]['timestamp']),
                'to' => date('Y-m-d H:i:s', $parsedRecords[count($parsedRecords)-1]['timestamp'])
            ],
            'total_records' => count($parsedRecords),
            'overall' => $overall,
            'progress_by_periods' => $progress,
            'trends' => $trends,
            'recommendations' => $this->generateRecommendations($trends, $overall)
        ];
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
     * @return array Распарсенные записи с добавленной датой
     */
    private function parseRecords(array $records): array {
        $parsed = [];
        
        foreach ($records as $record) {
            $data = json_decode($record['data'], true);
            $dbTime = strtotime($record['time']);
            
            if ($data && isset($data['time'], $data['type'], $data['pause'], $data['direction'])) {
                $parsed[] = [
                    'timestamp' => (int)($data['time'] / 1000), // из миллисекунд в секунды
                    'db_time' => $dbTime,
                    'time_ms' => (int)$data['time'],
                    'type' => trim($data['type']),
                    'pause' => (float)$data['pause'],
                    'direction' => $data['direction'],
                    'date' => date('Y-m-d', $dbTime)
                ];
            }
        }
        
        // Сортируем по времени
        usort($parsed, fn($a, $b) => $a['timestamp'] <=> $b['timestamp']);
        
        return $parsed;
    }
    
    /**
     * Разбить записи на внутренние периоды
     * 
     * @param array $records Все записи
     * @param int $totalDays Общий период
     * @return array Записи, сгруппированные по периодам
     */
    private function splitIntoPeriods(array $records, int $totalDays): array {
        $now = time();
        $startDate = $now - ($totalDays * 86400);
        
        $periods = [];
        
        // Создаем периоды от начала до конца для каждого типа внутреннего периода
        foreach (self::INNER_PERIODS as $periodName => $periodDays) {
            // Для каждого внутреннего периода создаем срезы
            for ($offset = 0; $offset < $totalDays; $offset += $periodDays) {
                $periodStart = $startDate + ($offset * 86400);
                $periodEnd = min($periodStart + ($periodDays * 86400), $now);
                
                $periodKey = $periodName . '_' . date('Y-m-d', $periodStart);
                
                // Инициализируем период с пустым массивом записей
                $periods[$periodKey] = [];
            }
        }
        
        // Распределяем записи по периодам
        foreach ($records as $record) {
            foreach (array_keys($periods) as $periodKey) {
                // Извлекаем дату из ключа периода
                $periodDate = substr($periodKey, strpos($periodKey, '_') + 1);
                $periodStart = strtotime($periodDate);
                
                // Определяем тип периода из ключа
                $periodType = substr($periodKey, 0, strpos($periodKey, '_'));
                $periodDays = self::INNER_PERIODS[$periodType];
                $periodEnd = $periodStart + ($periodDays * 86400);
                
                // Проверяем, попадает ли запись в этот период
                if ($record['timestamp'] >= $periodStart && $record['timestamp'] < $periodEnd) {
                    $periods[$periodKey][] = $record;
                    break; // Запись попала в период, выходим из цикла
                }
            }
        }
        
        // Фильтруем пустые периоды
        $result = [];
        foreach ($periods as $key => $periodRecords) {
            if (!empty($periodRecords)) {
                $result[$key] = $periodRecords;
            }
        }
        
        return $result;
    }
    
    /**
     * Рассчитать статистику для периода
     * 
     * @param array $records Записи периода
     * @return array Статистика
     */
    private function calculatePeriodStats(array $records): array {
        if (empty($records)) {
            return [
                'total' => 0,
                'by_type' => [],
                'avg_pause' => 0,
                'directions' => [],
                'intervals' => [
                    'avg' => 0,
                    'min' => 0,
                    'max' => 0
                ],
                'unique_types' => 0
            ];
        }
        
        // Рассчитываем интервалы (исключая БОЛЬШЕ 10 секунд)
        $intervals = [];
        for ($i = 1; $i < count($records); $i++) {
            $interval = $records[$i]['timestamp'] - $records[$i - 1]['timestamp'];
            if ($interval <= 10) { // ТОЛЬКО интервалы <= 10 секунд
                $intervals[] = $interval;
            }
        }
        
        // Группируем по типам
        $byType = [];
        $totalPause = 0;
        $directions = [];
        
        foreach ($records as $record) {
            $type = $record['type'];
            $direction = $record['direction'];
            
            if (!isset($byType[$type])) {
                $byType[$type] = [
                    'count' => 0,
                    'total_pause' => 0,
                    'directions' => []
                ];
            }
            
            $byType[$type]['count']++;
            $byType[$type]['total_pause'] += $record['pause'];
            $byType[$type]['directions'][$direction] = true;
            
            $totalPause += $record['pause'];
            $directions[$direction] = true;
        }
        
        // Рассчитываем средние для каждого типа
        foreach ($byType as &$typeData) {
            $typeData['avg_pause'] = round($typeData['total_pause'] / $typeData['count'], 2);
            $typeData['directions'] = array_keys($typeData['directions']);
            unset($typeData['total_pause']);
        }
        
        return [
            'total' => count($records),
            'by_type' => $byType,
            'avg_pause' => round($totalPause / count($records), 2),
            'directions' => array_keys($directions),
            'intervals' => [
                'avg' => !empty($intervals) ? round(array_sum($intervals) / count($intervals), 2) : 0,
                'min' => !empty($intervals) ? min($intervals) : 0,
                'max' => !empty($intervals) ? max($intervals) : 0,
                'count' => count($intervals)
            ],
            'unique_types' => count($byType)
        ];
    }
    
    /**
     * Анализировать прогресс по периодам
     * 
     * @param array $progress Статистика по периодам
     * @return array Тренды и прогресс
     */
    private function analyzeProgress(array $progress): array {
        if (count($progress) < 2) {
            return [
                'has_progress' => false,
                'message' => 'Недостаточно данных для анализа прогресса'
            ];
        }
        
        // Получаем первый и последний периоды для каждого типа внутреннего периода
        $trends = [];
        
        foreach (self::INNER_PERIODS as $periodName => $_) {
            $periodKeys = array_keys($progress);
            $firstKey = null;
            $lastKey = null;
            
            foreach ($periodKeys as $key) {
                if (strpos($key, $periodName) === 0) {
                    if ($firstKey === null) $firstKey = $key;
                    $lastKey = $key;
                }
            }
            
            if ($firstKey && $lastKey && $firstKey !== $lastKey) {
                $first = $progress[$firstKey];
                $last = $progress[$lastKey];
                
                // Анализируем изменения
                $totalChange = $last['total'] - $first['total'];
                $pauseChange = $last['avg_pause'] - $first['avg_pause'];
                $typesChange = $last['unique_types'] - $first['unique_types'];
                
                $trends[$periodName] = [
                    'periods_compared' => [
                        'first' => $firstKey,
                        'last' => $lastKey
                    ],
                    'total_change' => $totalChange,
                    'total_trend' => $totalChange > 0 ? 'up' : ($totalChange < 0 ? 'down' : 'stable'),
                    'pause_change' => round($pauseChange, 2),
                    'pause_trend' => $pauseChange < 0 ? 'improving' : ($pauseChange > 0 ? 'worsening' : 'stable'),
                    'types_change' => $typesChange,
                    'types_trend' => $typesChange > 0 ? 'expanding' : ($typesChange < 0 ? 'contracting' : 'stable'),
                    
                    // Дополнительный анализ по конкретным типам
                    'topics_evolution' => $this->analyzeTopicsEvolution(
                        $first['by_type'] ?? [],
                        $last['by_type'] ?? []
                    )
                ];
            }
        }
        
        return $trends;
    }
    
    /**
     * Анализ эволюции тем
     * 
     * @param array $first Первый период
     * @param array $last Последний период
     * @return array Эволюция тем
     */
    private function analyzeTopicsEvolution(array $first, array $last): array {
        $evolution = [];
        
        // Новые темы
        $newTopics = array_diff(array_keys($last), array_keys($first));
        foreach ($newTopics as $topic) {
            $evolution['new_topics'][] = [
                'topic' => $topic,
                'count' => $last[$topic]['count']
            ];
        }
        
        // Исчезнувшие темы
        $lostTopics = array_diff(array_keys($first), array_keys($last));
        foreach ($lostTopics as $topic) {
            $evolution['lost_topics'][] = [
                'topic' => $topic,
                'last_count' => $first[$topic]['count']
            ];
        }
        
        // Прогресс в существующих темах
        $commonTopics = array_intersect(array_keys($first), array_keys($last));
        foreach ($commonTopics as $topic) {
            $firstCount = $first[$topic]['count'];
            $lastCount = $last[$topic]['count'];
            $change = $lastCount - $firstCount;
            
            $evolution['existing_topics'][] = [
                'topic' => $topic,
                'first_count' => $firstCount,
                'last_count' => $lastCount,
                'change' => $change,
                'trend' => $change > 0 ? 'more_practice' : ($change < 0 ? 'less_practice' : 'stable'),
                'avg_pause_change' => round(
                    ($last[$topic]['avg_pause'] ?? 0) - ($first[$topic]['avg_pause'] ?? 0), 
                    2
                )
            ];
        }
        
        return $evolution;
    }
    
    /**
     * Генерация рекомендаций на основе трендов
     * 
     * @param array $trends Тренды
     * @param array $overall Общая статистика
     * @return array Рекомендации
     */
    private function generateRecommendations(array $trends, array $overall): array {
        $recommendations = [];
        
        // Анализ темпа занятий
        if ($overall['intervals']['avg'] < 3) {
            $recommendations[] = "Вы очень быстро переключаетесь между фразами (менее 3 сек). "
                . "Попробуйте делать небольшие паузы для лучшего усвоения.";
        } elseif ($overall['intervals']['avg'] > 8) {
            $recommendations[] = "Интервалы между фразами большие (>8 сек). "
                . "Постарайтесь поддерживать более ритмичный темп занятий.";
        }
        
        // Анализ разнообразия тем
        if ($overall['unique_types'] < 3) {
            $recommendations[] = "Вы фокусируетесь всего на {$overall['unique_types']} темах. "
                . "Рекомендуем расширить спектр изучаемых грамматических конструкций.";
        }
        
        // Анализ прогресса
        foreach ($trends as $period => $trend) {
            if (isset($trend['pause_trend']) && $trend['pause_trend'] === 'worsening') {
                $recommendations[] = "Время паузы увеличивается. "
                    . "Возможно, темы становятся сложнее - это нормально, продолжайте практиковаться.";
            }
            
            if (isset($trend['topics_evolution']['new_topics']) && 
                count($trend['topics_evolution']['new_topics']) > 0) {
                $newTopics = array_column($trend['topics_evolution']['new_topics'], 'topic');
                $recommendations[] = "Вы начали изучать новые темы: " . implode(', ', $newTopics) 
                    . ". Отличный прогресс!";
            }
        }
        
        return $recommendations;
    }
    
    /**
     * Пустой ответ для прогресса
     * 
     * @param int $days Запрошенный период
     * @return array Пустой результат
     */
    private function emptyProgressResponse(int $days): array {
        return [
            'total_days' => $days,
            'date_range' => [
                'from' => null,
                'to' => null
            ],
            'total_records' => 0,
            'overall' => $this->calculatePeriodStats([]),
            'progress_by_periods' => [],
            'trends' => [],
            'recommendations' => [
                'Недостаточно данных для анализа. Начните заниматься, чтобы увидеть прогресс!'
            ]
        ];
    }
    
    /**
     * Получить данные для LLM с прогрессом
     * 
     * @param int $days Количество дней
     * @return array Данные для промпта
     */
    public function getLLMProgressData(int $days = 30): array {
        $stats = $this->getStatsWithProgress($days);
        
        if ($stats['total_records'] === 0) {
            return [
                'has_data' => false,
                'message' => 'Нет данных за указанный период'
            ];
        }
        
        // Форматируем для LLM в соответствии с вашим промптом
        $llmData = [
            'period_days' => $days,
            'total_sessions' => $stats['overall']['total'],
            'avg_pause' => $stats['overall']['avg_pause'],
            'grammar_coverage' => $stats['overall']['unique_types'],
            'progress_timeline' => []
        ];
        
        // Строим временную линию прогресса
        foreach ($stats['progress_by_periods'] as $periodKey => $periodData) {
            if (preg_match('/^(day|3days|week)_/', $periodKey, $matches)) {
                $periodType = $matches[1];
                
                if (!isset($llmData['progress_timeline'][$periodType])) {
                    $llmData['progress_timeline'][$periodType] = [];
                }
                
                $topicData = [];
                foreach ($periodData['by_type'] as $topic => $data) {
                    $topicData[] = [
                        'topic' => $topic,
                        'attempts' => $data['count'],
                        'avg_pause' => $data['avg_pause']
                    ];
                }
                
                $llmData['progress_timeline'][$periodType][] = [
                    'period' => $periodKey,
                    'total_attempts' => $periodData['total'],
                    'avg_pause' => $periodData['avg_pause'],
                    'topics_practiced' => $periodData['unique_types'],
                    'by_topic' => $topicData
                ];
            }
        }
        
        // Добавляем тренды
        $llmData['trends'] = [];
        foreach ($stats['trends'] as $periodType => $trend) {
            if (is_array($trend) && isset($trend['total_trend'])) {
                $llmData['trends'][$periodType] = [
                    'activity_trend' => $trend['total_trend'],
                    'pause_trend' => $trend['pause_trend'],
                    'topics_trend' => $trend['types_trend']
                ];
            }
        }
        
        // Добавляем ключевые проблемы на основе данных
        $llmData['key_issues'] = $this->identifyKeyIssues($stats);
        
        // Добавляем рекомендации
        $llmData['recommendations'] = $stats['recommendations'];
        
        return $llmData;
    }
    
    /**
     * Выявление ключевых проблем
     * 
     * @param array $stats Статистика
     * @return array Проблемы
     */
    private function identifyKeyIssues(array $stats): array {
        $issues = [];
        
        // Проблема 1: Неравномерное распределение тем
        $topicCounts = [];
        foreach ($stats['overall']['by_type'] as $type => $data) {
            $topicCounts[] = $data['count'];
        }
        
        if (!empty($topicCounts)) {
            $max = max($topicCounts);
            $min = min($topicCounts);
            if ($max > $min * 3) {
                $issues[] = "Сильный перекос в практике: некоторые темы практикуются в 3+ раза чаще других";
            }
        }
        
        // Проблема 2: Растущее время паузы
        foreach ($stats['trends'] as $trend) {
            if (isset($trend['pause_trend']) && $trend['pause_trend'] === 'worsening') {
                $issues[] = "Время обдумывания увеличивается - возможно, сложность растет быстрее навыков";
                break;
            }
        }
        
        // Проблема 3: Мало направлений
        if (count($stats['overall']['directions']) < 2) {
            $issues[] = "Практика только в одном направлении ("
                . implode(', ', $stats['overall']['directions']) 
                . "). Рекомендуем чередовать оба направления для баланса навыков";
        }
        
        return $issues;
    }
}