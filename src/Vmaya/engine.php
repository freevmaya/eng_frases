<?
	include(dirname(__DIR__, 2).'/config.php');

	define('INCLUDE_PATH', BASEPATH.'/src/Vmaya/include/');
	define('LOGPATH', BASEPATH.'/logs//');
	define('CLASSES_PATH', BASEPATH.'/src/Vmaya/classes/');
	define('MODELS_PATH', BASEPATH.'/src/Vmaya/models/');
	define('LANGUAGE_PATH', BASEPATH.'/src/Vmaya/language/');
	define('TEMPLATES_PATH', BASEPATH.'/src/Vmaya/templates/');
	define("CHARSET", "utf-8");
	define("DEFAULTPAGE", "home");
	define("SCRIPTS_VERSION", 90);
	
	// Конфигурация приложения
	define('APP_VERSION', '1.0.2');
	define('APP_NAME', 'Тренажер английского языка');
	define('DEFAULT_SPEED', 1.0);
	define('DEFAULT_PAUSE', 3);
	define('DEFAULT_LANG_PAUSE', 2);

	define('DOWNLOADS_PATH', BASEPATH.'downloads'.DS);
	define('DOWNLOADS_URL', BASEURL.'downloads'.DS);

	define('DEVUSER', 1573356581);
	define("JSON_FLAGS", JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_NUMERIC_CHECK | JSON_PRETTY_PRINT);

	define('DEFAULT_LANGUAGE', 'ru');

	include(INCLUDE_PATH.DS."_edbu2.php");
	include(INCLUDE_PATH.DS."console.php");
	include(INCLUDE_PATH.DS."fdbg.php");
	include(INCLUDE_PATH.DS."utils.php");
	include(INCLUDE_PATH.DS.'db/mySQLProvider.php');

	define("AUTOLOAD_PATHS", [INCLUDE_PATH, CLASSES_PATH, MODELS_PATH]);
	spl_autoload_register(function ($class_name) {

		foreach (AUTOLOAD_PATHS as $path) {
			$pathFile = $path.DS.$class_name.".php";
			if (file_exists($pathFile)) {
			    	include_once($pathFile);
			    	return true;
			}
		}

		//throw new Exception("Can't load class {$class_name}", 1);
	});

	function exception_handler(Throwable $exception) {
		$error_msg = $exception->getFile().' '.$exception->getLine().': '.$exception->getMessage();
		echo $error_msg;
		trace_error($error_msg);
	}

	set_exception_handler('exception_handler');
?>