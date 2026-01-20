<?
class StatisticModel extends BaseModel {

	private static $model;
	
	protected function getTable() {
		return 'statistic';
	}

	public static function trace($type, $data = null) {

		if (!is_string($data))
			$data = json_encode($data, JSON_FLAGS);

		if (!StatisticModel::$model) 
			StatisticModel::$model = new StatisticModel();

		return StatisticModel::$model->Update([
			'type' => $type,
			'data' => $data
		]);
	}

	public function getFields() {
		return [
			'id' => [
				'type' => 'hidden',
				'dbtype' => 'i'
			],
			'type' => [
				'type' => 'type ',
				'dbtype' => 's'
			],
			'data' => [
				'type' => 'data ',
				'dbtype' => 's'
			]
		];
	}
}