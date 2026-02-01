<?php
class UserStateModel extends BaseModel {
    
    protected function getTable() {
        return 'user_state';
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
            'data' => [
                'label' => 'data',
                'dbtype' => 's'
            ]
        ];
    }
}
?>