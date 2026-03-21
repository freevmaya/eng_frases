<?
class Main extends Page {

	public $new_user = false;
	public $user_id = 0;
	public $user = null;
	public static $source = 'site';

	public function __construct($userModel = null) {
		parent::__construct($userModel);

		$userModel = new UserModel();
		
		if (DEV) {
			if ($user_id = Page::getSession('user_id')) {
				$user = $userModel->getItem($user_id);
				if (!$user || ($user['source'] != Main::$source))
					Page::unsetSession('user_id');
			}
		}

		if ($this->user_id = Page::getSession('user_id')) {
			if (!$userModel->getItem($this->user_id)) 
				$this->user_id = null;
		}

		if (!$this->user_id) {

			Page::setLanguage(getPreferredLanguage(array_keys(LANGUAGES), DEFAULT_LANGUAGE));
			$this->user_id = 'new';
			$this->user['data'] = ['id' => 'new'];
		}

		/*
		if (!$this->user_id) {

			Page::setLanguage(getPreferredLanguage(array_keys(LANGUAGES), DEFAULT_LANGUAGE));

			$this->new_user = $this->user_id = $userModel->Update([
    			'source_id'=> rand(0, 100000),
    			'source'=>Main::$source,
    			'language_code' => Page::language(),
    			'last_time'=>date('Y-m-d H:i:s')
    		]);

			if ($this->user_id)
	    		$userModel->Update([
	    			'id'=> $this->user_id,
	    			'source_id'=> $this->user_id,
	    			'data' => json_encode(['id' => $this->user_id])
	    		]);
		}*/

		if (is_numeric($this->user_id) && ($this->user = $userModel->getItem($this->user_id))) {

			Page::setSession('user_id', $this->user_id);
			$this->user['data'] = json_decode($this->user['data'], JSON_FLAGS);
			if (!isset($this->user['data']['id']) || !$this->user['data']['id'])
				$this->user['data']['id'] = $this->user_id;
		}
	}

	public function Render($page) {

		header("Content-Type: text/html; charset=".CHARSET);

		$filename = TEMPLATES_PATH."/index.php";
		if (file_exists($filename)) {
			$this->RenderIndex($filename);
		} else Page::Wrong();
	}

	protected function RenderIndex($templatePath) {
		GLOBAL $dbp;

		$v = '?v='.SCRIPTS_VERSION;
	    $is_developer = Page::isDev();

		$phrases = (new UserPhrasesModel())->getPhrasesAsJsonWithDifficulty($this->user_id);
		$content = $this->getContent(DEFAULTPAGE);
		include($templatePath);
	}
}