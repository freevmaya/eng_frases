<?

	/*
	ini_set('session.cookie_samesite', 'None');
	ini_set('session.cookie_secure', 1);
	ini_set('session.cookie_httponly', 1);
	ini_set('session.use_only_cookies', 1);
	*/

	/*
	// Для PHP 7.3+ можно использовать session_set_cookie_params
	session_set_cookie_params([
	    'lifetime' => 0,
	    'path' => '/',
	    'domain' => $_SERVER['HTTP_HOST'] ?? '',
	    'secure' => true,
	    'httponly' => true,
	    'samesite' => 'None'
	]);
*/
	require dirname(__FILE__, 2).'/src/Vmaya/engine.php';
	SessionManager::start();

	Page::GenerateHeaderToken();
	Page::Run(null, array_merge($_POST, $_GET));