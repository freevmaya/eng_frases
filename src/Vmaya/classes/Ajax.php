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

    	$user_id = $userModel->Update($values);

    	if ($user_id)
    		$user_lists = (new UserPhrasesModel())->getPhrasesAsJsonWithDifficulty($user_id);

    	$this->setUser($userModel->getItem($user_id));

		return [
			'user_id'=>$user_id,
			'user_lists'=>$user_lists
		];
	}

	protected function updatePhraseList($data) {
		if ($user_id = Page::getSession('user_id')) {
			$model = new UserListsModel();
			if (!$data['id'])
				unset($data['id']);

			$data['user_id'] = $user_id;

			return $model->Update($data);
		}
		return 0;
	}

	protected function updatePhrase($data) {
		if ($user_id = Page::getSession('user_id')) {
			$model = new UserPhrasesModel();
			if (!$data['id'])
				unset($data['id']);
			return $model->Update($data);
		}
		return 0;
	}

	protected function deleteList($data) {
		if ($data['id']) {
			$model = new UserListsModel();
			return $model->Delete($data['id']) ? 1 : 0;
		}
		return null;
	}

	protected function deletePhrase($data) {
		if ($data['id']) {
			$model = new UserPhrasesModel();
			return $model->Delete($data['id']) ? 1 : 0;
		}
		return null;
	}

	protected function getList() {
		return PhrasesModel::getPhrasesAsJsonWithDifficulty();
	}
}
?>