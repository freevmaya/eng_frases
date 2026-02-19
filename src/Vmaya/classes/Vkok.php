<?
class Vkok extends Page {

	public function Render($page) {
		header("Content-Type: text/html; charset=".CHARSET);
		$filename = TEMPLATES_PATH."/vkok.php";
		if (file_exists($filename)) {
			$this->RenderIndex($filename);
		} else Page::Wrong();
	}

	protected function RenderIndex($templatePath) {
		GLOBAL $dbp;

		$v 			= '?v='.SCRIPTS_VERSION;
		$userModel 	= new UserModel();
		$user_id 	= 0;
		$vkok		= isset(Page::$request['vk_app_id']);
	    $new_user 	= false;

		if ($vkok) {

			if (!vkVerifyParams(VK_APP_CLIENT_SECRET))
				Page::Wrong();

	    	if (isset(Page::$request['vk_client']) && (Page::$request['vk_client'] == 'ok')) {
	    		$source = 'ok';
	    		$source_user_id = intval(Page::$request['vk_ok_user_id']);
	    	} else {
	    		$source = 'vk';
	    		$source_user_id = intval(Page::$request['vk_user_id']);
	    	}
	    	
	    	$items = null;

	    	try {

				$items = $userModel->getItems(['source_id' => $source_user_id, 'source'=>$source]);

		    	if (count($items) == 0) {
		    		$new_user = $user_id = $userModel->Update([
		    			'source_id'=>$source_user_id,
		    			'source'=>$source,
		    			'language_code'=>DEFAULT_LANGUAGE,
		    			'last_time'=>date('Y-m-d H:i:s')
		    		]);
		    	} else $user_id = $items[0]['id'];

	    	} catch (Exception $e) {

	    		$items = $userModel->getItems(['source_id' => $source_user_id, 'source'=>$source]);

	    		if (count($items) > 0) {

	    			$new_user = $user_id = $items[0]['id'];

	    			trace("Warning initalize user {$user_id}".
		    				"\nError: ".$e->getMessage());
	    		} else {

		    		trace_error("Error initalize user".
		    				"\nError: ".$e->getMessage());

		    		$source = 'e-'.$source;
		    		$user_id = 1;

		    		$userModel->Update([
		    			'id'=>$user_id,
		    			'source_id'=>$source_user_id,
		    			'source'=>$source,
		    			'language_code'=>DEFAULT_LANGUAGE
		    		]);
		    	}

	    	}

	    	Page::setSession('source_user', [
	    		'id' => $source_user_id,
	    		'source' => $source
	    	]);

	    	Page::setSession('user_id', $user_id);
	    } else if (DEV) {

			//Инициализация пользователя VK. Только при разработке!
			$source 	= 'vk';
			$user_data 	= json_decode(file_get_contents(BASEPATH.'/dev/vk-parameters.json'), true);

			Page::setSession('source_user', [
	    		'id' => $source_user_id = $user_data['id'],
	    		'source' => $source
	    	]);

			$items = $userModel->getItems(['source_id' => $source_user_id, 'source'=>$source]);

	    	if (count($items) > 0)
	    		$user_id = $items[0]['id'];
	    	else {
	    		$user_id = $userModel->Update([
	    			'source_id'=>$source_user_id,
	    			'source'=>$source,
	    			'language_code'=>DEFAULT_LANGUAGE,
		    		'last_time'=>date('Y-m-d H:i:s')
	    		]);
	    		$new_user = $user_id;
	    	}
	    	
	    	Page::setSession('user_id', $user_id);
	    }

	    if ($user_id) {
			$is_developer = Page::isDev();
			$phrases = (new UserPhrasesModel())->getPhrasesAsJsonWithDifficulty($user_id);
			$content = $this->getContent(DEFAULTPAGE);
			include($templatePath);
		} else Page::Wrong();
	}
}