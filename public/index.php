<?
	require dirname(__FILE__, 2).'/src/Vmaya/engine.php';
	VKSessionHandler::startForVK();

	Page::GenerateHeaderToken();
	Page::Run(null, array_merge($_POST, $_GET));