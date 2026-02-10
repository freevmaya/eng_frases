<?php
class UserListsModel extends BaseModel {
    
    protected function getTable() {
        return 'user_lists';
    }

    public function Delete($id, $idField = 'id') { 
        if ($result = parent::Delete($id, $idField)) {
            return (new UserPhrasesModel())->Delete($id, 'list_id');
        }
        return false;
    }

    public function getFields() {
        return [
            'id' => [
                'type' => 'hidden',
                'dbtype' => 'i'
            ],
            'user_id' => [
                'label' => 'user_id',
                'dbtype' => 'i'
            ],
            'order' => [
                'label' => 'order',
                'dbtype' => 'i'
            ],
            'name' => [
                'label' => 'name',
                'dbtype' => 's'
            ],
            'description' => [
                'label' => 'description',
                'dbtype' => 'i'
            ]
        ];
    }
}
?>