<?
class Ajax extends BaseAjax {

	public function getActionWithoutToken() {
		return ['getUserState'];
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

		if (!isset($data['source_id']) || !isset($data['source']))
			Page::Wrong();

		$userModel = new UserModel();
		$source = $dbp->safeVal($data['source']);
		$source_id = intval($data['source_id']);
		$user_data = $data['user_data'] ?? [];

		if (in_array($source, SOURCES) && $source_id) {

			$language = isset($user_data['language_code']) ? $user_data['language_code'] : Page::language();

			$values = [
				'source_id'=>$source_id,
				'source'=>$source,
				'first_name'=>$user_data['first_name'] ?? '',
				'last_name'=>$user_data['last_name'] ?? '',
				'last_time'=>date('Y-m-d H:i:s'),
				'language_code'=> $language
			];

	    	$items = $userModel->getItems("source_id = {$source_id} AND source = '{$source}'");

	    	//Если нашли пользователя
	    	if (count($items) > 0) {
	    		$values['id'] = $user_id = $items[0]['id'];

	    		if (!$items[0]['data'])
	    			$values['data'] = json_encode($user_data, JSON_FLAGS);

	    		$userModel->Update($values);

				if ($source == 'site') { // Если это пользователь сайта

					$session_user_id = Page::getSession('user_id');

					if ($session_user_id && ($session_user_id != $user_id)) {

						$session_user = $userModel->getItem($session_user_id);
						//Удаляем если был создан временный пользователь
						if ($session_user && ($session_user['source'] == 'site')) {
							$userModel->Delete($session_user_id);
						}
					}
				}

	    	} else {
	    		$values['data'] = json_encode($user_data, JSON_FLAGS);
	    		$user_id = $userModel->Update($values);
	    	}

	    	$this->setUser($userModel->getItem($user_id));
	    	Page::setSession('user_id', $user_id);

	    	$result = [
				'user_id'=>intval($user_id)
			];

    		if (Page::getSession('language', $language) != $language) {
    			Page::setSession('language', $language);
    			$result['redirect'] = BASEURL.'?lang='.$language;
    		}

			return $result;
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
    		else return 0;
		}
		Page::Wrong();
	}

	protected function addUserPhrases($data) {
		if ($user_id = Page::getSession('user_id')) {
			$list_model = new UserListsModel();
			$phrases_model = new UserPhrasesModel();

			$data['user_id'] = $user_id;
			$list = $data['items'];

			for ($i=0; $i<count($list); $i++) {
				$list[$i]['target_text'] = $list[$i]['target'];
				$list[$i]['native_text'] = $list[$i]['native'];
			}

			unset($data['items']);

			$item = $list_model->getItem($data['name'], 'name');
			if ($item)
				$list_id = $item['id'];
			else $list_id = $list_model->Update($data, 'name');

			if ($list_id) {

				foreach ($list as $item) {
					$item['list_id'] = $list_id;
					if (!$phrases_model->Update($item)) {
						return [
							'error'=> 'Failed to add phrase'
						];
					}
				}

				return [
					'success'=> $list_id
				];
			} else {
				return [
					'error'=> 'Failed to list'
				];
			}
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
		$model = new ErrorsModel();
		if (isset($data['id']))
			unset($data['id']);

		$data['col'] = isset($data['column']) ? intval($data['column']) : 0;
		$data['user_id'] = Page::getSession('user_id', 0);
		return [
			'success'=> $model->Update($data) ? true : false
		];
	}

	protected function allowedMessage($data) {
		if ($user_id = Page::getSession('user_id')) {
			$model = new UserModel();
			if ($user = $model->getItem($user_id)) {
				$data = json_decode($user['data'], true);
				$data['allowedMessage'] = 1;

				$user['data'] = json_encode($data, JSON_FLAGS);
				return [
					'success'=> $model->Update($user)
				];
			}
		}
		Page::Wrong();
	}

	protected function deleteList($data) {
		GLOBAL $dbp;

		if ($user_id = Page::getSession('user_id')) {
			$model = new UserListsModel();
			if (isset($data['id']) && ($id = intval($data['id']))) {
				return [
					'success'=> $model->Delete($id) ? true : false
				];
			} else if (isset($data['name']) && ($name = $dbp->safeVal($data['name']))) {
				$items = $model->getItems("user_id = {$user_id} AND `name` = '{$name}'");
				if (count($items) > 0) {
					return [
						'success'=> $model->Delete($items[0]['id']) ? true : false
					];
				}
			}
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

	protected function getIncorrect($data)
	{
		if ($phrase_id = intval($data['phrase_id'])) {
			if ($list = (new IncorrectTranslationsModel())->getItems(['phrase_id' => $phrase_id])) {
				return [
					'success'=> true,
					'list' => $list
				];
			} else return [
					'success'=> false
				];
		}
		Page::Wrong();
	}

	protected function vk_apiCall($data) {

		$url = "https://api.vk.com/method/".$data['method'];
		unset($data['method']);

		$params = array_merge($data, [
		    'access_token' => VK_APP_SERVER_SECRET,
		    'user_id' => intval($data['user_id']),
		    'v' => '5.199'
		]);

		// Инициализируем cURL
		$ch = curl_init();

		// Настройки cURL
		curl_setopt($ch, CURLOPT_URL, $url);
		curl_setopt($ch, CURLOPT_POST, 1);
		curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($params));
		curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
		curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); // Для локальной разработки, на продакшене лучше true
		curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false); // Для локальной разработки

		// Выполняем запрос
		$response = curl_exec($ch);

		// Проверяем на ошибки
		if (curl_error($ch)) {
		    echo 'Ошибка cURL: ' . curl_error($ch);
		} else {
		    $result = json_decode($response, true);
		    
		    if (isset($result['error'])) {
		        echo 'Ошибка API: ' . $result['error']['error_msg'] . ' (Код: ' . $result['error']['error_code'] . ')';
		    } else {
		        return $result;
		    }
		}

		Page::Wrong();
	}
}
?>