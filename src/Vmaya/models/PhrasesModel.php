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
	        INNER JOIN {$this->getTable()} pt ON p.type_id = pt.id
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
	public static function getPhrasesAsJsonWithDifficulty($language = 'ru', $maxDifficulty = null) {
	    GLOBAL $dbp;
	    
	    $direction = 'en-'.$language;
	    $conditions = "p.is_active = 1 AND pt.is_active = 1 AND p.direction = '{$direction}'";
	    
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

	    trace($query);
	    
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
}
?>