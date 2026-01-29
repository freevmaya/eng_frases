<?php
class UserPhrasesModel extends BaseModel {
    
    protected function getTable() {
        return 'user_phrases';
    }

    public function getFields() {
        return [
            'id' => [
                'type' => 'hidden',
                'dbtype' => 'i'
            ],
            'is_active' => [
                'label' => 'is_active',
                'dbtype' => 'i'
            ],
            'list_id' => [
                'label' => 'list_id',
                'dbtype' => 'i'
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

	public static function getPhrasesAsJsonWithDifficulty($user_id, $maxDifficulty = null) {
	    GLOBAL $dbp;
		    
		$result = [];
	    
	    if ($user_id = filter_var($user_id, FILTER_SANITIZE_NUMBER_INT)) {
		    $conditions = "p.is_active = 1 AND ul.is_active = 1 AND ul.user_id = {$user_id}";
		    
		    if ($maxDifficulty !== null && $maxDifficulty >= 1 && $maxDifficulty <= 5)
		        $conditions .= " AND p.difficulty_level <= " . intval($maxDifficulty);
		    
		    $query = "
		        SELECT 
		            ul.name,
		            ul.description,
		            p.target_text,
		            p.native_text,
		            p.direction,
		            p.context,
		            p.difficulty_level
		        FROM user_phrases p
		        INNER JOIN user_lists ul ON p.list_id = ul.id
		        WHERE {$conditions}
		        ORDER BY ul.`order`, p.difficulty_level, p.id
		    ";

			//$rows = $dbp->bget($query, 'i', [intval($user_id)]);
		    
		    $rows = $dbp->asArray($query, 's', [$user_id]);
		    
		    foreach ($rows as $row) {
		        $typeName = $row['name'];
		        
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
		}

	    return $result;
	}
}
?>