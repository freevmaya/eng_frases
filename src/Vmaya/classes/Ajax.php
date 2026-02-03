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
			header('Access-Control-Allow-Headers: X-CSRF-Token, Content-Type');

			Page::GenerateHeaderToken();

			echo json_encode($this->ajax());
		} else Page::Wrong();
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

			$token = isset($_SERVER['HTTP_X_CSRF_TOKEN']) ? $_SERVER['HTTP_X_CSRF_TOKEN'] : null;
			if (!$token) $token = isset(Page::$request['token']) ? Page::$request['token'] : null;

			if (Page::HasToken($token) 
				&& method_exists($this, $action)) {

				$data = isset(Page::$request['data']) ? json_decode(Page::$request['data'], true) : null;

				if (is_object($data))
					foreach($data as $key=>$value)
						$data[$key] = $dbp->safeVal($value);
				return $this->$action($data);
			}
		}

		if (DEV)
			return [
				'error' => 1,
				'request' => Page::$request
			];
		else Page::Wrong();
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
		$source = $dbp->safeVal($data['source']);
		$source_id = intval($data['source_id']);
		$user_data = $data['user_data'];

		if (in_array($source, SOURCES) && $source_id && $user_data) {

			$values = [
				'source_id'=>$source_id,
				'source'=>$source,
				'first_name'=>$user_data['first_name'],
				'last_name'=>$user_data['last_name'],
				'last_time'=>date('Y-m-d H:i:s'),
				'language_code'=>'ru',
				'data'=>json_encode($user_data, JSON_FLAGS)
			];

	    	$items = $userModel->getItems("source_id = {$source_id} AND source = '{$source}'");

	    	if (count($items) > 0) {
	    		$values['id'] = $user_id = $items[0]['id'];
	    		$userModel->Update($values);
	    	} else $user_id = $userModel->Update($values);

	    	$this->setUser($userModel->getItem($user_id));
	    	Page::setSession('user_id', $user_id);

			return [
				'user_id'=>intval($user_id)
			];
		} else Page::Wrong();
	}

	protected function getUserState($data) {
		if ($user_id = Page::getSession('user_id')) {
    		if ($stateItem = (new UserStateModel())->getItem($user_id, 'user_id')) {
    			if ($json_data = trim($stateItem['data']))
	    			return [
	    				'state' => json_decode($json_data, true)
	    			];
    		}
			return 0;
		}

		Page::Wrong();
	}

	protected function setUserState($data) {
		if ($user_id = Page::getSession('user_id')) {
			$data = json_encode($data, JSON_FLAGS);
			return [
				'success'=> ((new UserStateModel())->Update([
					    			'user_id'=>$user_id,
					    			'data' => $data
					    		], 'user_id')) ? true : false
			];
		} 
		Page::Wrong();
	}

	protected function getUserLists($data) {
		if ($user_id = intval($data['user_id'])) {
			if ($list = (new UserPhrasesModel())->getPhrasesAsJsonWithDifficulty($user_id))
    			return $list;
		}
		Page::Wrong();
	}

	protected function updatePhraseList($data) {
		if ($user_id = Page::getSession('user_id')) {
			$model = new UserListsModel();
			if (!$data['id'])
				unset($data['id']);

			$data['user_id'] = $user_id;

			return [
				'success'=> $model->Update($data) ? true : false
			];
		}
		Page::Wrong();
	}

	protected function updatePhrase($data) {
		if ($user_id = Page::getSession('user_id')) {
			$model = new UserPhrasesModel();

			return [
				'success'=> $model->Update($data) ? true : false
			];
		}
		Page::Wrong();
	}

	protected function addError($data) {
		if ($user_id = Page::getSession('user_id')) {
			$model = new ErrorsModel();
			if (isset($data['id']))
				unset($data['id']);

			$data['col'] = isset($data['column']) ? intval($data['column']) : 0;
			$data['user_id'] = $user_id;
			return [
				'success'=> $model->Update($data) ? true : false
			];
		}
		Page::Wrong();	
	}

	protected function deleteList($data) {
		if ($id = intval($data['id'])) {
			$model = new UserListsModel();
			return [
				'success'=> $model->Delete($id) ? true : false
			];
		}
		Page::Wrong();
	}

	protected function deletePhrase($data) {
		if ($id = intval($data['id'])) {
			$model = new UserPhrasesModel();
			return [
				'success'=> $model->Delete($id) ? true : false
			];
		}
		Page::Wrong();
	}

	protected function getList() {
		return PhrasesModel::getPhrasesAsJsonWithDifficulty();
	}
}
?>