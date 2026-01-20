<?

GLOBAL $__cache_key, $mysql_cache_expired;

//include_once(INCLUDE_PATH.'/statistic.inc');
//include_once(INCLUDE_PATH.'/Memcache.php');
include_once(INCLUDE_PATH.'/LiteMemcache.php');

define('RESULTTYPE', MYSQLI_ASSOC);

class DB {
    static private $PROFILE;
    static public function query($a_query, $args=null) { 
        // например 'SELECT * FROM table WHERE ID=%d', [123]  
        GLOBAL $db;
        $result = null;
        if ($args && (count($args) > 0)) $query = vsprintf($a_query, $args);
        else $query = $a_query;
        if (!$db) connect_mysql();
        if (DB::$PROFILE) $startTime = fdbg::time();
        
        $result=sql_query($query);
        if (DB::$PROFILE) {
            //$a_query = mysql_escape_string($a_query);
            trace((fdbg::time() - $startTime).", '{$a_query}'");
//            trace($a_query);
        }
        return $result;
    }
    
    static public function setProfile($a_val) {
        DB::$PROFILE = $a_val;
    }
    
    static public function lastID() {
        return query_one("SELECT LAST_INSERT_ID()");  
    }
    
    static public function line($query, $args=null, $type = RESULTTYPE, $cached=false) {
        if (!$cached || (($row = DB::getCache($query, $cacheKey)) === false)) {
            $result = DB::query($query, $args);
            if ($result->num_rows < 1) {
        		$result->free();
        		return false;
        	} else {
        		$row=$result->fetch_array($type);
        		$result->free();
                if ($cached) DB::setCache($cacheKey, $row);
        	}
        }
        return $row;
    }               
    
    static function one($query, $cached=false) {
        $row = DB::line($query, null, MYSQLI_NUM, $cached);
        return $row[0];
    }
    
    static public function asArray($query, $args=null, $cached=false) {
        if (!$cached || (($ret = DB::getCache($query, $cacheKey)) === false)) { 
            $result = DB::query($query, $args);
        	$ret=array();
        	while ($row=$result->fetch_array(RESULTTYPE)) $ret[]=$row;
        	$result->free();
            
            if ($cached) DB::setCache($cacheKey, $ret);
        }
    	return $ret;
    }
    
    static public function close() {
        GLOBAL $db;
        if ($db) {
            $db->close();
            $db = null;
        };
    }
    
    static private function setCache($cacheKey, $value) {
        GLOBAL $mysql_cache_expired;
        if ($mysql_cache_expired > 0) MCache::set($cacheKey, $value, $mysql_cache_expired);
    }
    
    static private function getCache($query, &$cacheKey) {
        GLOBAL $__cache_key, $mysql_cache_expired;
         
        $cache_data = false;   
        $is_cached  = ($mysql_cache_expired > 0) && (strtoupper(substr($query, 0, 3)) == 'SEL');
    
        if ($is_cached) {
            if (strpos(strtoupper($query), 'FOUND_ROWS') !== false) {
                $__cache_key = md5($query.$__cache_key);                
            } else $__cache_key = md5($query);
            
            $cacheKey = $__cache_key;
                                         
            $cache_data = MCache::get($__cache_key);               
            //trace('CACHE: '.$__cache_key.', CACHE_DATA_ON: '.(($cache_data !== false)?1:0).', QUERY: '.$query);
            //trace($cache_data);
        } 
        
        return $cache_data;
    
    }     

    static public function safeVal($str) {
        GLOBAL $db;
        return $db->real_escape_string($str);
    }
}
?>