<?
class UserRequests extends BaseModel {
	
	protected function getTable() {
		return 'user_requests';
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
			'time' => [
				'type' => 'time',
				'dbtype' => 's'
			],
			'source_id' => [
				'type' => 'hidden',
				'dbtype' => 'i'
			],
			'type' => [
				'type' => 'type',
				'dbtype' => 's'
			],
			'data' => [
				'label'=> 'data name',
				'dbtype' => 's'
			]
		];
	}
}
?>