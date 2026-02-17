<?
class IncorrectTranslationsModel extends BaseModel {

	private static $model;
	
	protected function getTable() {
		return 'incorrect_translations';
	}

	public function getFields() {
		return [
			'id' => [
				'type' => 'hidden',
				'dbtype' => 'i'
			],
			'phrase_id' => [
				'label'=> 'phrase_id',
				'dbtype' => 'i'
			],
			'incorrect_text' => [
				'label'=> 'incorrect_text',
				'dbtype' => 's'
			],
			'difficulty_level' => [
				'label'=> 'version',
				'dbtype' => 'i'
			]
		];
	}
}