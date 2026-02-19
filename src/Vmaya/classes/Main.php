<?
class Main extends Page {

	public function Render($page) {
		header("Content-Type: text/html; charset=".CHARSET);
		$filename = TEMPLATES_PATH."/index.php";
		if (file_exists($filename)) {
			$this->RenderIndex($filename);
		} else Page::Wrong();
	}

	protected function RenderIndex($templatePath) {
		GLOBAL $dbp;

		$v = '?v='.SCRIPTS_VERSION;
	    $user_id = 0;
	    $is_developer = Page::isDev();

		//$phrases = (new UserPhrasesModel())->getPhrasesAsJsonWithDifficulty($user_id);
		$content = $this->getContent(DEFAULTPAGE);
		include($templatePath);
	}
}