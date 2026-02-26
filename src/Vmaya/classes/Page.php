<?
$user;

class Page {
	protected $title = "";
	protected $model;
	protected $userModel;
	private $haveActiveOrder = -1;

	public static $current;
	public static $page;
	public static $request;
	public static $subpage;
	private static $language;

	public function __construct($userModel = null) {
		GLOBAL $lang, $dbp, $_GET, $user;

		$this->userModel = $userModel ? $userModel : new UserModel();

		Page::$current = $this;
		$dbp = new mySQLProvider('localhost', _dbname_default, _dbuser, _dbpassword);

		$user = Page::getSession('user');
		if (!$user && DEV) {
			if ($user = $this->userModel->getItem(DEVUSER))
				$this->setUser($user);
		}

		$language = DEFAULT_LANGUAGE;

		if (isset(Page::$request['lang']) && 
			file_exists(LANGUAGE_PATH.Page::$request['lang'].'.php')) {
			$language = Page::$request['lang'];
		} else {
			$language = Page::getSession('language');
		
			if ($user) {

				if ($userDB = $this->userModel->getItem($user['id']))
					$user = array_merge($user, $userDB);
				
				if (!Page::checkLanguage($language))
					$language = $user['language_code'];
			}
		}

		Page::setLanguage($language);

		$this->model = $this->initModel();

		if ($this->model && $this->isReciveData()) {
			if ($this->requiestIdModel(Page::$request['form-request-id']) == get_class($this->model)) {
				$this->requiestRemove(Page::$request['form-request-id']);
				$this->model->Update(Page::$request);
			}
		}
	}

	public function Route($params) {
		$url = rtrim(BASEURL, '/');
		foreach ($params as $key=>$value)
			$url .= DS.$value;

		return $url;
	}

	public static function getRequest($name, $default = null) {
		return isset(Page::$request[$name]) ? Page::$request[$name] : $default;
	} 

	public static function setLanguage($language) {
		GLOBAL $lang;

		if (Page::checkLanguage($language))
			Page::$language = $language;
		else Page::$language = DEFAULT_LANGUAGE;

		Page::setSession('language', Page::$language);
		include(LANGUAGE_PATH.Page::$language.'.php');
	}

	public static function checkLanguage($language) {
		return file_exists(LANGUAGE_PATH.$language.'.php');
	}

	public static function language() {
		return Page::$language ? Page::$language : DEFAULT_LANGUAGE;
	}

	public function getDirection() {
		return 'en-'.Page::language();
	}

	public static function isDev() {
		if (isset(Page::$request['dev'])) {
			return intval(Page::$request['dev']) > 0;
		}
		return (DEV || in_array(Page::getSession('user_id'), DEVUSERS)) && (@Page::$request['dev'] != '0');
	}

	public static function Run($userModel, $request) {
		/*
		foreach ($request as $key=>$value) {
			$request[$key] = htmlspecialchars($value);
		}*/
		Page::$request = $request;

		$className = DEFAULTCLASS;
		$classFileName = dirname(__FILE__).'/'.$className.'.php';
		$page = null;
		$subpage = null;
		$hasFile = false;

		foreach ($request as $key=>$value) {
			if (is_string($value))
				$value = htmlspecialchars($value);

			if ($key == 'page') {
				$page = $value;
				$className = ucfirst($page);
				$classFileName = dirname(__FILE__).'/'.$className.'.php';
			}

			if ($key == 'subpage') {
				if (is_numeric($value))
					$request['id'] = $value;
				else {
					$subpage = $value;
					$classFileName = dirname(__FILE__).'/'.$page.'/'.$subpage.'.php';
				}
			}
		}

		if (file_exists($classFileName))
			include_once($classFileName);
		else {
			trace_error("File not found {$classFileName}");
			header('HTTP/1.1 403 Forbidden');
    		exit(403);
		}

		try {
			Page::$page = $page;
			Page::$subpage = $subpage;

			$page = new $className($userModel);
			$page->Render(Page::$page.(Page::$subpage ? ('/'.Page::$subpage) : ''));
			$page->Close();
			
		} catch (Exception $e) {
			trace_error($e->getMessage());
			header('HTTP/1.1 403 Forbidden');
    		exit(403);
		}
	}

	public static function Wrong() {
		GLOBAL $_SESSION, $_SERVER, $dbp;
		$dbp->Close();

		trace_error("Wrong");
		header('HTTP/1.1 403 Forbidden');
		exit(403);
	}

	public static function GenerateHeaderToken() {

		$tokens = Page::getSession('X-CSRF-Tokens', []);
		$token = bin2hex(random_bytes(32));

		$tokens[] = [
			'time' => time(),
			'value' => $token
		];

		Page::setSession('X-CSRF-Tokens', $tokens);
		header('X-CSRF-Token: ' . $token);
		return $token;
	}

	public static function LastToken() {
		$tokens = Page::getSession('X-CSRF-Tokens', []);
		$count = count($tokens);
		return $count > 0 ? @$tokens[$count - 1]['value'] : null;
	}

