<?

define('DEFAULT_TYPE_ID', 2);
define('DEFAULT_TYPE_NAME', 'Present simple');

function hashPhraseAdvanced($phrase) {

    if (!$phrase) {
        return '';
    }

    $normalized = trim($phrase);

    $normalized = preg_replace('/\s+/u', ' ', $normalized);

    if (class_exists('Normalizer')) {
        $normalized = Normalizer::normalize($normalized, Normalizer::FORM_C);
    } else {
        $normalized = utf8_normalizer_nfc($normalized);
    }

    $normalized = mb_strtolower($normalized, 'UTF-8');
    return md5($normalized);
}

function utf8_normalizer_nfc($string) {
    // Простая замена некоторых символов
    $replacements = [
        'ё' => 'е', 'Ё' => 'Е', // Для русского языка
        // Добавьте другие замены при необходимости
    ];
    
    return strtr($string, $replacements);
}

function ftou($text) {
	return preg_replace('/[.?]/u', '', preg_replace('/\s+/u', '_', $text));
}

class Phrases extends Page {

	public function Render($page) {

		header("Content-Type: text/html; charset=".CHARSET);

		if ($phrase = Page::getRequest('phrase')) {
			$this->RenderPhrase(TEMPLATES_PATH."phrase.php", $phrase);
		}
		else {
			$filename = TEMPLATES_PATH."phrases.php";

			if (file_exists($filename)) {
				$this->RenderIndex($filename);
			} else Page::Wrong();
		}
	}

	protected function getAudioUrl($phrase, $lang = 'target_text', $voice='male')
	{
		$da = explode('-', $phrase['direction']);
		$direction = $lang == 'target_text' ? $da[0] : $da[1];

		return VOICES_URL.$voice.DS.$direction.DS.$direction.'_'.hashPhraseAdvanced($phrase[$lang]).'.mp3';
	}

	protected function RenderPhrase($templatePath, $phrase) {
		GLOBAL $dbp;

		$phrase = str_replace('_', ' ', $phrase);
		$v = '?v='.SCRIPTS_VERSION;
	    $is_developer = Page::isDev();

	    $typesModel = new PhraseTypesModel();
	    $prasesModel = new PhrasesModel();

	    $lang = Page::getRequest('lang', DEFAULT_LANGUAGE);

	    $direction = Page::getRequest('direction', $this->getDirection());
	    $type_name = str_replace('_', ' ', Page::getRequest('type_name', DEFAULT_TYPE_NAME));

	    if ($typeItem = $typesModel->getItem($type_name, 'type_name')) {
	    	$type_id = $typeItem['id'];
	    	$type_name = $typeItem['type_name'];
	    }
	    else $type_id = DEFAULT_TYPE_ID;

	    $phrase = $dbp->safeVal($phrase);
	    $items = $prasesModel->getItems("target_text LIKE '%{$phrase}%' AND type_id={$type_id} AND direction='{$direction}'");

	    if (count($items) > 0) {
	    	$phraseItem = $items[0];

		    $descriptionItem = ($list = (new TypeDescriptionModel())->getItems("list_id = {$type_id} AND lang='{$lang}'")) ? $list[0] : null;

		    $type_name_url = str_replace(' ', '_', $type_name);
		    $prev = $prasesModel->getItems("id < {$phraseItem['id']} AND type_id={$type_id} AND direction='{$direction}' ORDER BY `id` DESC");
		    $next = $prasesModel->getItems("id > {$phraseItem['id']} AND type_id={$type_id} AND direction='{$direction}' ORDER BY `id` ASC");

		    if (count($prev) > 0)
		    	$prev_url = $this->Route(['phrases', $lang, $type_name_url, ftou($prev[0]['target_text'])]);
		    else $prev_url = false;

		    if (count($next) > 0)
		    	$next_url = $this->Route(['phrases', $lang, $type_name_url, ftou($next[0]['target_text'])]);
		    else $next_url = false;

			include($templatePath);
		} else {
			if (DEV)
				print_r($phrase);
			else Page::Wrong();
		}
	}

	protected function RenderIndex($templatePath) {
		GLOBAL $dbp;

		$v = '?v='.SCRIPTS_VERSION;
	    $is_developer = Page::isDev();

	    $typesModel = new PhraseTypesModel();

	    $lang = Page::getRequest('lang', DEFAULT_LANGUAGE);

	    $direction = Page::getRequest('direction', $this->getDirection());
	    $type_name = str_replace('_', ' ', Page::getRequest('type_name', DEFAULT_TYPE_NAME));
	    if ($typeItem = $typesModel->getItem($type_name, 'type_name')) {
	    	$type_id = $typeItem['id'];
	    	$type_name = $typeItem['type_name'];
	    }
	    else $type_id = DEFAULT_TYPE_ID;

	    if ($prev = $typesModel->NextOrPrevType($type_id, $direction, false))
	    	$prev_url = $this->Route(['page'=>'phrases', 'lang'=>$lang, 'type_name'=>str_replace(' ', '_', $prev['type_name'])]);
	    else $prev_url = false;

	    if ($next = $typesModel->NextOrPrevType($type_id, $direction))
	    	$next_url = $this->Route(['page'=>'phrases', 'lang'=>$lang, 'type_name'=>str_replace(' ', '_', $next['type_name'])]);
	    else $next_url = false;

	    $descriptionItem = ($list = (new TypeDescriptionModel())->getItems("list_id = {$type_id} AND lang='{$lang}'")) ? $list[0] : null;

	    $phrases = (new PhrasesModel())->getItems(['direction'=>$direction, 'type_id'=>$type_id]);
		include($templatePath);
	}
}