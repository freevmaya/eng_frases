<?php

/**
 * Скрипт для перевода native_text на указанный язык
 * Использование: php translate_phrases.php <target_lang> [<source_direction>] [<limit>]
 * 
 * Примеры:
 * php translate_phrases.php de           # en-ru -> en-de (перевод native_text: русский -> немецкий)
 * php translate_phrases.php fr en-ru     # en-ru -> en-fr (перевод native_text: русский -> французский)
 * php translate_phrases.php es ru-en 100 # ru-en -> es-en (перевод native_text: английский -> испанский)
 * php translate_phrases.php it ru-en     # ru-en -> it-en (перевод native_text: английский -> итальянский)
 */

// Подключаем engine.php для использования функции YaTranslate и настроек БД
require_once __DIR__ . '/../engine.php';

// Проверка аргументов командной строки
if ($argc < 2) {
    echo "Ошибка: Не указан язык перевода\n";
    echo "Использование: php translate_phrases.php <target_lang> [<source_direction>] [<limit>]\n";
    echo "Пример: php translate_phrases.php de\n";
    echo "Пример: php translate_phrases.php fr en-ru\n";
    echo "Пример: php translate_phrases.php es ru-en 100\n";
    echo "Пример: php translate_phrases.php it ru-en\n";
    exit(1);
}

$target_lang = $argv[1];                          // Язык, на который переводим native_text (de, fr, es, it и т.д.)
$source_direction = $argv[2] ?? 'en-ru';           // Исходное направление (по умолчанию en-ru)
$limit = isset($argv[3]) ? (int)$argv[3] : 0;      // Лимит записей

// Разбираем исходное направление на составляющие
$direction_parts = explode('-', $source_direction);
if (count($direction_parts) != 2) {
    echo "❌ Ошибка: Неверный формат направления. Используйте формат 'язык-язык' (например, en-ru)\n";
    exit(1);
}

$source_from = $direction_parts[0];  // Язык оригинала (target_text) - остается неизменным

// Определяем новое направление
// Сохраняем первый язык (оригинал) и меняем второй на целевой
// Например: en-ru -> en-de, ru-en -> ru-de
$new_direction = $source_from . '-' . $target_lang;

echo "\n📊 Параметры перевода:\n";
echo "  - Исходное направление: $source_direction\n";
echo "    • target_text (остается): $source_from\n";
echo "    • native_text (переводим): $source_from -> $target_lang\n";
echo "  - Целевое направление: $new_direction\n";
echo "  - Язык перевода для native_text: $target_lang\n";
echo "  - Лимит: " . ($limit ?: 'без лимита') . "\n\n";

// Подключение к базе данных
try {
    $pdo = new PDO(
        "mysql:host=" . _dbhost . ";dbname=" . _dbname_default . ";charset=" . _db_charset,
        _dbuser,
        _dbpassword,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]
    );
    
    echo "✅ Подключение к базе данных успешно\n";
} catch (PDOException $e) {
    echo "❌ Ошибка подключения к БД: " . $e->getMessage() . "\n";
    exit(1);
}

// Проверяем существование таблицы
try {
    $check_table = $pdo->query("SHOW TABLES LIKE 'phrases'");
    if ($check_table->rowCount() == 0) {
        echo "❌ Таблица 'phrases' не найдена\n";
        exit(1);
    }
} catch (PDOException $e) {
    echo "❌ Ошибка при проверке таблицы: " . $e->getMessage() . "\n";
    exit(1);
}

// Получаем статистику
try {
    $stats_sql = "SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN direction = :source_dir THEN 1 ELSE 0 END) as available,
                    SUM(CASE WHEN direction = :new_dir THEN 1 ELSE 0 END) as already_exists
                  FROM phrases 
                  WHERE is_active = 1";
    
    $stats_stmt = $pdo->prepare($stats_sql);
    $stats_stmt->execute([
        ':source_dir' => $source_direction,
        ':new_dir' => $new_direction
    ]);
    
    $stats = $stats_stmt->fetch();
    
    echo "📈 Статистика:\n";
    echo "  - Всего активных фраз: {$stats['total']}\n";
    echo "  - Доступно для перевода ({$source_direction}): {$stats['available']}\n";
    echo "  - Уже переведено ({$new_direction}): {$stats['already_exists']}\n\n";
    
    if ($stats['available'] == 0) {
        echo "❌ Нет фраз для перевода с направлением {$source_direction}\n";
        exit(0);
    }
    
} catch (PDOException $e) {
    echo "❌ Ошибка при получении статистики: " . $e->getMessage() . "\n";
    exit(1);
}

// Получаем фразы для перевода
try {
    $sql = "SELECT id, target_text, native_text, context, difficulty_level, type_id
            FROM phrases 
            WHERE direction = :source_dir 
              AND is_active = 1
              AND NOT EXISTS (
                  SELECT 1 FROM phrases p2 
                  WHERE p2.target_text = phrases.target_text 
                    AND p2.direction = :new_dir
              )";
    
    if ($limit > 0) {
        $sql .= " LIMIT :limit";
    }
    
    $stmt = $pdo->prepare($sql);
    $stmt->bindValue(':source_dir', $source_direction);
    $stmt->bindValue(':new_dir', $new_direction);
    
    if ($limit > 0) {
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    }
    
    $stmt->execute();
    $phrases = $stmt->fetchAll();
    
} catch (PDOException $e) {
    echo "❌ Ошибка при получении фраз: " . $e->getMessage() . "\n";
    exit(1);
}

