<?

    include_once(dirname(__FILE__).'/dataBaseProvider.php');

	class mySQLProvider extends dataBaseProvider {
		protected $mysqli;
		protected $result_type;
    	protected $reconnectAttempts = 3;
    	protected $reconnectDelay = 0.2; // секунды

		function __construct($host, $dbname, $user='', $passwd='') {
			parent::__construct($host, $dbname, $user, $passwd);
			$this->result_type = MYSQLI_ASSOC;
		}

		public function Mysqli() {
			return $this->mysqli;
		}

    	// Добавляем метод для проверки и восстановления соединения
	    public function checkConnection() {
	        if (!$this->mysqli || !$this->mysqli->ping()) {
	            $this->log("MySQL connection lost, reconnecting...");
	            $this->reconnect();
	            return false;
	        }
	        return true;
	    }
    
	    private function isConnectionError($error) {
	        $connectionErrors = [
	            'MySQL server has gone away',
	            'Lost connection to MySQL server',
	            'Connection timed out',
	            'Broken pipe',
	            'server has gone away'
	        ];
	        
	        foreach ($connectionErrors as $connectionError) {
	            if (stripos($error, $connectionError) !== false) {
	                return true;
	            }
	        }
	        
	        return false;
	    }

		public function connect($host, $dbname, $user='', $passwd='', $charset='utf8mb4') {
			$this->mysqli = new mysqli($host, $user, $passwd, $dbname);
		    if ($this->mysqli->connect_errno) 
		    	$this->error($this->mysqli->connect_errno.', '.$this->mysqli->error);
		    else if (!empty($charset)) {
		    	$this->mysqli->query("set collation_connection={$charset}_general_ci,
    				collation_database={$charset}_general_ci,
    				character_set_client={$charset},
    				character_set_connection={$charset},
    				character_set_database={$charset},
    				character_set_results={$charset},
    				charset {$charset},
    				names {$charset}");
		    }
		}

		private function reconnect() {
	        if ($this->mysqli)
	            @$this->mysqli->close();
	        
	        for ($i = 0; $i < $this->reconnectAttempts; $i++) {
	            try {
	                $this->connect($this->host, $this->dbname, $this->user, $this->passwd);
	                $this->log("MySQL reconnected successfully");
	                return true;
	            } catch (Exception $e) {
	                $this->log("Reconnect attempt " . ($i + 1) . " failed: " . $e->getMessage());
	                if ($i < $this->reconnectAttempts - 1) {
	                    sleep($this->reconnectDelay);
	                }
	            }
	        }
	        
	        throw new Exception("Failed to reconnect to MySQL after {$this->reconnectAttempts} attempts");
	    }

		public function Close() {
			$this->mysqli->close();
		}

		public function safeVal($str) {
			if (is_array($str) || is_object($str)) $str = json_encode($str);
	        return $this->mysqli->real_escape_string($str);
	    }

	    public function bget($query, $types, $params) {
	    	$ret = [];
			if ($result = $this->bquery($query, $types, $params)) {
				 if (is_object($result)) {
					while ($row = $result->fetch_array($this->result_type)) 
						$ret[] = $row;
				
					$result->free();
				} else trace_error("Wrong query: {$query}, params: ".json_encode($params));
			}
			return $ret;
	    }

	    public function bquery($query, $types, $params) {
			$result = false;

			try {
				//trace($query.' '.json_encode($params));
				$stmt = $this->mysqli->prepare($query);

				$i=0;
		        foreach ($params as $key => $value) {
		        	if ($types[$i] == 's') {
			            if ($this->isDateTime($value))
			                $params[$key] = $this->formatDateTime($value);
			            if (is_object($value) || is_array($value))
			            	$params[$key] = json_encode($value);
			        }

		            $i++;
		        }

		        //trace($query.' '.$types.' '.json_encode($params));
		        if (strlen($types) == count($params)) {
					$stmt->bind_param($types, ...$params);

					$result = $stmt->execute();
					$stmt->store_result();

					$stmt->close();
				} else  $this->error('count($parameters) != strlen($types)');
			} catch (Exception $e) {
				if ($this->isConnectionError($e->getMessage())) {
	                $this->reconnect();
	                return $this->bquery($query, $types, $params);
	            }
				$this->error('mysql_error='.$e->getMessage().' query='.$query.', data: '.json_encode($params));
	            throw $e;
			}

			return $result;
	    }

		public function query($query) {
			$result = false;

			if (!empty($query)) {

				try {
					$result = $this->mysqli->query($query);
				} catch (Exception $e) {
					if ($this->isConnectionError($e->getMessage())) {
		                $this->reconnect();
		                return $this->query($query);
		            }
		            $this->error('mysql_error='.$e->getMessage().' query='.$query);
		            throw $e;
				}
			} else $this->error("Query cannot be empty");

			return $result;
		}

		public function isTableExists($tableName) {
			try {
				return $this->mysqli->query("SHOW TABLES LIKE '{$tableName}'")->num_rows == 1;
			} catch (Exception $e) {
				if ($this->isConnectionError($e->getMessage())) {
	                $this->reconnect();
	                return $this->isTableExists($tableName);
	            }
	            $this->error('mysql_error='.$e->getMessage());
	            throw $e;
			}
		}

		public function escape_string($string) {
			try {
				return $this->mysqli->escape_string($string);
			} catch (Exception $e) {
				if ($this->isConnectionError($e->getMessage())) {
	                $this->reconnect();
	                return $this->escape_string($string);
	            }
	            $this->error('mysql_error='.$e->getMessage());
	            throw $e;
			}
		}

		protected function dbAsArray($query) {
			$ret = [];
			if ($result = $this->query($query)) {
				while ($row = $result->fetch_array($this->result_type)) 
					$ret[] = $row;
				
				$result->free();
			}
			return $ret;
		}

		protected function dbOne($query, $column=0) {
			$row=$this->dbLine($query);
			if ($row===false) return false;
			return array_shift($row);
		}

		protected function dbLine($query) {
			$res = false;
			if ($result = $this->query($query)) {
				if ($result->num_rows >= 1) $res = $result->fetch_array($this->result_type);
				$result->free();
			} 
			return $res;
		}

		public function lastID() {
			return $this->one("SELECT LAST_INSERT_ID()");
		}

	    private function isDateTime($value)
	    {
	        if (!is_string($value)) {
	            return false;
	        }
	        
	        // Проверяем форматы даты
	        $patterns = [
	            '/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/', // ISO 8601 с Z
	            '/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/', // ISO 8601 с миллисекундами
	            '/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/', // ISO 8601 с таймзоной
	            '/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/', // MySQL формат
	        ];
	        
	        foreach ($patterns as $pattern) {
	            if (preg_match($pattern, $value)) {
	                return true;
	            }
	        }
	        
	        return false;
	    }

	    private function formatDateTime($dateTimeString)
	    {
	        // Если уже в MySQL формате, возвращаем как есть
	        if (preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/', $dateTimeString)) {
	            return $dateTimeString;
	        }
	        
	        try {
	            $date = new \DateTime($dateTimeString);
	            return $date->format('Y-m-d H:i:s');
	        } catch (\Exception $e) {
	            // Если не удалось распарсить, возвращаем текущую дату
	            return date('Y-m-d H:i:s');
	        }
	    }
	}
?>