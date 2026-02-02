<?
class ErrorsModel extends BaseModel {

	private static $model;
	
	protected function getTable() {
		return 'js_errors';
	}

	public function getFields() {
		return [
			'id' => [
				'type' => 'hidden',
				'dbtype' => 'i'
			],
			'user_id' => [
				'label'=> 'user_id',
				'dbtype' => 'i'
			],
			'time' => [
				'label'=> 'time',
				'dbtype' => 's'
			],
			'version' => [
				'label'=> 'version',
				'dbtype' => 's'
			],
			'message' => [
				'label'=> 'message',
				'dbtype' => 's'
			],
			'source' => [
				'label'=> 'source',
				'dbtype' => 's'
			],
			'userAgent' => [
				'label'=> 'userAgent',
				'dbtype' => 's'
			],
			'line' => [
				'label'=> 'line',
				'dbtype' => 'i'
			],
			'col' => [
				'label'=> 'col',
				'dbtype' => 'i'
			],
			'error' => [
				'label'=> 'error',
				'dbtype' => 's'
			],
			'scriptType' => [
				'label'=> 'scriptType',
				'dbtype' => 's'
			]
		];
	}
}