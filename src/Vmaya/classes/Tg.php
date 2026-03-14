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
	    $is_developer 	= Page::isDev();
		$content 		= $this->getContent(DEFAULTPAGE);
		$app_init_params = urldecode(Page::getRequest('params'));

		trace($app_init_params);
		include($templatePath);
	}
}