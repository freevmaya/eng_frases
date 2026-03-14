<?
class Tg extends Page {

	public function Render($page) {
		header("Content-Type: text/html; charset=".CHARSET);
		$filename = TEMPLATES_PATH."/tg.php";
		if (file_exists($filename)) {
			$this->RenderIndex($filename);
		} else Page::Wrong();
	}

	protected function RenderIndex($templatePath) {
		GLOBAL $dbp;
		$v				= '?v='.SCRIPTS_VERSION;
		$content 		= $this->getContent(DEFAULTPAGE);
		if ($app_init_params = Page::getRequest('params'))
			$app_init_params = urldecode($app_init_params);
		include($templatePath);
	}
}