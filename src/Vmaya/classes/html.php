<?

class html {
	public static $scripts = [];
	public static $styles = [];
	public static $jscode = [];
	public static $jsdata = [];
	public static $templates = [];
	protected static $field_id = 0;
	protected static $autoKey = 0;

	public static function GetFields($data, $fieldsOrModel=null, $group=0) {

		$fieldsList = [];
		$nameModel = null;
		$result = '';

		//print_r($data);

		if ($fieldsOrModel instanceof BaseModel) {
			$nameModel = get_class($fieldsOrModel);
			$fields = $fieldsOrModel->getFields();
		} else $fields = $fieldsOrModel;

		if ($fields) {

			if (!$fields) $fieldsList = array_keys($data);
			else {
				foreach ($fields as $key=>$value)
					$fieldsList[$key] = is_string($key) ? $key: $value;
			}
			$groupBuffer = '';
			$i = 0;

			foreach ($fieldsList as $key) {

				$defaulField = [						// this minimal require options structure
					'name'=>$key,
					'type'=>'input',
					'label'=>lang($key)
				];

				if (isset($fields[$key])) {

					if (is_string($fields[$key]))
						$fieldOptions = array_merge($defaulField, ['name'=>$fields[$key]]);
					else $fieldOptions = array_merge($defaulField, $fields[$key]);
				}
				else $fieldOptions = $defaulField;

				$value = '';
				if (isset($fieldOptions['model'])) {

					$model = new $fieldOptions['model']();
					$value = ['items' => $model->getItems($fieldOptions)];
					if (isset($data[$key])) {
						$item = $model->getItem($data[$key]);
						$value['item'] = $item ? $item : @$fieldOptions['default'];
					} else $value['item'] = @$fieldOptions['default'];

				} else
					$value = isset($data[$key]) ? $data[$key] : @$fieldOptions['default'];

				if ($group > 0) {
					$groupBuffer .= html::RenderField($fieldOptions , $value, $nameModel);
					$i++;

					if ($i >= $group) {
						$result .= '<div class="group">'.$groupBuffer.'</div>';
						$groupBuffer = '';
						$i=0;
					}
				} else $result .= html::RenderField($fieldOptions, $value, $nameModel);
			}

			if (($group > 0) && ($i > 0))
				$result .= '<div class="group">'.$groupBuffer.'</div>';
		}

		return $result;
	}

	public static function fieldIdx() {
		html::$field_id++;
		return html::$field_id;
	}

	public static function AddTemplateFile($fileName, $key)
	{
		html::$templates[$key] = file_get_contents(TEMPLATES_PATH."/{$fileName}");
	}

	public static function AddTemplate($value, $key)
	{
		html::$templates[$key] = $value;
	}

	public static function AddJsCode($code, $key=null) {
		if (!$key) {
			html::$jscode[html::$autoKey] = $code;
			html::$autoKey++;
		}
		else if (!isset(html::$jscode[$key]))
			html::$jscode[$key] = $code;
	}

	public static function AddJsData($data, $section) {
		html::$jsdata[$section] = $data;
	}

	public static function AddScriptFile($fileName) {
		if (!in_array($fileName, html::$scripts))
			html::$scripts[] = $fileName;
	}

	public static function AddScriptFiles($fileNames) {
		foreach ($fileNames as $fileName)
			html::AddScriptFile($fileName);
	}

	public static function AddStyleFile($fileName) {
		if (!in_array($fileName, html::$styles))
			html::$styles[] = $fileName;
	}

	protected static function addValidator($validator, $options, $nameModel) {
		html::AddScriptFile('validator.js');
		html::AddScriptFile('views.js');

		if (is_array($validator)) {
			foreach ($validator as $v)
				html::AddJsCode('validatorList.add(new '.$v."Validator('{$options['name']}', '{$nameModel}'));\n");
		} else html::AddJsCode('validatorList.add(new '.$validator."Validator('{$options['name']}', '{$nameModel}'));\n");
	}

	public static function RenderField($options, $value=null, $nameModel=null) {
		GLOBAL $user;
		return html::RenderFile(TEMPLATES_PATH.'/fields/'.$options['type'].'.php', $options, $value, $nameModel);
	}

	public static function RenderFile($fileName, $options=null, $value=null, $nameModel=null) {
		GLOBAL $user;

		if (file_exists($fileName)) {
			ob_start();
			include($fileName);
			$result = ob_get_contents();
			ob_end_clean();

			if (isset($options['validator']) && $nameModel)
				html::addValidator($options['validator'], $options, $nameModel);
		} else $result = "File {$fileName} not found";
		return $result;
	}

	public static function RenderJSData() {
		$list = [];
		foreach (html::$jsdata as $key=>$data) {
			if (is_array($data))
				$data = json_encode($data);

			$list[] = "{$key}: {$data}";
		}

		return "var jsdata = {\n".implode(",\n", $list)."\n}\n";
	}

	public static function RenderTemplates() {
		$list = [];
		$regExp = '/<([\w\s\d="-:;{}]+)>/';
		foreach (html::$templates as $key=>$template) {

			$matches = null;
			preg_match($regExp, $template, $matches);
			if (count($matches) > 0) {
				$newm = substr($matches[0], 0, -1)." data-template-id=\"{$key}\">";
				$template = str_replace($matches[0], $newm, $template);
			}
			$list[] = $template;
		}

		return count($list) > 0 ? '<div class="templates">'.implode("\n", $list)."\n</div>" : '';
	}

	public static function RenderJSCode() {
		$result = '';
		if (count(html::$jscode) > 0) {
	        $result .= "$(window).ready(() => {\n";
	        foreach (html::$jscode as $key=>$code) {
	            $result .= "//----JS-{$key}---\n";
	            $result .= $code."\n";
	        }
	        $result .= "});\n";
	    }
	    return $result;
	}

	public static function RenderJSFiles() {
		GLOBAL $anti_cache;
		$result = '';
		html::$scripts = array_unique(html::$scripts);
		foreach (html::$scripts as $script) {
		    $scriptUrl = strpos($script, '//') > -1 ? $script : (SCRIPTURL.'/'.$script.$anti_cache);
			$result .= "<script src=\"{$scriptUrl}\"></script>\n";
		}
		return $result;
	}

	public static function RenderStyleFiles($value='')
	{
		GLOBAL $anti_cache;
		$result = '';
		html::$styles = array_unique(html::$styles);
		foreach (html::$styles as $style)
	    	$result .= "<link rel=\"stylesheet\" type=\"text/css\" href=\"{$style}{$anti_cache}\"></script>\n";
		return $result;
	}

	public static function toData($values, $fields=null) {
		if (!$fields) 
			$fields = array_keys($values);

		$result = [];
		foreach ($fields as $key){

			if (isset($values[$key])) {
				$value = $values[$key];
				
				if (is_array($value))
					$value = json_encode($value);

				$result[] = "data-{$key}='{$value}'";
			}
		}
		return implode(" ", $result);
	}
}

?>