<?
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