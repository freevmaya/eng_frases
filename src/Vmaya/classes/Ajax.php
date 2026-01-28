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

		$source_user = $data['source_user'];

		return $userModel->Update([
			'id'=>$data['id'],
			'source'=>$data['source'],
			'first_name'=>$source_user['first_name'],
			'last_name'=>$source_user['last_name'],
			'last_time'=>date('Y-m-d H:i:s'),
			'data'=>json_encode($source_user, JSON_FLAGS)
		]);
	}

	protected function getList() {
		return PhrasesModel::getPhrasesAsJsonWithDifficulty();
	}
}
?>