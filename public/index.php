<?
	require dirname(__FILE__, 2).'/src/Vmaya/engine.php';
	SessionManager::start();

	Page::GenerateHeaderToken();
	Page::Run(null, array_merge($_POST, $_GET));