<?php
class PhrasesModel extends BaseModel {
    
    protected function getTable() {
        return 'phrases';
    }

    public function getFields() {
        return [
            'id' => [
                'type' => 'hidden',
                'dbtype' => 'i'
            ],
            'type_id' => [
                'label' => 'Phrase Type',
                'type' => 'select',
                'validator' => 'required|integer',
                'dbtype' => 'i',
                'relation' => 'phrase_types'
            ],
            'target_text' => [
                'label' => 'Phrase Text',
                'validator' => 'required',
                'type' => 'textarea',
                'dbtype' => 's'
            ],
            'context' => [
                'label' => 'Context',
                'type' => 'textarea',
                'dbtype' => 's'
            ],
            'native_text' => [
                'label' => 'Translation',
                'type' => 'textarea',
                'dbtype' => 's'
            ],
            'difficulty_level' => [
                'label' => 'Difficulty Level',
                'type' => 'select',
                'validator' => 'integer|min:1|max:5',
                'dbtype' => 'i',
                'options' => [1 => 'Very Easy', 2 => 'Easy', 3 => 'Medium', 4 => 'Hard', 5 => 'Very Hard']
            ],
            'is_active' => [
                'label' => 'Active',
                'type' => 'checkbox',
                'dbtype' => 'i',
                'default' => 1
            ],
            'created_at' => [
                'label' => 'Created',
                'type' => 'datetime',
                'dbtype' => 's',
                'readonly' => true
            ],
            'updated_at' => [
                'label' => 'Updated',
                'type' => 'datetime',
                'dbtype' => 's',
                'readonly' => true
            ]
        ];
    }

	/**
	 * Функция для получения фраз в формате JSON
	 * 
	 * Формат:
	 * {
	 *   "Future perfect continuous": [
	 *     {"target": "...", "native": "..."},
	 *     ...
	 *   ]
	 * }
	 * 
	 * @return string JSON строка с группировкой фраз по типам
	 */
	public static function getPhrasesAsJson() {
	    GLOBAL $dbp; // Предполагается, что $dbp уже существует и подключен к БД
	    
	    // 1. Получаем все активные типы фраз
	    $typesModel = new PhraseTypesModel();
	    $types = $typesModel->getItems(['is_active' => 1]);
	    
	    // 2. Получаем все активные фразы
	    $phrasesModel = new PhrasesModel();
	    $phrases = $phrasesModel->getItems(['is_active' => 1], null, 'AND');
	    
	    // 3. Группируем фразы по типам
	    $result = [];
	    
	    foreach ($types as $type) {
	        $typeId = $type['id'];
	        $typeName = $type['type_name'];
	        
	        // Фильтруем фразы по типу
	        $typePhrases = array_filter($phrases, function($phrase) use ($typeId) {
	            return $phrase['type_id'] == $typeId;
	        });
	        
	        if (!empty($typePhrases)) {
	            $result[$typeName] = [];
	            
	            foreach ($typePhrases as $phrase) {
	                // Создаем объект фразы в нужном формате
	                $phraseObj = [
	                    'target' => $phrase['target_text'] ?? '',
	                    'native' => $phrase['native_text'] ?? ''
	                ];
	                
	                // Добавляем context если есть (опционально)
	                if (!empty($phrase['context'])) {
	                    $phraseObj['context'] = $phrase['context'];
	                }
	                
	                $result[$typeName][] = $phraseObj;
	            }
	        }
	    }
	    
	    // 4. Преобразуем в JSON с красивым форматированием
	    $jsonOptions = JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES;
	    return json_encode($result, $jsonOptions);
	}

