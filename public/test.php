<?php
// /home/vmaya/www/eng_frases/public/test.php
echo "PHP работает!\n\n";

echo "GET параметры:\n";
print_r($_GET);

echo "\nPOST параметры:\n"; 
print_r($_POST);

echo "\nSERVER:\n";
echo "QUERY_STRING: " . ($_SERVER['QUERY_STRING'] ?? 'пусто') . "\n";
echo "REQUEST_METHOD: " . $_SERVER['REQUEST_METHOD'] . "\n";
echo "SCRIPT_NAME: " . $_SERVER['SCRIPT_NAME'] . "\n";
echo "REQUEST_URI: " . $_SERVER['REQUEST_URI'] . "\n";

echo "\n\nВсе параметры запроса:\n";
print_r($_REQUEST);