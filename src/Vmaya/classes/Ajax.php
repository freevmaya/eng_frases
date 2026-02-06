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
    		else return 0;
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