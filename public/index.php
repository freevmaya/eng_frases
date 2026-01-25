<?
	session_start();
	require dirname(__FILE__, 2).'/src/Vmaya/engine.php';

	print_r(array_merge($_POST, $_GET));
	
	Page::Run(null, array_merge($_POST, $_GET));