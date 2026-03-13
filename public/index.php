<?
	require dirname(__FILE__, 2).'/src/Vmaya/engine.php';
	
	session_set_cookie_params([
        'lifetime' => 86400 * 30, // 30 дней
        'path' => '/',
        'domain' => '', // Пустой domain для VK
        'secure' => true, // VK всегда использует HTTPS
        'httponly' => true,
        'samesite' => 'None' // Для кросс-сайтовых запросов
    ]);
    
    ini_set('session.cookie_samesite', 'None');
    ini_set('session.cookie_secure', '1');

	Page::GenerateHeaderToken();
	Page::Run(null, array_merge($_POST, $_GET));