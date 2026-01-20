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
			if (method_exists($this, $action) && Page::requiestIdModel($requestId)) {
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

	protected function updatePosition($data) {
		GLOBAL $user;

		return (new UserModel())->UpdatePosition($user['id'], $data, isset($data['angle']) ? $data['angle'] : 0);
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

	protected function initData($data) {

		if (isset($data['user'])) {
			$dataUser = is_string($data['user']) ? json_decode($data['user'], true) : $data['user'];

			if ($this->getUser()['id'] != $dataUser['id']) {
				$this->setUser($dataUser);
				return true;
			}
		}
		return $data;
	}
}
?>