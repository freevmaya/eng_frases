<?php
class PhraseTypesModel extends BaseModel {
    
    protected function getTable() {
        return 'phrase_types';
    }

    public function getFields() {
        return [
            'id' => [
                'type' => 'hidden',
                'dbtype' => 'i'
            ],
            'type_name' => [
                'label' => 'Type Name',
                'validator' => 'required|unique',
                'dbtype' => 's'
            ],
            'order' => [
                'label' => 'order',
                'type' => 'input',
                'dbtype' => 'i'
            ],
            'prefer_mode' => [
                'label' => 'prefer_mode',
                'dbtype' => '2'
            ],
            'description' => [
                'label' => 'Description',
                'type' => 'textarea',
                'dbtype' => 's'
            ],
            'is_active' => [
                'label' => 'Active',
                'type' => 'checkbox',
                'dbtype' => 'i',
                'default' => 1
            ],
            'created_at' => [
                'label' => 'Created',
                'type' => 'datetime',
                'dbtype' => 's',
                'readonly' => true
            ],
            'updated_at' => [
                'label' => 'Updated',
                'type' => 'datetime',
                'dbtype' => 's',
                'readonly' => true
            ]
        ];
    }

    public static function getPreferModes() {
        GLOBAL $dbp;
        
        $query = "
            SELECT 
                t.type_name,
                t.prefer_mode
            FROM phrase_types t WHERE t.is_active = 1 AND t.prefer_mode IS NOT NULL AND t.prefer_mode > ''
        ";

        $list = $dbp->asArray($query);
        $result = [];
        foreach ($list as $item)
            $result[$item['type_name']] = $item['prefer_mode'];
        
        return $result;
    }

    public function NextOrPrevType($type_id, $direction, $next = true) {
        GLOBAL $dbp;

        $cmd = $next ? '>' : '<';

        $list = $dbp->asArray("SELECT * FROM `phrase_types` t WHERE t.id {$cmd} {$type_id} AND t.is_active = 1 AND (SELECT COUNT(id) FROM phrases WHERE type_id = t.id AND is_active = 1 AND direction = '{$direction}') > 0;");

        if (count($list) > 0)
            return $next ? $list[0] : $list[count($list) - 1];
        return null;
    }
}
?>