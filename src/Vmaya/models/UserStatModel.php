<?
class UserStatModel extends BaseModel {
	
	protected function getTable() {
		return 'user_stat';
	}

	public function getFields() {
		return [
			'id' => [
				'type' => 'hidden',
				'dbtype' => 'i'
			],
            'user_id' => [
                'label' => 'user_id',
                'dbtype' => 'i'
            ],
			'name' => [
				'type' => 'type',
				'dbtype' => 's'
			],
			'data' => [
				'type' => 'data',
				'dbtype' => 's'
			],
			'time' => [
				'type' => 'time',
				'dbtype' => 's'
			]
		];
	}
}