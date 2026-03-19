<?php

/**
 * Класс для статистики пользователя по фразам с анализом по неделям
 */
class UserPhraseStats {
    
    private mysqli $db;
    private int $userId;
    
    // Константы для типов направлений
    private const DIRECTION_LISTENING = 'listening'; // target-native (английский -> русский)
    private const DIRECTION_SPEAKING = 'speaking';   // native-target (русский -> английский)
    private const DIRECTION_QUIZ = 'quiz';
    private const DIRECTION_DIALOG_PREPARE = 'dialog_prepare';
    private const DIRECTION_DIALOG_EXAM = 'dialog_exam';
    private const DIRECTION_BOTH = 'both'; // смешанные типы
    
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
                'directions_classified' => $weekData['directions_classified'],
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
                'types_count' => $firstWeek['unique_types'],
                'directions' => $firstWeek['directions_classified']
            ],
            'last_week' => [
                'period' => $lastWeek['first_date'] . ' - ' . $lastWeek['last_date'],
                'total_attempts' => $lastWeek['total'],
                'avg_interval' => $lastWeek['avg_interval'],
                'avg_pause' => $lastWeek['avg_pause'],
                'types_count' => $lastWeek['unique_types'],
                'directions' => $lastWeek['directions_classified']
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
    
    /**
     * Получить человеко-читаемый отчет о прогрессе
     * 
     * @param int $days Количество дней для анализа
     * @return array Отчет с прогрессом и рекомендацией
     */
    public function getHumanReadableProgress(int $days = 30): array {
        $stats = $this->getWeeklyStats($days);
        
        if ($stats['total_records'] === 0) {
            return [
                'success' => false,
                'message' => '😢 За этот период у вас пока нет занятий. Самое время начать!',
                'progress' => null,
                'recommendation' => 'Попробуйте позаниматься хотя бы 10-15 минут сегодня.'
            ];
        }
        
        if (count($stats['weeks']) < 2) {
            // Только одна неделя данных
            $weekData = reset($stats['weeks']); // первая (и единственная) неделя
            
            return [
                'success' => true,
                'message' => $this->formatWeekSummary($weekData, $stats['total_records']),
                'progress' => null,
                'recommendation' => $this->generateSingleWeekRecommendation($weekData)
            ];
        }
        
        // Сравниваем первую и последнюю неделю
        $weeks = array_values($stats['weeks']);
        $firstWeek = $weeks[0];
        $lastWeek = $weeks[count($weeks) - 1];
        
        // Вычисляем изменения в процентах
        $changes = [
            'attempts' => $this->calculateChange($lastWeek['total'], $firstWeek['total']),
            'interval' => $this->calculateChange($lastWeek['avg_interval'], $firstWeek['avg_interval'], true),
            'pause' => $this->calculateChange($lastWeek['avg_pause'], $firstWeek['avg_pause'], true),
            'diversity' => $this->calculateChange($lastWeek['unique_types'], $firstWeek['unique_types'])
        ];
        
        // Формируем текстовое описание прогресса
        $progressText = $this->formatProgressText($changes, $firstWeek, $lastWeek);
        
        // Генерируем рекомендацию
        $recommendation = $this->generateRecommendation($changes, $lastWeek);
        
        // Формируем структурированный отчет
        return [
            'success' => true,
            'message' => $progressText,
            'progress' => [
                'first_week' => [
                    'period' => $firstWeek['first_date'] . ' - ' . $firstWeek['last_date'],
                    'attempts' => $firstWeek['total'],
                    'avg_interval' => $firstWeek['avg_interval'] . ' сек',
                    'avg_pause' => $firstWeek['avg_pause'] . ' сек',
                    'topics' => $firstWeek['unique_types']
                ],
                'last_week' => [
                    'period' => $lastWeek['first_date'] . ' - ' . $lastWeek['last_date'],
                    'attempts' => $lastWeek['total'],
                    'avg_interval' => $lastWeek['avg_interval'] . ' сек',
                    'avg_pause' => $lastWeek['avg_pause'] . ' сек',
                    'topics' => $lastWeek['unique_types']
                ],
                'changes' => [
                    'attempts' => $this->formatChangeWithArrow($changes['attempts']),
                    'interval' => $this->formatChangeWithArrow($changes['interval'], true),
                    'pause' => $this->formatChangeWithArrow($changes['pause'], true),
                    'diversity' => $this->formatChangeWithArrow($changes['diversity']),
                    'new_topics' => $this->getNewTopics($firstWeek, $lastWeek),
                    'lost_topics' => $this->getLostTopics($firstWeek, $lastWeek)
                ]
            ],
            'recommendation' => $recommendation,
            'summary' => $this->getQuickSummary($changes, $lastWeek)
        ];
    }
    
    /**
     * Классифицировать направление
     * 
     * @param string $direction
     * @return array ['type' => string, 'label' => string, 'emoji' => string]
     */
    private function classifyDirection(string $direction): array {
        // Аудирование (английский -> русский)
        if (in_array($direction, ['target-native', 'target-native-both', 'target2-native-both'])) {
            return [
                'type' => self::DIRECTION_LISTENING,
                'label' => 'аудирование',
                'emoji' => '👂'
            ];
        }
        
        // Говорение (русский -> английский)
        if (in_array($direction, ['native-target', 'native-target2', 'native-target-both', 'native-target2-both'])) {
            return [
                'type' => self::DIRECTION_SPEAKING,
                'label' => 'говорение',
                'emoji' => '🗣️'
            ];
        }
        
        // Смешанные типы (и аудирование и говорение)
        if (in_array($direction, ['target2-native-target-both'])) {
            return [
                'type' => self::DIRECTION_BOTH,
                'label' => 'аудирование + говорение',
                'emoji' => '🔄'
            ];
        }
        
        // Квиз
        if ($direction === 'quiz') {
            return [
                'type' => self::DIRECTION_QUIZ,
                'label' => 'квиз',
                'emoji' => '❓'
            ];
        }
        
        // Диалоги
        if ($direction === 'dialog_prepare') {
            return [
                'type' => self::DIRECTION_DIALOG_PREPARE,
                'label' => 'подготовка к диалогу',
                'emoji' => '📝'
            ];
        }
        
        if ($direction === 'dialog_exam') {
            return [
                'type' => self::DIRECTION_DIALOG_EXAM,
                'label' => 'диалог',
                'emoji' => '💬'
            ];
        }
        
        // По умолчанию
        return [
            'type' => 'unknown',
            'label' => $direction,
            'emoji' => '❓'
        ];
    }
    
    /**
     * Получить статистику направлений
     * 
     * @param array $records
     * @return array
     */
    private function getDirectionsStats(array $records): array {
        $stats = [
            'raw' => [],
            'classified' => [],
            'counts' => [
                self::DIRECTION_LISTENING => 0,
                self::DIRECTION_SPEAKING => 0,
                self::DIRECTION_QUIZ => 0,
                self::DIRECTION_DIALOG_PREPARE => 0,
                self::DIRECTION_DIALOG_EXAM => 0,
                self::DIRECTION_BOTH => 0,
                'unknown' => 0
            ]
        ];
        
        foreach ($records as $record) {
            $direction = $record['direction'];
            $classified = $this->classifyDirection($direction);
            
            $stats['raw'][$direction] = true;
            $stats['classified'][$classified['type']] = $classified;
            $stats['counts'][$classified['type']]++;
        }
        
        return $stats;
    }
    
    /**
     * Форматировать summary одной недели
     */
    private function formatWeekSummary(array $weekData, int $totalRecords): string {
        $daysActive = count(array_unique(array_column($weekData['records'] ?? [], 'date')));
        
        $parts = [];
        $parts[] = "📊 За этот период вы выполнили {$totalRecords} упражнений";
        $parts[] = "📝 Изучали " . $this->pluralize($weekData['unique_types'], 'тему', 'темы', 'тем');
        $parts[] = "⏱ Среднее время на фразу: {$weekData['avg_interval']} сек";
        $parts[] = "🤔 Средняя пауза: {$weekData['avg_pause']} сек";
        
        if (!empty($weekData['directions_classified']['counts'])) {
            $practice = [];
            if ($weekData['directions_classified']['counts'][self::DIRECTION_LISTENING] > 0) {
                $practice[] = '👂 аудирование';
            }
            if ($weekData['directions_classified']['counts'][self::DIRECTION_SPEAKING] > 0) {
                $practice[] = '🗣️ говорение';
            }
            if ($weekData['directions_classified']['counts'][self::DIRECTION_QUIZ] > 0) {
                $practice[] = '❓ квизы';
            }
            if ($weekData['directions_classified']['counts'][self::DIRECTION_DIALOG_PREPARE] > 0) {
                $practice[] = '📝 подготовка диалогов';
            }
            if ($weekData['directions_classified']['counts'][self::DIRECTION_DIALOG_EXAM] > 0) {
                $practice[] = '💬 диалоги';
            }
            if ($weekData['directions_classified']['counts'][self::DIRECTION_BOTH] > 0) {
                $practice[] = '🔄 смешанные';
            }
            
            if (!empty($practice)) {
                $parts[] = "🎯 Практиковали: " . implode(', ', $practice);
            }
        }
        
        return implode("\n", $parts);
    }
    
    /**
     * Сгенерировать рекомендацию для одной недели
     */
    private function generateSingleWeekRecommendation(array $weekData): string {
        $recs = [];
        
        if ($weekData['total'] < 20) {
            $recs[] = "• 🎯 Старайтесь заниматься чаще. Даже 10-15 минут в день дают прогресс";
        }
        
        if ($weekData['unique_types'] < 3) {
            $recs[] = "• 📚 Попробуйте добавлять новые темы. Вы фокусируетесь всего на " . 
                      $this->pluralize($weekData['unique_types'], 'теме', 'темах', 'темах');
        }
        
        if ($weekData['avg_interval'] < 3) {
            $recs[] = "• ⚡ Вы очень быстро переключаетесь. Делайте микропаузы между фразами";
        } elseif ($weekData['avg_interval'] > 8) {
            $recs[] = "• 🐢 Темп занятий низкий. Постарайтесь отвечать чуть быстрее";
        }
        
        // Анализ направлений
        $hasListening = $weekData['directions_classified']['counts'][self::DIRECTION_LISTENING] > 0;
        $hasSpeaking = $weekData['directions_classified']['counts'][self::DIRECTION_SPEAKING] > 0;
        $hasQuiz = $weekData['directions_classified']['counts'][self::DIRECTION_QUIZ] > 0;
        $hasDialog = $weekData['directions_classified']['counts'][self::DIRECTION_DIALOG_EXAM] > 0 ||
                     $weekData['directions_classified']['counts'][self::DIRECTION_DIALOG_PREPARE] > 0;
        
        if (!$hasListening && !$hasSpeaking) {
            $recs[] = "• 🎯 Попробуйте основные режимы: аудирование и говорение";
        } elseif (!$hasListening) {
            $recs[] = "• 👂 Добавьте практику аудирования (английский → русский)";
        } elseif (!$hasSpeaking) {
            $recs[] = "• 🗣️ Добавьте практику говорения (русский → английский)";
        }
        
        if (!$hasQuiz && $weekData['total'] > 50) {
            $recs[] = "• ❓ Попробуйте режим викторины для закрепления материала";
        }
        
        if (!$hasDialog && $weekData['total'] > 100) {
            $recs[] = "• 💬 Когда освоитесь, попробуйте диалоги для реальной практики";
        }
        
        if (empty($recs)) {
            $recs[] = "• 👍 Отличный старт! Продолжайте в том же духе";
        }
        
        return "Рекомендации:\n" . implode("\n", $recs);
    }
    
    /**
     * Рассчитать процент изменения
     */
    private function calculateChange(float $new, float $old, bool $inverse = false): array {
        if ($old == 0) return ['percent' => 0, 'direction' => 'same'];
        
        $percent = round((($new - $old) / $old) * 100, 1);
        
        // Для интервала и паузы: уменьшение = прогресс
        if ($inverse) {
            if ($percent < -0.1) {
                $direction = 'up'; // улучшение (стало быстрее/меньше пауза)
            } elseif ($percent > 0.1) {
                $direction = 'down'; // ухудшение
            } else {
                $direction = 'same';
            }
        } else {
            // Для попыток и разнообразия: увеличение = прогресс
            if ($percent > 0.1) {
                $direction = 'up';
            } elseif ($percent < -0.1) {
                $direction = 'down';
            } else {
                $direction = 'same';
            }
        }
        
        return [
            'percent' => abs($percent),
            'direction' => $direction,
            'absolute' => round($new - $old, 1)
        ];
    }
    
    /**
     * Форматировать изменение со стрелкой
     */
    private function formatChangeWithArrow(array $change, bool $inverse = false): string {
        $arrows = [
            'up' => $inverse ? '↓' : '↑',
            'down' => $inverse ? '↑' : '↓',
            'same' => '→'
        ];
        
        $colors = [
            'up' => $inverse ? '🔴' : '🟢',
            'down' => $inverse ? '🟢' : '🔴',
            'same' => '⚪'
        ];
        
        $arrow = $arrows[$change['direction']];
        $color = $colors[$change['direction']];
        
        if ($change['direction'] === 'same') {
            return "{$color} без изменений";
        }
        
        return "{$color} {$arrow} {$change['percent']}%";
    }
    
    /**
     * Форматировать текст прогресса
     */
    private function formatProgressText(array $changes, array $first, array $last): string {
        $lines = [];
        $lines[] = "📈 ВАШ ПРОГРЕСС ЗА ПЕРИОД";
        $lines[] = "";
        $lines[] = "Первая неделя ({$first['first_date']} - {$first['last_date']}):";
        $lines[] = "  • Выполнено: {$first['total']} упражнений";
        $lines[] = "  • Средний интервал: {$first['avg_interval']} сек";
        $lines[] = "  • Средняя пауза: {$first['avg_pause']} сек";
        $lines[] = "  • Тем: {$first['unique_types']}";
        $lines[] = "";
        $lines[] = "Последняя неделя ({$last['first_date']} - {$last['last_date']}):";
        $lines[] = "  • Выполнено: {$last['total']} упражнений " . $this->getEmoji($changes['attempts']['direction']);
        $lines[] = "  • Средний интервал: {$last['avg_interval']} сек " . $this->getIntervalEmoji($changes['interval']['direction']);
        $lines[] = "  • Средняя пауза: {$last['avg_pause']} сек " . $this->getPauseEmoji($changes['pause']['direction']);
        $lines[] = "  • Тем: {$last['unique_types']} " . $this->getEmoji($changes['diversity']['direction']);
        
        // Добавляем информацию о направлениях
        $directionsLine = $this->formatDirectionsLine($last['directions_classified']);
        if ($directionsLine) {
            $lines[] = "";
            $lines[] = $directionsLine;
        }
        
        return implode("\n", $lines);
    }
    
    /**
     * Форматировать строку с направлениями
     */
    private function formatDirectionsLine(array $directionsStats): string {
        $active = [];
        
        if ($directionsStats['counts'][self::DIRECTION_LISTENING] > 0) {
            $active[] = '👂 аудирование';
        }
        if ($directionsStats['counts'][self::DIRECTION_SPEAKING] > 0) {
            $active[] = '🗣️ говорение';
        }
        if ($directionsStats['counts'][self::DIRECTION_QUIZ] > 0) {
            $active[] = '❓ квизы';
        }
        if ($directionsStats['counts'][self::DIRECTION_DIALOG_PREPARE] > 0) {
            $active[] = '📝 подготовка';
        }
        if ($directionsStats['counts'][self::DIRECTION_DIALOG_EXAM] > 0) {
            $active[] = '💬 диалоги';
        }
        if ($directionsStats['counts'][self::DIRECTION_BOTH] > 0) {
            $active[] = '🔄 смешанные';
        }
        
        if (empty($active)) {
            return '';
        }
        
        return "🎯 Режимы: " . implode(', ', $active);
    }
    
    /**
     * Получить эмодзи для направления
     */
    private function getEmoji(string $direction): string {
        return match($direction) {
            'up' => '📈',
            'down' => '📉',
            default => '➡️'
        };
    }
    
    /**
     * Получить эмодзи для интервала
     */
    private function getIntervalEmoji(string $direction): string {
        return match($direction) {
            'up' => '⚡', // стало быстрее (интервал уменьшился)
            'down' => '🐢', // стало медленнее
            default => '⏱️'
        };
    }
    
    /**
     * Получить эмодзи для паузы
     */
    private function getPauseEmoji(string $direction): string {
        return match($direction) {
            'up' => '🤔➡️💪', // пауза уменьшилась = прогресс
            'down' => '😓', // пауза увеличилась
            default => '⏸️'
        };
    }
    
    /**
     * Сгенерировать рекомендацию
     */
    private function generateRecommendation(array $changes, array $lastWeek): string {
        $recs = [];
        
        // Анализ активности
        if ($changes['attempts']['direction'] === 'down') {
            $recs[] = "• 🔥 В последнюю неделю вы занимались меньше. Постарайтесь вернуть ритм!";
        } elseif ($changes['attempts']['direction'] === 'up') {
            $recs[] = "• 🌟 Отличный рост активности! Так держать!";
        }
        
        // Анализ скорости
        if ($changes['interval']['direction'] === 'up') {
            $recs[] = "• ⚡ Вы стали отвечать быстрее! Мозг лучше обрабатывает информацию";
        } elseif ($changes['interval']['direction'] === 'down') {
            $recs[] = "• 🐢 Темп снизился. Возможно, темы стали сложнее - это нормально";
        }
        
        // Анализ паузы
        if ($changes['pause']['direction'] === 'up') {
            $recs[] = "• 🎯 Пауза уменьшилась - вы быстрее вспоминаете перевод!";
        } elseif ($changes['pause']['direction'] === 'down') {
            $recs[] = "• 🤔 Пауза увеличилась. Сложные темы требуют больше времени на обдумывание";
        }
        
        // Анализ разнообразия
        if ($changes['diversity']['direction'] === 'up') {
            $recs[] = "• 📚 Вы расширяете кругозор! Новые темы = новый уровень";
        } elseif ($changes['diversity']['direction'] === 'down') {
            $recs[] = "• 🎯 Сфокусируйтесь на новых темах, чтобы прогресс был разносторонним";
        }
        
        // Баланс направлений
        $hasListening = $lastWeek['directions_classified']['counts'][self::DIRECTION_LISTENING] > 0;
        $hasSpeaking = $lastWeek['directions_classified']['counts'][self::DIRECTION_SPEAKING] > 0;
        $hasQuiz = $lastWeek['directions_classified']['counts'][self::DIRECTION_QUIZ] > 0;
        $hasDialog = $lastWeek['directions_classified']['counts'][self::DIRECTION_DIALOG_EXAM] > 0;
        
        if (!$hasListening && $hasSpeaking) {
            $recs[] = "• 👂 Добавьте аудирование для лучшего восприятия на слух";
        } elseif ($hasListening && !$hasSpeaking) {
            $recs[] = "• 🗣️ Добавьте говорение - это закрепит активный словарь";
        } elseif (!$hasListening && !$hasSpeaking) {
            $recs[] = "• 🎯 Попробуйте основные режимы: аудирование и говорение";
        }
        
        if (!$hasQuiz && $lastWeek['total'] > 30) {
            $recs[] = "• ❓ Режим викторины поможет закрепить сложные темы";
        }
        
        if (!$hasDialog && $lastWeek['total'] > 50) {
            $recs[] = "• 💬 Попробуйте диалоги для практики в реальном контексте";
        }
        
        if (empty($recs)) {
            $recs[] = "• 👍 Стабильность - признак мастерства! Продолжайте в том же духе";
        }
        
        return implode("\n", $recs);
    }
    
    /**
     * Получить быструю сводку
     */
    private function getQuickSummary(array $changes, array $lastWeek): string {
        $parts = [];
        
        // Общая оценка
        $positive = 0;
        $negative = 0;
        
        if ($changes['attempts']['direction'] === 'up') $positive++;
        if ($changes['attempts']['direction'] === 'down') $negative++;
        if ($changes['interval']['direction'] === 'up') $positive++;
        if ($changes['interval']['direction'] === 'down') $negative++;
        if ($changes['pause']['direction'] === 'up') $positive++;
        if ($changes['pause']['direction'] === 'down') $negative++;
        if ($changes['diversity']['direction'] === 'up') $positive++;
        if ($changes['diversity']['direction'] === 'down') $negative++;
        
        if ($positive > $negative + 1) {
            $parts[] = "🚀 Отличный прогресс!";
        } elseif ($negative > $positive + 1) {
            $parts[] = "💪 Нужно поднажать!";
        } else {
            $parts[] = "📊 Стабильное движение вперед";
        }
        
        $parts[] = "На прошлой неделе: {$lastWeek['total']} упражнений, {$lastWeek['unique_types']} тем";
        
        return implode(" ", $parts);
    }
    
    /**
     * Получить новые темы
     */
    private function getNewTopics(array $first, array $last): array {
        return array_values(array_diff($last['types'], $first['types']));
    }
    
    /**
     * Получить потерянные темы
     */
    private function getLostTopics(array $first, array $last): array {
        return array_values(array_diff($first['types'], $last['types']));
    }
    
    /**
     * Плюрализация
     */
    private function pluralize(int $count, string $one, string $few, string $many): string {
        $mod10 = $count % 10;
        $mod100 = $count % 100;
        
        if ($mod100 >= 11 && $mod100 <= 19) {
            return $count . ' ' . $many;
        }
        
        if ($mod10 == 1) {
            return $count . ' ' . $one;
        }
        
        if ($mod10 >= 2 && $mod10 <= 4) {
            return $count . ' ' . $few;
        }
        
        return $count . ' ' . $many;
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
                'directions_classified' => $this->getDirectionsStats([]),
                'unique_types' => 0,
                'first_date' => null,
                'last_date' => null,
                'records' => $records
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
        
        // Собираем типы фраз
        $types = [];
        $totalPause = 0;
        
        foreach ($records as $record) {
            $types[$record['type']] = true;
            $totalPause += $record['pause'];
        }
        
        $typesList = array_keys($types);
        $directionsStats = $this->getDirectionsStats($records);
        
        return [
            'total' => count($records),
            'avg_interval' => !empty($intervals) ? round(array_sum($intervals) / count($intervals), 2) : 0,
            'avg_pause' => round($totalPause / count($records), 2),
            'types' => $typesList,
            'directions' => array_keys($directionsStats['raw']),
            'directions_classified' => $directionsStats,
            'unique_types' => count($typesList),
            'first_date' => $records[0]['date'],
            'last_date' => $records[count($records)-1]['date'],
            'records' => $records
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
}