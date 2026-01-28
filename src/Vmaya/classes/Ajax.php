<?
class Ajax extends Page {

	public function Render($page) {
		header("Content-Type: text/json; charset=".CHARSET);
		echo json_encode($this->ajax());
	}

	public function ajax() {

		if (isset(Page::$request['action'])) {
			$action = Page::$request['action'];
			$requestId = @Page::$request['ajax-request-id'];
			if (method_exists($this, $action)) {
				$data = isset(Page::$request['data']) ? json_decode(Page::$request['data'], true) : null;

				return $this->$action($data);
			}
		}

		return Page::$request;
	}

	protected function trace($data) {
		trace($data);
		return true;
	}

	protected function setValue($data) {
		$result = false;
		if ($nameModel 	= @$data['model']) {
			$id 		= @$data['id'];
			$model = new ($nameModel)();
			if ($item = $model->getItem($data['id'])) {

				$item[$data['name']] = $data['value'];
				$result = $model->Update($item);
			}
		}
		return $result;
	}

	protected function initUser($data) {

		$userModel = new UserModel();

		$user_data = $data['user_data'];
		$source = $data['source'];

		$values = [
			'source_id'=>$data['source_id'],
			'source'=>$data['source'],
			'first_name'=>$user_data['first_name'],
			'last_name'=>$user_data['last_name'],
			'last_time'=>date('Y-m-d H:i:s'),
			'language_code'=>'ru',
			'data'=>json_encode($user_data, JSON_FLAGS)
		];

    	$items = $userModel->getItems("source_id = ".$data['source_id']." AND source = '{$source}'");
    	if (count($items) > 0)
    		$values['id'] = $items[0]['id'];

		return $userModel->Update($values);
	}

	protected function getList() {
		return PhrasesModel::getPhrasesAsJsonWithDifficulty();
	}
}
?>