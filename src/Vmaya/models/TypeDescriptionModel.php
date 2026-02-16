<?php
class TypeDescriptionModel extends BaseModel {
    
    protected function getTable() {
        return 'type_description';
    }

    public function getFields() {
        return [
            'id' => [
                'type' => 'hidden',
                'dbtype' => 'i'
            ],
            'list_id' => [
                'label' => 'list_id',
                'dbtype' => 'i'
            ],
            'name' => [
                'label' => 'name',
                'dbtype' => 's'
            ],
            'description' => [
                'label' => 'description',
                'dbtype' => 's'
            ],
            'lang' => [
                'label' => 'lang',
                'dbtype' => 's'
            ]
        ];
    }

    public function getAllItems($a_lang) {
    	GLOBAL $dbp;
	    
	    // Выполняем JOIN запрос для получения всех данных за один раз
	    $query = "
	        SELECT 
	            pt.type_name,
	            d.name,
	            d.description
	        FROM {$this->getTable()} d
	        INNER JOIN phrase_types pt ON d.list_id = pt.id
	        WHERE pt.is_active = 1 AND d.lang = '{$a_lang}'
	        ORDER BY pt.`order`
	    ";
	    
	    $list = $dbp->asArray($query);
	    $result = [];

	    foreach ($list as $item)
	    	$result[$item['type_name']] = ['name'=>$item['name'], 'description'=>$item['description']];

	    return $result;
    }
}
?>