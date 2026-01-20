<?

$FDBGLogFile = LOGPATH.'fdbg.log';
$FDBGErrorsFile = LOGPATH.'errors.log';

define('ERROR_TYPE', 'error');
define('INFO_TYPE', 'info');

class fdbg {
    public static function trace($str, $topCalled=1, $type = INFO_TYPE) {
        GLOBAL $FDBGLogFile, $FDBGErrorsFile, $_GET, $_POST;

        $targetFile = $type == ERROR_TYPE ? $FDBGErrorsFile : $FDBGLogFile;
        
        $stack = fdbg::GetStack();
        $stackMax = min($topCalled + 6, count($stack) - 1);
        
        $i = $topCalled;
        $stackStr = '';

        while ($i < $stackMax) {
            if (isset($stack[$i]))
                $stackStr .= $stack[$i]['file'].':'.$stack[$i]['line']."\n";
            else echo "Key {$i} is wrong, count = ".count($stack)."\n";
            $i++;
        }

        if (!is_string($str)) $str = json_encode($str, JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
        
        $str = toUTF($str);

        $paramsStr = json_encode(array_merge($_GET, $_POST), JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);

        $notifyStr = 
            'time: '.date('d.m.y H.i')."\n".
            "stack: \n".$stackStr.
            ($type == ERROR_TYPE ? ("params: \n".$paramsStr) : '').
            "message: \n".$str."\n\n";


        if (file_exists($targetFile)) {
            $notifyStr = ",\n".$notifyStr;
            $line = filesize($targetFile);
        } else $line = 0;
        
        $fd = fopen($targetFile, 'a+');
        fwrite($fd, $notifyStr);
        fclose($fd);
        return $line;
    }
    
    public static function time() { 
        list($usec, $sec) = explode(" ", microtime()); 
        return ((float)$usec + (float)$sec); 
    }
    
    public static function callStackItem($depth=1) {
        $stack = fdbg::GetStack();
        return $stack[min($depth + 1, count($stack) - 1)];
    }
    
    public static function GetStack() {
        $stack = debug_backtrace();
        foreach ($stack as $key=>$val) {
            if (!isset($stack[$key]['file'])) unset($stack[$key]);  // удаляем пустые записи
        }
        return $stack;
    }
}


function trace_error($value) {
    trace($value, 'file', 2, true);
}

function trace($value, $to='file', $callDepth=2, $asError = false) {
    switch ($to) {
        case 'document': echo '<pre>';
                        $line = fdbg::callStackItem($callDepth);
                        echo 'trace in file: '.$line['file'].', line: '.$line['line']."\n";
                        print_r($value); 
                        echo '</pre>';
                        break;
        case 'file': fdbg::trace($value, $callDepth, $asError);
                    break;
        default : $line = fdbg::callStackItem($callDepth);
                    echo 'trace in file: '.$line['file'].', line: '.$line['line']."\n";
                    print_r($value);
                    break;
    }
}
?>