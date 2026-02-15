<?
class BaseAjax extends Page {

	public function Render($page) {
		GLOBAL $_POST;

		if ((count($_POST) > 0) && Ajax::isSecureAjaxFromMyDomain()) {
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

	public static function isSecureAjaxFromMyDomain(): bool {
	    // Получаем текущий домен
	    $currentHost = $_SERVER['HTTP_HOST'] ?? '';
	    $currentDomain = parse_url('http://' . $currentHost, PHP_URL_HOST);
	    
	    // 1. Проверяем AJAX заголовок
	    $isAjax = isset($_SERVER['HTTP_X_REQUESTED_WITH']) && 
	              strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest';
	    
	    if (!$isAjax) {
	        return false;
	    }
	    
	    // 2. Проверяем Origin (самый надежный способ)
	    if (isset($_SERVER['HTTP_ORIGIN'])) {
	        $originHost = parse_url($_SERVER['HTTP_ORIGIN'], PHP_URL_HOST);
	        if ($originHost === $currentDomain) {
	            return true;
	        }
	    }
	    
	    // 3. Проверяем Referer
	    if (isset($_SERVER['HTTP_REFERER'])) {
	        $refererHost = parse_url($_SERVER['HTTP_REFERER'], PHP_URL_HOST);
	        if ($refererHost === $currentDomain) {
	            return true;
	        }
	    }
	    
	    // 4. Современные браузеры - Sec-Fetch-Site
	    if (isset($_SERVER['HTTP_SEC_FETCH_SITE'])) {
	        return $_SERVER['HTTP_SEC_FETCH_SITE'] === 'same-origin';
	    }
	    
	    // 5. Проверяем по IP (для внутренних запросов)
	    $clientIP = $_SERVER['REMOTE_ADDR'] ?? '';
	    $serverIP = $_SERVER['SERVER_ADDR'] ?? '';
	    
	    if ($clientIP === $serverIP || $clientIP === '127.0.0.1' || $clientIP === '::1') {
	        return true; // Запрос с того же сервера
	    }
	    
	    return false;
	}

	public function getActionWithoutToken() {
		return [];
	}

	public function ajax() {
		$action_without_token = $this->getActionWithoutToken();

		if (isset(Page::$request['action'])) {
			$action = Page::$request['action'];
			/*
			if (!in_array($action, $action_without_token)) {
				$token = isset($_SERVER['HTTP_X_CSRF_TOKEN']) ? $_SERVER['HTTP_X_CSRF_TOKEN'] : null;
				if (!$token) $token = isset(Page::$request['token']) ? Page::$request['token'] : null;

				if (!Page::HasToken($token))
					return [
						'error' => 1,
						'message' => 'The token has expired'
					];
			}*/

			if (method_exists($this, $action)) {

				$data = isset(Page::$request['data']) ? json_decode(Page::$request['data'], true) : null;

				if (is_object($data))
					foreach($data as $key=>$value)
						$data[$key] = $dbp->safeVal($value);
				return $this->$action($data);
			}
		}

		if (DEV)
			return [
				'error' => 'Action not found',
				'request' => Page::$request
			];
		else Page::Wrong();
	}
}