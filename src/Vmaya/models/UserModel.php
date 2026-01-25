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

	public function checkUnique($value) { 
		GLOBAL $dbp;
		return $dbp->one("SELECT id FROM {$this->getTable()} WHERE `username` = '{$value}'") === false; 
	}

	public function getFields() {
		return [
			'id' => [
				'type' => 'hidden',
				'dbtype' => 'i'
			],
			'source_id' => [
				'type' => 'hidden',
				'dbtype' => 'i'
			],
			'source' => [
				'type' => 'source',
				'dbtype' => 's'
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
			'language_code' => [
				'label' => 'language_code',
				'dbtype' => 's'
			],
			'create_date' => [
				'label' => 'create_date',
				'dbtype' => 's'
			],
			'last_time' => [
				'label' => 'last_time',
				'dbtype' => 's'
			],
			'data' => [
				'label' => 'data',
				'dbtype' => 's'
			]
		];
	}
}
?>