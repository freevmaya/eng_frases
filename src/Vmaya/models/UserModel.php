<?
class UserModel extends BaseModel {
	
	protected function getTable() {
		return 'users';
	}

	public function OnLine($user_id) {
		GLOBAL $dbp;
		return $dbp->query("UPDATE users SET last_time = NOW() WHERE id = {$user_id}");
	}

	public function UpdatePosition($user_id, $data, $angle = 0) {
		GLOBAL $dbp;
		return $dbp->bquery("UPDATE users SET last_time = NOW(), lat = ?, lng = ?, angle = ? WHERE id = ?", 'dddi', 
							[$data['lat'], $data['lng'], $angle, $user_id]);
	}

	public function Update($values, $idField = 'id') {
		GLOBAL $dbp;

		if ($dbp->one("SELECT {$idField} FROM {$this->getTable()} WHERE `{$idField}` = {$values['id']}")) {
			return $dbp->bquery("UPDATE {$this->getTable()} SET `first_name` = ?, `last_name` = ?, `username` = ?, `phone` = ? WHERE `{$idField}` = ?", 'ssssi', 
				[$values['first_name'], $values['last_name'], $values['username'], $values['phone'], $values['id']]);
		}
		return false;
	}

	public function checkUnique($value) { 
		GLOBAL $dbp;
		return $dbp->one("SELECT id FROM {$this->getTable()} WHERE `username` = '{$value}'") === false; 
	}

	public function GetAnyRealOnLine() {
		GLOBAL $dbp;
		$query = "SELECT * FROM {$this->getTable()} WHERE isReal = 1 AND `last_time` >= NOW() - ".OFFLINEINTERVAL;
		return $dbp->line($query);
	}

	public function getFields() {
		return [
			'id' => [
				'type' => 'hidden',
				'dbtype' => 'i'
			],
			'first_name' => [
				'label'=> 'First name',
				'validator'=> 'required',
				'dbtype' => 's'
			],
			'last_name' => [
				'label'=> 'Last name',
				'dbtype' => 's'
			],
			'username' => [
				'label'=> 'Username',
				'validator'=> 'unique',
				'dbtype' => 's'
			],
			'phone' => [
				'label' => 'Phone',
				'type' => 'phone',
				'dbtype' => 's'
			]
		];
	}
}
?>