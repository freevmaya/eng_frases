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

		trace(Page::$request);
		$v				= '?v='.SCRIPTS_VERSION;
	    $is_developer 	= Page::isDev();
		$content 		= $this->getContent(DEFAULTPAGE);
		include($templatePath);
	}
}