	public static function CleanExpiredTokens() {
		$tokens = Page::getSession('X-CSRF-Tokens', []);
		$curtime = time();
		$new_tokens = [];

		// Крайний токен живет бесконечно
		foreach ($tokens as $idx=>$rec)
			if (($curtime - $rec['time'] <= LIVETOKEN) || ($idx == count($tokens) - 1))
				$new_tokens[] = $rec;

		Page::setSession('X-CSRF-Tokens', $new_tokens);
	}

	public static function HasToken($value) {

		if ($value && is_string($value)) {
			Page::CleanExpiredTokens();
			$tokens = Page::getSession('X-CSRF-Tokens', []);
			$curtime = time();

			foreach ($tokens as $idx=>$rec)
				if (hash_equals($rec['value'], $value))
					return true;
		}
		return false;
	}

	protected function isReciveData() {
		return isset(Page::$request['form-request-id']);
	}

	protected function initModel() {
	}

	public static function link($params = null) {
		$result = BASEURL;
		if ($params) {
			if (is_string($params))
				return $result.'/'.$params;

			for ($i=0; $i<count($params); $i++)
				$result .= '/'.$params[$i];
		}
		return $result;
	} 

	protected static function currentURL() {
		return BASEURL.'/'.Page::$page.(Page::$subpage ? ('/'.Page::$subpage) : '');
	}

	protected function requiestRemove($requestId) {
		if ($requestIds = Page::getSession('requestIds')) {
			foreach ($requestIds as $model=>$value)
				if ($value == $requestId) {
					unset($requestIds[$model]);
					Page::setSession('requestIds', $requestIds);
					break;
				}
		}
	}

	protected function requiestIdModel($requestId) {
		if ($requestId && ($requestIds = Page::getSession('requestIds'))) {
			foreach ($requestIds as $model=>$value)
				if ($value == $requestId)
					return $model;
		}
		return false;
	}

	protected function createRequestId($classModel) {

		if (!$requestIds = Page::getSession('requestIds'))
			$requestIds = [];

		if (!isset($requestIds[$classModel])) {
			$requestIds[$classModel] = getGUID();
			Page::setSession('requestIds', $requestIds);
		}

		return $requestIds[$classModel];
	}

	public function getUser() {
		GLOBAL $user;
		return $user;
	}

	protected function setUser($data) {
		GLOBAL $dbp, $user;
		
		Page::setSession('user', $user = $data);

		if ($set = isset($user['id'])) {
			$item = $this->userModel->getItem($user['id']);
			
			if ($item) {
				$dbp->query("UPDATE users SET last_time = NOW() WHERE id = {$user['id']}");
			} else {
				$query = "INSERT INTO users (`id`, `first_name`, `last_name`, `username`, `language_code`, `create_date`, `last_time`) VALUES ({$user['id']}, '{$user['first_name']}', '{$user['last_name']}', '{$user['username']}', '{$user['language_code']}', NOW(), NOW())";
				$dbp->query($query);
			}
		}

		return ["result"=>$set ? "ok" : "fail"];
	}

	protected function getPage() {

	}

	public static function setSession($name, $value = null) {	
		GLOBAL $_SESSION;
		$_SESSION[$name] = $value;
	}

	public static function getSession($name, $default = null) {
		GLOBAL $_SESSION;
		return isset($_SESSION[$name]) ? $_SESSION[$name] : $default;
	}

	public static function unsetSession($name) {
		GLOBAL $_SESSION;
		if (isset($_SESSION[$name])) {
			$_SESSION[$name] = null;
			unset($_SESSION[$name]);
		}
	}

	public function colorSheme($defaultValue = null) {

		$sheme = Page::getSession('color-sheme');
		if (is_null($sheme))
			Page::setSession('color-sheme', $sheme = $defaultValue);

		return $sheme;
	}

	public function Render($page) {
		header("Content-Type: text/html; charset=".CHARSET);
		$content = $this->getContent($page);
		$index = isset(Page::$request['index']) ? Page::$request['index'] : 'index';
		$filename = TEMPLATES_PATH."/{$index}.php";

		if (file_exists($filename))
			include($filename);
		else Page::Wrong();
	}

	public function Close() {
		GLOBAL $dbp;
		$dbp->Close();
	}

	protected function getContent($contentLink) {
		$content = "";
		$templateFile = TEMPLATES_PATH.'/'."{$contentLink}.php";
		if (file_exists($templateFile)) {
			$content = $this->RenderContent($templateFile);
		}
		else {
			if ($this->model)
				$content = $this->RenderContent(TEMPLATES_PATH.'/'.DEFAULTFORM.".php");
			else $content = $this->RenderContent(TEMPLATES_PATH.'/'.DEFAULTPAGE.".php");
		}

		return $content;
	}

	public function getId() {
		return isset(Page::$request['id']) ? Page::$request['id'] : 0;
	}

	protected function RenderContent($templateFile) {
		GLOBAL $dbp, $user;
		ob_start();
		include($templateFile);
		$result = ob_get_contents();
		ob_end_clean();
		return $result;
	}
}
?>