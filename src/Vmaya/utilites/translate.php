<?php

/**
 * Утилита для перевода языкового файла
 * Использование: php translate_lang.php <target_lang>
 * Пример: php translate_lang.php en
 */


require '../engine.php';
define('TRANSLATE_DIR', '../language/');

// Проверка аргументов командной строки
if ($argc < 2) {
    echo "Ошибка: Не указан язык перевода\n";
    echo "Использование: php translate_lang.php <target_lang>\n";
    echo "Пример: php translate_lang.php en\n";
    echo "Пример: php translate_lang.php de\n";
    echo "Пример: php translate_lang.php fr\n";
    exit(1);
}


$target_lang = $argv[1];
$source_file = TRANSLATE_DIR.'ru.php';

// Проверка существования исходного файла
if (!file_exists($source_file)) {
    echo "Ошибка: Файл '$source_file' не найден\n";
    exit(1);
}

// Чтение исходного файла
echo "Чтение файла: $source_file\n";
$content = file_get_contents($source_file);

// Извлечение массива $lang из файла
$pattern = '/\$lang\s*=\s*\[(.*?)\];/s';
if (!preg_match($pattern, $content, $matches)) {
    echo "Ошибка: Не удалось найти массив \$lang в файле\n";
    exit(1);
}

// Оценка массива
$lang_code = '<?php $lang = ' . $matches[0] . ' ?>';
eval('?>' . $lang_code);

if (!isset($lang) || !is_array($lang)) {
    echo "Ошибка: Не удалось загрузить массив \$lang\n";
    exit(1);
}

echo "Найдено элементов для перевода: " . count($lang) . "\n";
echo "Перевод на язык: $target_lang\n\n";

// Функция для форматирования PHP массива в читаемый вид
function formatArrayToPHP($array, $indent = 0) {
    $output = "[\n";
    $indent_str = str_repeat('    ', $indent + 1);
    $closing_indent = str_repeat('    ', $indent);
    
    foreach ($array as $key => $value) {
        $formatted_key = is_numeric($key) ? $key : "'" . addslashes($key) . "'";
        
        if (is_array($value)) {
            $output .= $indent_str . $formatted_key . " => " . formatArrayToPHP($value, $indent + 1);
        } else {
            $escaped_value = addslashes($value);
            $output .= $indent_str . $formatted_key . " => '" . $escaped_value . "',\n";
        }
    }
    
    $output .= $closing_indent . "]";
    return $output;
}

// Функция для восстановления плейсхолдеров после перевода
function restorePlaceholders($translated_text, $original_text) {
    // Находим все плейсхолдеры %1, %2 и т.д. в оригинале
    preg_match_all('/%\d+/', $original_text, $matches);
    $placeholders = $matches[0] ?? [];
    
    // Восстанавливаем каждый плейсхолдер
    foreach ($placeholders as $placeholder) {
        // Ищем позицию плейсхолдера в оригинале, чтобы понять контекст
        if (strpos($translated_text, $placeholder) === false) {
            // Если плейсхолдер потерян, пытаемся найти его по контексту
            // В простейшем случае просто добавляем его в конец или заменяем похожие конструкции
            $translated_text .= ' ' . $placeholder;
        }
    }
    
    return $translated_text;
}

// Перевод значений
$translated_lang = [];
$counter = 0;
$errors = [];

foreach ($lang as $key => $value) {
    $counter++;
    
    // Пропускаем html_lang - это специальный ключ
    if ($key === 'html_lang') {
        $translated_lang[$key] = $target_lang;
        echo "[$counter/" . count($lang) . "] Установлен ключ 'html_lang' = $target_lang\n";
        continue;
    }
    
    // Пропускаем пустые строки
    if (empty($value)) {
        $translated_lang[$key] = $value;
        echo "[$counter/" . count($lang) . "] Пропущен пустой элемент: $key\n";
        continue;
    }
    
    // Пропускаем числовые значения
    if (is_numeric($value)) {
        $translated_lang[$key] = $value;
        echo "[$counter/" . count($lang) . "] Пропущено числовое значение: $key = $value\n";
        continue;
    }
    
    echo "[$counter/" . count($lang) . "] Перевод: $key... ";
    
    // Сохраняем оригинал для восстановления плейсхолдеров
    $original_value = $value;
    
    // Выполняем перевод с помощью функции из engine.php
    try {
        $translated = YaTranslate($value, $target_lang);
        
        // Проверяем, не вернулась ли ошибка
        if (strpos($translated, 'ОШИБКА') === 0 || strpos($translated, 'ERROR') === 0) {
            echo "Ошибка!\n";
            $errors[] = "$key: $translated";
            $translated_lang[$key] = $value; // Оставляем оригинал
        } else {
            // Восстанавливаем плейсхолдеры, если они были потеряны
            $translated = restorePlaceholders($translated, $original_value);
            $translated_lang[$key] = $translated;
            echo "OK\n";
        }
    } catch (Exception $e) {
        echo "Исключение!\n";
        $errors[] = "$key: " . $e->getMessage();
        $translated_lang[$key] = $value; // Оставляем оригинал
    }
    
    // Небольшая задержка, чтобы не превысить лимиты API
    usleep(300000); // 0.3 секунды
}

echo "\nПеревод завершен!\n";
if (!empty($errors)) {
    echo "\nОшибки (" . count($errors) . "):\n";
    foreach ($errors as $error) {
        echo "  - $error\n";
    }
}

// Формирование содержимого нового файла
$output_content = "<?php\n\n";
$output_content .= '$lang = ' . formatArrayToPHP($translated_lang, 0) . ";\n";
$output_content .= "?>";

// Сохранение в новый файл
$output_file = TRANSLATE_DIR.$target_lang.'.php';

if (file_put_contents($output_file, $output_content)) {
    echo "\n✅ Файл успешно сохранен: $output_file\n";
    echo "Размер файла: " . filesize($output_file) . " байт\n";
    echo "Переведено элементов: " . (count($lang) - count($errors)) . "\n";
    if (!empty($errors)) {
        echo "Элементов с ошибками: " . count($errors) . " (оставлены оригиналы)\n";
    }
} else {
    echo "\n❌ Ошибка при сохранении файла: $output_file\n";
    exit(1);
}

?>