	/**
	 * Альтернативная версия с использованием JOIN запроса для большей эффективности
	 * 
	 * @return string JSON строка с группировкой фраз по типам
	 */
	public static function getPhrasesAsJsonOptimized() {
	    GLOBAL $dbp;
	    
	    // Выполняем JOIN запрос для получения всех данных за один раз
	    $query = "
	        SELECT 
	            pt.type_name,
	            p.target_text,
	            p.native_text,
	            p.direction,
	            p.context
	        FROM phrases p
	        INNER JOIN phrase_types pt ON p.type_id = pt.id
	        WHERE p.is_active = 1 AND pt.is_active = 1
	        ORDER BY pt.type_name, p.id
	    ";
	    
	    $rows = $dbp->asArray($query);
	    
	    // Группируем результаты по типам фраз
	    $result = [];
	    
	    foreach ($rows as $row) {
	        $typeName = $row['type_name'];
	        
	        if (!isset($result[$typeName])) {
	            $result[$typeName] = [];
	        }
	        
	        $phraseObj = [
	            'target' => $row['target_text'] ?? '',
	            'native' => $row['native_text'] ?? '',
	            'direction' => $row['direction'] ?? ''
	        ];
	        
	        // Добавляем опциональные поля
	        if (!empty($row['context'])) {
	            $phraseObj['context'] = $row['context'];
	        }
	        
	        $result[$typeName][] = $phraseObj;
	    }
	    
	    // Преобразуем в JSON
	    $jsonOptions = JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES;
	    return json_encode($result, $jsonOptions);
	}

	/**
	 * Версия с фильтрацией по уровню сложности
	 * 
	 * @param int|null $maxDifficulty Максимальный уровень сложности (1-5)
	 * @return string JSON строка
	 */
	public static function getPhrasesAsJsonWithDifficulty($maxDifficulty = null) {
	    GLOBAL $dbp;
	    
	    $conditions = "p.is_active = 1 AND pt.is_active = 1";
	    
	    if ($maxDifficulty !== null && $maxDifficulty >= 1 && $maxDifficulty <= 5) {
	        $conditions .= " AND p.difficulty_level <= " . intval($maxDifficulty);
	    }
	    
	    $query = "
	        SELECT 
	            pt.type_name,
	            p.target_text,
	            p.native_text,
	            p.direction,
	            p.context,
	            p.difficulty_level
	        FROM phrases p
	        INNER JOIN phrase_types pt ON p.type_id = pt.id
	        WHERE {$conditions}
	        ORDER BY pt.`order`, p.difficulty_level, p.id
	    ";
	    
	    $rows = $dbp->asArray($query);
	    
	    $result = [];
	    foreach ($rows as $row) {
	        $typeName = $row['type_name'];
	        
	        if (!isset($result[$typeName])) {
	            $result[$typeName] = [];
	        }
	        
	        $phraseObj = [
	            'target' => $row['target_text'] ?? '',
	            'native' => $row['native_text'] ?? '',
	            'direction' => $row['direction'] ?? ''
	        ];
	        
	        if (!empty($row['context'])) {
	            $phraseObj['context'] = $row['context'];
	        }
	        
	        // Добавляем уровень сложности если нужен
	        if ($row['difficulty_level']) {
	            $phraseObj['difficulty'] = $row['difficulty_level'];
	        }
	        
	        $result[$typeName][] = $phraseObj;
	    }

	    return $result;
	}

	// Пример использования:
	// echo getPhrasesAsJson();
	// echo getPhrasesAsJsonOptimized();
	// echo getPhrasesAsJsonWithDifficulty(3); // Только фразы со сложностью до 3

	/**
	 * Вспомогательная функция для отправки JSON как HTTP ответ
	 * 
	 * @param string $jsonData JSON строка
	 */
	public static function outputJsonResponse($jsonData) {
	    header('Content-Type: application/json; charset=utf-8');
	    echo $jsonData;
	}

	// Пример endpoint:
	// if (isset($_GET['action']) && $_GET['action'] == 'get_phrases') {
	//     $difficulty = isset($_GET['difficulty']) ? intval($_GET['difficulty']) : null;
	//     $json = getPhrasesAsJsonWithDifficulty($difficulty);
	//     outputJsonResponse($json);
	//     exit;
	// }
}
?>