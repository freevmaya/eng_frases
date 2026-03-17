<?
class UserFavorites extends BaseModel {
	
	protected function getTable() {
		return 'user_favoirites';
	}

	public function getFields() {
		return [
			'id' => [
				'type' => 'hidden',
				'dbtype' => 'i'
			],
			'user_id' => [
				'type' => 'hidden',
				'dbtype' => 'i'
			],
			'phrase_id' => [
				'type' => 'hidden',
				'dbtype' => 'i'
			]
		];
	}

	public static function getFavoritesPhrases($user_id, $maxDifficulty = null) {
		GLOBAL $dbp;
	    
	    $direction = 'en-'.Page::language();
	    $conditions = "uf.user_id = {$user_id} AND p.is_active = 1 AND p.direction = '{$direction}'";
	    
	    if ($maxDifficulty !== null && $maxDifficulty >= 1 && $maxDifficulty <= 5) {
	        $conditions .= " AND p.difficulty_level <= " . intval($maxDifficulty);
	    }
	    
	    $query = "
	        SELECT 
	            p.id
	        FROM user_favoirites uf
	        INNER JOIN phrases p ON p.id = uf.phrase_id
	        WHERE {$conditions}
	        ORDER BY p.difficulty_level, p.id
	    ";
	    
	    return array_map('intval', array_column($dbp->asArray($query), 'id'));
	}
}
?>