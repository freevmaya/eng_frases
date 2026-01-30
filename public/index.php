<?
	/*
	// HttpOnly и Secure куки
	session_set_cookie_params([
	    'lifetime' => 3600,
	    'path' => '/',
	    'domain' => $_SERVER['HTTP_HOST'],
	    'secure' => true,     // Только HTTPS
	    'httponly' => true,   // Недоступны из JS
	    'samesite' => 'Strict' // Защита от CSRF
	]);*/

	session_start();
	require dirname(__FILE__, 2).'/src/Vmaya/engine.php';

	Page::Run(null, array_merge($_POST, $_GET));