<?
class Ajax extends Page {

	public function Render($page) {
		GLOBAL $_POST;

		if ((count($_POST) > 0) && Ajax::is_valid_referer()) {
			header("Content-Security-Policy: default-src 'self'; script-src 'self' ".BASEURL.";");
			header("Content-Type: text/json; charset=".CHARSET);

			header("X-XSS-Protection: 1; mode=block");

			// Запрет кэширования конфиденциальных страниц
			header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
			header("Pragma: no-cache");

			echo json_encode($this->ajax());
		} else {
			header('HTTP/1.1 403 Forbidden');
    		exit(403);
		}
	}

	public static function is_valid_referer() {
		GLOBAL $_SERVER;

	    // Проверяем, установлен ли Referer
	    if (!isset($_SERVER['HTTP_REFERER'])) {
	        return false;
	    }
	    
	    // Получаем домен текущего сайта
	    $current_domain = $_SERVER['HTTP_HOST'];
	    
	    // Получаем домен из Referer
	    $referer_domain = parse_url($_SERVER['HTTP_REFERER'], PHP_URL_HOST);
	    
	    //trace("$referer_domain $current_domain");
	    
	    // Сравниваем домены
	    return $referer_domain === $current_domain;
	}

	public function ajax() {
		GLOBAL $dbp;

		if (isset(Page::$request['action'])) {
			$action = Page::$request['action'];
			$requestId = @Page::$request['ajax-request-id'];
			if (method_exists($this, $action)) {
				$data = isset(Page::$request['data']) ? json_decode(Page::$request['data'], true) : null;

				if (is_object($data))
					foreach($data as $key=>$value)
						$data[$key] = $dbp->safeVal($value);
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
		GLOBAL $dbp;

		$userModel = new UserModel();

		$user_data = $data['user_data'];
		$source = $dbp->safeVal($data['source']);

		$values = [
			'source_id'=>$data['source_id'],
			'source'=>$source,
			'first_name'=>$user_data['first_name'],
			'last_name'=>$user_data['last_name'],
			'last_time'=>date('Y-m-d H:i:s'),
			'language_code'=>'ru',
			'data'=>json_encode($user_data, JSON_FLAGS)
		];

    	$items = $userModel->getItems("source_id = ".$dbp->safeVal($data['source_id'])." AND source = '{$source}'");

    	if (count($items) > 0) {
    		$values['id'] = $user_id = $items[0]['id'];
    		$userModel->Update($values);
    	} else $user_id = $userModel->Update($values);

    	$this->setUser($userModel->getItem($user_id));

		return [
			'user_id'=>$user_id
		];
	}

	protected function getUserLists($data) {
		if ($user_id = $data['user_id']) {
    		return (new UserPhrasesModel())->getPhrasesAsJsonWithDifficulty($user_id);
		}
		return 0;
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