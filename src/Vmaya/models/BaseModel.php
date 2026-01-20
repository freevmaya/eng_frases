<?

abstract class BaseModel {

	protected $lastID;
	abstract protected function getTable();
	public function getFields() {return [];}
	public function checkUnique($data) { return false; }
	public function getTitle() { return Lang(get_class($this)); }

	protected function verifyId($idField, $id) {

		if ($id) {
			$fields = $this->getFields();
			if (isset($fields[$idField]) && ($fields[$idField]['dbtype'] == 's'))
				$id = "'{$id}'";
		}

		return $id;
	}

	public function Update($values, $idField = 'id') {
		GLOBAL $dbp;

		$id = isset($values[$idField]) ? $values[$idField] : null;

		$values = $this->allowUpdateValues($values);

		if ($item = $this->getItem($id, $idField))
			unset($values[$idField]);
		else $id = false;

		$types = $this->dbTypes(array_keys($values), null);

		if ($id) {
			$this->lastID = null;
			if ($dbp->bquery($this->updateQuery($id, $values, $idField), $types, array_values($values)))
				return $id;
		}
		else if ($dbp->bquery($this->insertQuery($values), $types, array_values($values)))
				return $this->lastID = $dbp->lastID();

		return false;
	}

	public function getLastId() {
		return $this->lastID;
	}

	protected function allowUpdateValues($values) {
		$fields = $this->getFields();
		$result = [];
		foreach ($values as $field=>$value)
			if (isset($fields[$field]) && 
				isset($fields[$field]['dbtype']))
				$result[$field] = $value;

		return $result;
	}

	protected function updateQuery($id, $values, $idField='id') {

		$updateList = [];
		$id = $this->verifyId($idField, $id);
		$fields = $this->getFields();
		$fieldList = array_keys($values);

		foreach($fieldList as $fieldName) {
			if (isset($fields[$fieldName]) && 
				($fieldName != $idField))
				$updateList[] = "`{$fieldName}`=?";
		}

		return "UPDATE `{$this->getTable()}` SET ".implode(',', $updateList)." WHERE `{$idField}`={$id}";
	}

	protected function insertQuery($values) {

		$fieldList = array_keys($values);
		$fields = $this->getFields();
		$valuesList = [];
		foreach($fieldList as $fieldName) 
			if (isset($fields[$fieldName]))
				$valuesList[] = '?';

		return "INSERT INTO {$this->getTable()} (".implode(',', $fieldList).") VALUES (".implode(',', $valuesList).")";
	}

	protected function dbTypes($fieldsList, $filedId='id')
	{
		$fields = $this->getFields();
		$types = '';
		foreach ($fieldsList as $field)
			if (($field != $filedId) and isset($fields[$field]))
				$types .= isset($fields[$field]['dbtype']) ? $fields[$field]['dbtype'] : 's';
		return $types;
	}

	protected function dbType($field)
	{
		$fields = $this->getFields();
		if (isset($fields[$field]))
			return isset($fields[$field]['dbtype']) ? $fields[$field]['dbtype'] : 's';
		return null;
	}

	public function getItems($options=null, $fieldNames = null, $operator = 'AND') {
		GLOBAL $dbp;
		if (is_string($options))
			return $this->getItemsWhere('WHERE '.$options);
		
		if (!$fieldNames && $options)
			$fieldNames = array_keys($options);

		$where = $fieldNames ? ('WHERE '.implode(" {$operator} ", BaseModel::GetConditions($options, $fieldNames))) : '';
		return $this->getItemsWhere($where);
	}

	public function getItemsWhere($where) {
		GLOBAL $dbp;
		return $dbp->asArray("SELECT * FROM {$this->getTable()} ".$where);
	}

	public function getItem($id, $idField = 'id') {		
		GLOBAL $dbp;

		if ($id) $id = $this->verifyId($idField, $id);
		
		return $id ? $dbp->line("SELECT * FROM {$this->getTable()} WHERE `{$idField}`={$id}") : $dbp->line("SELECT * FROM {$this->getTable()} LIMIT 1");
	}

	public function Delete($id, $idField = 'id') {		
		GLOBAL $dbp;
		return $dbp->bquery("DELETE FROM {$this->getTable()} WHERE `{$idField}`=?", $this->dbType($idField), [$id]);
	}

	public static  function AddWhere($whereList, $options, $paramName, $operand = '=') {
		$optionCondition = '';
		if (isset($options[$paramName])) {
			if (is_array($options[$paramName]))
				$optionCondition = "{$paramName} IN ('".implode("','", $options[$paramName])."')";
			else $optionCondition = "{$paramName} {$operand} '{$options[$paramName]}'";
		}
		if ($optionCondition) $whereList[] = $optionCondition;
		return $whereList;
	}

	public static  function GetConditions($values, $paramsNames, $operand = '=') {
		$list = [];

		if ($values)
			foreach ($paramsNames as $key=>$param)
				$list = BaseModel::AddWhere($list, $values, $param, $operand);

		return $list;
	}

	public static function getValues($values, $fields, $defaults) {
		$result = [];
		foreach ($fields as $i=>$field) {
			$v = isset($values[$field]) ? $values[$field] : $defaults[$i];
			if (is_object($v) || is_array($v))
				$v = json_encode($v);
			$result[] = $v;
		}
		return $result;
	}

	public static function getListValues($items, $field) {
		$result = [];

		foreach ($items as $item)
			if (isset($item[$field]))
				$result[] = $item[$field];

		return array_unique($result);
	}

	public static function FullItem($item, $models) {

		foreach ($models as $key=>$model) {
			$idpos = strpos($key, '_id');
			if ($idpos > -1) {
				$outfield = substr($key, 0, $idpos);
				if (@$item[$key])
					$item[$outfield] = $model->getItem($item[$key]);
			} else trace_error('Field '.$idpos.' not found');
		}

		return $item;
	}

	public static function FullItems($items, $models) {
		for ($i=0; $i<count($items); $i++)
			$items[$i] = BaseModel::FullItem($items[$i], $models);

		return $items;
	}
}
?>