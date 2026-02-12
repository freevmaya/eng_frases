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

		$userModel = new UserModel();
		$source = $dbp->safeVal($data['source']);
		$source_id = intval($data['source_id']);
		$user_data = $data['user_data'];

		if (in_array($source, SOURCES) && $source_id && $user_data) {

			$language = isset($user_data['language_code']) ? $user_data['language_code'] : DEFAULT_LANGUAGE;

			$values = [
				'source_id'=>$source_id,
				'source'=>$source,
				'first_name'=>$user_data['first_name'],
				'last_name'=>$user_data['last_name'],
				'last_time'=>date('Y-m-d H:i:s'),
				'language_code'=> $language,
				'data'=>json_encode($user_data, JSON_FLAGS)
			];

	    	$items = $userModel->getItems("source_id = {$source_id} AND source = '{$source}'");

	    	if (count($items) > 0) {
	    		$values['id'] = $user_id = $items[0]['id'];
	    		$userModel->Update($values);
	    	} else $user_id = $userModel->Update($values);

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
}
?>