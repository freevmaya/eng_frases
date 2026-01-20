<?
abstract class dataBaseProvider {
	protected $host; 
	protected $dbname; 
	protected $user; 
	protected $passwd; 
	protected $cache;
	function __construct($host='', $dbname='', $user='', $passwd='') {
		$this->host 	= $host;
		$this->dbname 	= $dbname;
		$this->user 	= $user;
		$this->passwd 	= $passwd;
		$this->connect($host, $dbname, $user, $passwd);
	}

	public function getDBParams() {
		return array(
			'host'=>$this->host,
			'dbname'=>$this->dbname,
			'user'=>$this->user,
			'passwd'=>$this->passwd
		);
	}

	abstract public function connect($host, $dbname, $user='', $passwd='');
	abstract public function query($query);
	abstract protected function dbAsArray($query);
	abstract protected function dbLine($query);
	abstract protected function dbOne($query);
	abstract public function lastID();
	abstract public function Close();

	public function setCacheProvider($cache) {
		$this->cache = $cache;
	}

	public function error($text) {
		trace_error("[dataBaseProvider] ".$text);
		//throw new Exception($text, 1);
	}
    
    public function log($message) {
        trace("[dataBaseProvider] " . $message);
    }

	public function safeVal($str) {
		return $str;
	}

	public function one($query, $cached=false) {
		if ($cached) {
			if (!($cacheData = $this->getCache($query, $key)))
				$this->setCache($query, $cacheData = $this->dbOne($query));

			return $cacheData;
		} else return $this->dbOne($query);
	}

	public function asArray($query, $cached=false, $trace = false) {
		if ($cached) {
			if (!($cacheData = $this->getCache($query, $key))) {
				if ($trace) trace($query);
				$this->setCache($query, $cacheData = $this->dbAsArray($query));
			}

			return $cacheData;
		} else return $this->dbAsArray($query);
	}

	public function line($query, $cached=false, $trace = false) {
		if ($cached) {
			if (!($cacheData = $this->getCache($query, $key))) {
				if ($trace) trace($query);
				$this->setCache($query, $cacheData = $this->dbLine($query));
			}

			return $cacheData;
		} else return $this->dbLine($query);
	}
    
    private function setCache($query, $value) {
    	if ($this->cache)
    		$this->cache->set(md5($query), $value);
    }
    
    private function getCache($query, &$cacheKey) {
    	if ($this->cache) {
    		$cacheKey = md5($query);
    		return $this->cache->get($cacheKey);
    	} else return false;
    }
}
?>