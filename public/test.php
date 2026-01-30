<?php


session_start();
require dirname(__FILE__, 2).'/src/Vmaya/engine.php';
		
$dbp = new mySQLProvider('localhost', _dbname_default, _dbuser, _dbpassword);

$source_id = "44108006";
$source = 'vk" AND (SELECT SLEEP(10)) AND id != "0';

$source = $dbp->safeVal($source);

$where = "source_id = ".$source_id." AND source = '{$source}'";

echo "$where\n";

$items = (new UserModel())->getItems($where);

print_r($items);

$dbp->Close();