$total_phrases = count($phrases);
echo "✅ Найдено фраз для перевода: $total_phrases\n\n";

if ($total_phrases == 0) {
    echo "Все фразы уже переведены на {$target_lang} с направлением {$new_direction}\n";
    exit(0);
}

// Спрашиваем подтверждение
echo "🔍 Будет переведено $total_phrases фраз\n";
echo "   Исходное направление: {$source_direction} -> Новое направление: {$new_direction}\n";
echo "   target_text (язык {$source_from}) останется без изменений\n";
echo "   native_text будет переведен с {$source_from} на {$target_lang}\n";
echo "Продолжить? (y/n): ";
$handle = fopen("php://stdin", "r");
$line = trim(fgets($handle));
if ($line !== 'y' && $line !== 'Y') {
    echo "Операция отменена\n";
    exit(0);
}

// Переводим фразы
$success_count = 0;
$error_count = 0;
$counter = 0;

echo "\n🔄 Начинаем перевод...\n\n";

foreach ($phrases as $phrase) {
    $counter++;
    $id = $phrase['id'];
    $target_text = $phrase['target_text'];        // Остается неизменным
    $native_text = $phrase['native_text'];        // Это мы переводим
    $context = $phrase['context'];
    $difficulty = $phrase['difficulty_level'];
    $type_id = $phrase['type_id'];
    
    echo "[$counter/$total_phrases] ID: $id | Перевод native: " . mb_substr($native_text, 0, 50) . "...\n";
    
    try {
        // Переводим target_text с исходного языка (source_from) на целевой язык (target_lang)
        // Например, для en-ru: переводим английский -> немецкий
        $translated_native = YaTranslate($target_text, $target_lang);
        
        // Проверяем, не вернулась ли ошибка
        if (!$translated_native || strpos($translated_native, 'ОШИБКА') === 0 || strpos($translated_native, 'ERROR') === 0) {
            throw new Exception($translated_native ?: 'Пустой ответ от API');
        }
        
        // Вставляем новую запись
        // target_text - остается тот же (английский)
        // native_text - новый перевод (например, немецкий)
        $insert_sql = "INSERT INTO phrases 
                       (type_id, target_text, context, native_text, difficulty_level, direction, is_active) 
                       VALUES 
                       (:type_id, :target_text, :context, :native_text, :difficulty, :direction, 1)";
        
        $insert_stmt = $pdo->prepare($insert_sql);
        $insert_stmt->execute([
            ':type_id' => $type_id,
            ':target_text' => $target_text,
            ':context' => $context,
            ':native_text' => $translated_native,
            ':difficulty' => $difficulty,
            ':direction' => $new_direction
        ]);
        
        $new_id = $pdo->lastInsertId();
        $success_count++;
        
        echo "  ✅ Успешно -> Новая ID: $new_id\n";
        echo "     target (был): " . mb_substr($target_text, 0, 40) . (mb_strlen($target_text) > 40 ? '...' : '') . "\n";
        echo "     native (стал): " . mb_substr($translated_native, 0, 40) . (mb_strlen($translated_native) > 40 ? '...' : '') . "\n";
        
    } catch (Exception $e) {
        $error_count++;
        echo "  ❌ Ошибка: " . $e->getMessage() . "\n";
    }
    
    // Небольшая задержка между запросами к API
    usleep(300000); // 0.3 секунды
    
    // Прогресс каждые 10 фраз
    if ($counter % 10 == 0) {
        echo "\n📊 Прогресс: $counter/$total_phrases (✅ $success_count | ❌ $error_count)\n\n";
    }
}

// Итоговая статистика
echo "\n" . str_repeat("=", 60) . "\n";
echo "✅ ОПЕРАЦИЯ ЗАВЕРШЕНА\n";
echo str_repeat("=", 60) . "\n";
echo "Всего обработано: $total_phrases\n";
echo "✅ Успешно переведено: $success_count\n";
echo "❌ Ошибок: $error_count\n";

// Обновленная статистика
try {
    $final_stats = $pdo->prepare("
        SELECT 
            SUM(CASE WHEN direction = :new_dir THEN 1 ELSE 0 END) as new_count
        FROM phrases 
        WHERE is_active = 1
    ");
    $final_stats->execute([':new_dir' => $new_direction]);
    $final = $final_stats->fetch();
    
    echo "📊 Теперь фраз с направлением {$new_direction}: {$final['new_count']}\n";
    
} catch (PDOException $e) {
    // Игнорируем ошибку статистики
}

// Если были ошибки, показываем детали
if ($error_count > 0) {
    echo "\n⚠️  Внимание: $error_count фраз не были переведены из-за ошибок API\n";
    echo "Запустите скрипт повторно для перевода пропущенных фраз\n";
}

echo "\n";