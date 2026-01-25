<?
	session_start();
	require dirname(__FILE__, 2).'/src/Vmaya/engine.php';
	
	Page::Run(null, array_merge($_POST, $_GET));