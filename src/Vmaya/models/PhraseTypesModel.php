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
}
?>