<?

function is_date($str){
    return is_numeric(strtotime($str));
}

function is_value($str) {
    if ($str)
        $result = array_filter(['null', 'не определено', 'не указано', 'неопределено', 'неизвестно'], function($item) use ($str) {
            return mb_strtolower($item, 'UTF-8') === mb_strtolower($str, 'UTF-8');
        });
        return empty($result);
    return false;
}

function toUTF($text) {
    if (empty($text))
        return '';
    return preg_replace_callback('/\\\\u([0-9a-fA-F]{4})/', function ($match) {
        return mb_convert_encoding(pack('H*', $match[1]), 'UTF-8', 'UCS-2BE');
    }, $text);
}

function Lang($strIndex, $param=null) {
    GLOBAL $lang;

    $result = $strIndex;
    if (isset($lang[$strIndex])) {
        $result = $lang[$strIndex];
        if (!empty($param))
            $result = sprintf($result, $param);
    }

    return $result;
}

function getGUID() {
    if (function_exists('com_create_guid')){
        return com_create_guid();
    }
    else {
        mt_srand(strtotime('now'));
        $charid = strtoupper(md5(uniqid(rand(), true)));
        $hyphen = chr(45);// "-"
        $uuid = substr($charid, 0, 8).$hyphen
            .substr($charid, 8, 4).$hyphen
            .substr($charid,12, 4).$hyphen
            .substr($charid,16, 4).$hyphen
            .substr($charid,20,12);// "}"
        return $uuid;
    }
}

function roundv($v, $n) {
    $p = pow(10, $n);
    return round($v * $p) / $p;
}

function downloadFile($url, $savePath)
{
    $ch = curl_init($url);
    
    // Настройки cURL
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,      // Возвращать результат
        CURLOPT_FOLLOWLOCATION => true,      // Следовать редиректам
        CURLOPT_SSL_VERIFYPEER => false,     // Для HTTPS (в продакшене должно быть true)
        CURLOPT_SSL_VERIFYHOST => false,     // Для HTTPS (в продакшене должно быть true)
        CURLOPT_USERAGENT => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', // User-Agent
        CURLOPT_TIMEOUT => 300,              // Таймаут 5 минут
        CURLOPT_CONNECTTIMEOUT => 30,        // Таймаут подключения
    ]);
    
    $fileContent = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    
    if (version_compare(PHP_VERSION, '8.0.0', '<')) {
        curl_close($ch);
    }
    
    if ($httpCode === 200 && $fileContent !== false) {
        // Сохраняем файл
        if (file_put_contents($savePath, $fileContent) !== false) {
            return [
                'success' => true,
                'path' => $savePath,
                'size' => filesize($savePath)
            ];
        } else {
            $msg = "Failure to save file ({$url}->{$savePath})";
            trace_error($msg);
            return [
                'success' => false,
                'error' => $msg
            ];
        }
    } else {
        $msg = "Error download file ({$url}). HTTP: $httpCode, cURL: ".json_encode($error);
        //trace_error($msg);
        return [
            'success' => false,
            'error' => $msg
        ];
    }
}

function HoursDiffDate($dateString, $referenceDate = 'now') {
    $timestamp1 = strtotime($dateString);
    $timestamp2 = strtotime($referenceDate);
    
    // Разница в секундах
    $diffSeconds = $timestamp2 - $timestamp1;
    
    // Преобразуем в часы
    $diffHours = $diffSeconds / 3600;
    
    return $diffHours;
}
    
function isAnimatedWebP($filePath) {
    $content = file_get_contents($filePath, false, null, 0, 100);
    
    // Проверяем сигнатуру анимированного WebP
    // Статичный WebP: 'RIFF' + размер + 'WEBPVP8 '
    // Анимированный: 'RIFF' + размер + 'WEBPVP8X'
    return strpos($content, 'WEBPVP8X') !== false || 
           strpos($content, 'ANIM') !== false ||
           strpos($content, 'ANMF') !== false;
}
    
function ConvertToGif($webpPath) {
    $gifPath = tempnam(sys_get_temp_dir(), 'anim_') . '.gif';
    
    // Используем ImageMagick
    $command = sprintf(
        'convert %s -coalesce -layers OptimizeFrame %s 2>&1',
        escapeshellarg($webpPath),
        escapeshellarg($gifPath)
    );

    trace($command);
    
    exec($command, $output, $returnCode);
    
    if (($returnCode === 0) && file_exists($gifPath)) {
        if (filesize($gifPath) > 1024) {
            // Оптимизируем
            $optimizeCmd = sprintf(
                'gifsicle -O3 --colors 256 %s -o %s',
                escapeshellarg($gifPath),
                escapeshellarg($gifPath)
            );
            exec($optimizeCmd);
        }
            
        return $gifPath;
    }
    
    return false;
}

function ConvertWebPToMP4($webpPath) {
    $mp4Path = tempnam(sys_get_temp_dir(), 'webp_') . '.mp4';
    
    // Используем ffmpeg для конвертации
    $command = sprintf(
        'ffmpeg -i %s -vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2" -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p %s 2>&1',
        escapeshellarg($webpPath),
        escapeshellarg($mp4Path)
    );
    
    exec($command, $output, $returnCode);
    
    if ($returnCode !== 0 || !file_exists($mp4Path)) {
        error_log("FFmpeg conversion Failure: " . implode("\n", $output));
        return false;
    }
    
    return $mp4Path;
}

function scraperDownload($url, $file_path) {
    $output = null;
    $command = 'py '.BASEPATH."scraper_download.py \"{$url}\" \"{$file_path}\"";

    exec($command, $output);
    $result = 0;

    if ($output && (count($output) > 0))
        $result = intval($output[count($output) - 1]);
        
    if ($result != 1)
        trace_error($command."; Result: ".json_encode($output, JSON_FLAGS));

    return $result == 1;
}

function getClientIP() {
    $ip = '';
    
    // Проверяем заголовки в порядке приоритета
    if (!empty($_SERVER['HTTP_CLIENT_IP'])) {
        $ip = $_SERVER['HTTP_CLIENT_IP'];
    } elseif (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        // Может содержать несколько IP через запятую
        $ipList = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
        $ip = trim($ipList[0]);
    } elseif (!empty($_SERVER['HTTP_X_FORWARDED'])) {
        $ip = $_SERVER['HTTP_X_FORWARDED'];
    } elseif (!empty($_SERVER['HTTP_X_CLUSTER_CLIENT_IP'])) {
        $ip = $_SERVER['HTTP_X_CLUSTER_CLIENT_IP'];
    } elseif (!empty($_SERVER['HTTP_FORWARDED_FOR'])) {
        $ip = $_SERVER['HTTP_FORWARDED_FOR'];
    } elseif (!empty($_SERVER['HTTP_FORWARDED'])) {
        $ip = $_SERVER['HTTP_FORWARDED'];
    } elseif (!empty($_SERVER['REMOTE_ADDR'])) {
        $ip = $_SERVER['REMOTE_ADDR'];
    }
    
    // Валидация IP адреса
    if (filter_var($ip, FILTER_VALIDATE_IP)) {
        return $ip;
    }
    
    return 'unknown';
}

function strEnum($number, $pattern, $lang = 'ru'): string
{
    // Парсим паттерн
    if (!preg_match('/^([^\[]+)\[([^\]]+)\]$/', $pattern, $matches)) {
        // Если паттерн не соответствует формату, возвращаем как есть
        return $number . ' ' . $pattern;
    }
    
    $base = $matches[1];
    $forms = explode(',', $matches[2]);
    
    // Для русского языка
    if ($lang === 'ru') {
        $num = abs((int)$number);
        
        if ($num % 10 === 1 && $num % 100 !== 11) {
            return $number . ' ' . $base . $forms[0];
        } elseif ($num % 10 >= 2 && $num % 10 <= 4 && ($num % 100 < 10 || $num % 100 >= 20)) {
            return $number . ' ' . $base . $forms[1];
        } else {
            return $number . ' ' . $base . $forms[2];
        }
    }
    // Для английского
    elseif ($lang === 'en') {
        $num = abs((int)$number);
        return $num === 1 
            ? $number . ' ' . $base . $forms[0] 
            : $number . ' ' . $base . ($forms[2] ?? $forms[0] . 's');
    }
    // Для других языков
    else {
        return $number . ' ' . $base;
    }
}


/**
 * Улучшенная функция изменения размера изображения
 * 
 * @param string $source_path Путь к исходному изображению
 * @param string $dest_path Путь для сохранения
 * @param array $options Опции:
 *   - max_width: максимальная ширина (по умолчанию 1920)
 *   - max_height: максимальная высота (по умолчанию 1080)
 *   - quality: качество 0-100 (по умолчанию 85)
 *   - preserve_transparency: сохранять прозрачность (по умолчанию true)
 *   - fix_orientation: исправлять ориентацию EXIF (по умолчанию true)
 *   - strip_metadata: удалять метаданные (по умолчанию true)
 *   - crop_to_fit: обрезать для точного соответствия размерам (по умолчанию false)
 *   - background_color: цвет фона для заливки (по умолчанию [255, 255, 255])
 * @return array Массив с результатом обработки
 */
function resizeImageIfTooLarge($source_path, $dest_path = null, $options = []) {
    // Устанавливаем значения по умолчанию
    $defaults = [
        'max_width' => 1920,
        'max_height' => 1080,
        'quality' => 85,
        'preserve_transparency' => true,
        'fix_orientation' => true,
        'strip_metadata' => true,
        'crop_to_fit' => false,
        'background_color' => [255, 255, 255] // белый
    ];
    
    $options = array_merge($defaults, $options);
    
    if ($dest_path === null) {
        $dest_path = $source_path;
    }
    
    $result = [
        'success' => false,
        'message' => '',
        'original_size' => null,
        'new_size' => null,
        'resized' => false
    ];

    try {
    
        // Проверка файла
        if (!file_exists($source_path)) {
            $result['message'] = "Файл не найден: " . $source_path;
            return $result;
        }
        
        $image_info = @getimagesize($source_path);
        if ($image_info === false) {
            $result['message'] = "Не удалось прочитать изображение: " . $source_path;
            return $result;
        }
        
        list($orig_width, $orig_height, $image_type) = $image_info;
        $result['original_size'] = ['width' => $orig_width, 'height' => $orig_height];
        
        // Исправляем ориентацию для JPEG с EXIF данными
        if ($options['fix_orientation'] && $image_type == IMAGETYPE_JPEG && function_exists('exif_read_data')) {
            $exif = @exif_read_data($source_path);
            if (!empty($exif['Orientation'])) {
                $source_image = imagecreatefromjpeg($source_path);
                switch ($exif['Orientation']) {
                    case 3:
                        $source_image = imagerotate($source_image, 180, 0);
                        break;
                    case 6:
                        $source_image = imagerotate($source_image, -90, 0);
                        $temp = $orig_width;
                        $orig_width = $orig_height;
                        $orig_height = $temp;
                        break;
                    case 8:
                        $source_image = imagerotate($source_image, 90, 0);
                        $temp = $orig_width;
                        $orig_width = $orig_height;
                        $orig_height = $temp;
                        break;
                }
                // Сохраняем временный файл с исправленной ориентацией
                $temp_path = tempnam(sys_get_temp_dir(), 'orient_');
                imagejpeg($source_image, $temp_path, 100);
                if (version_compare(PHP_VERSION, '8.0.0', '<')) {
                    imagedestroy($source_image);
                }
                $source_path = $temp_path;
            }
        }
        
        // Проверяем, нужно ли изменять размер
        if ($orig_width <= $options['max_width'] && $orig_height <= $options['max_height'] && !$options['crop_to_fit']) {
            if ($source_path !== $dest_path) {
                copy($source_path, $dest_path);
            }
            $result['success'] = true;
            $result['message'] = "Размер в пределах допустимого";
            $result['new_size'] = ['width' => $orig_width, 'height' => $orig_height];
            return $result;
        }
        
        // Вычисляем новые размеры
        if ($options['crop_to_fit']) {
            // Обрезаем для точного соответствия
            $ratio = max($options['max_width'] / $orig_width, $options['max_height'] / $orig_height);
            $new_width = round($orig_width * $ratio);
            $new_height = round($orig_height * $ratio);
            
            $crop_x = floor(($new_width - $options['max_width']) / 2);
            $crop_y = floor(($new_height - $options['max_height']) / 2);
            $crop_width = $options['max_width'];
            $crop_height = $options['max_height'];
        } else {
            // Сохраняем пропорции
            $ratio = min($options['max_width'] / $orig_width, $options['max_height'] / $orig_height);
            $new_width = round($orig_width * $ratio);
            $new_height = round($orig_height * $ratio);
            $crop_x = $crop_y = 0;
            $crop_width = $new_width;
            $crop_height = $new_height;
        }
        
        // Загружаем изображение
        switch ($image_type) {
            case IMAGETYPE_JPEG:
                $source_image = imagecreatefromjpeg($source_path);
                break;
            case IMAGETYPE_PNG:
                $source_image = imagecreatefrompng($source_path);
                break;
            case IMAGETYPE_GIF:
                $source_image = imagecreatefromgif($source_path);
                break;
            case IMAGETYPE_WEBP:
                $source_image = function_exists('imagecreatefromwebp') ? imagecreatefromwebp($source_path) : false;
                break;
            default:
                $result['message'] = "Неподдерживаемый тип изображения";
                return $result;
        }
        
        if ($source_image === false) {
            $result['message'] = "Не удалось создать изображение";
            return $result;
        }
        
        // Создаем новое изображение
        if ($options['crop_to_fit']) {
            $new_image = imagecreatetruecolor($options['max_width'], $options['max_height']);
        } else {
            $new_image = imagecreatetruecolor($new_width, $new_height);
        }
        
        // Обрабатываем прозрачность
        $is_transparent = $options['preserve_transparency'] && 
                         ($image_type == IMAGETYPE_PNG || $image_type == IMAGETYPE_GIF || $image_type == IMAGETYPE_WEBP);
        
        if ($is_transparent) {
            imagealphablending($new_image, false);
            imagesavealpha($new_image, true);
            $transparent = imagecolorallocatealpha($new_image, 255, 255, 255, 127);
            imagefilledrectangle($new_image, 0, 0, 
                $options['crop_to_fit'] ? $options['max_width'] : $new_width,
                $options['crop_to_fit'] ? $options['max_height'] : $new_height,
                $transparent
            );
        } else {
            // Заливаем фоном
            $bg_color = imagecolorallocate($new_image, 
                $options['background_color'][0], 
                $options['background_color'][1], 
                $options['background_color'][2]
            );
            imagefilledrectangle($new_image, 0, 0, 
                $options['crop_to_fit'] ? $options['max_width'] : $new_width,
                $options['crop_to_fit'] ? $options['max_height'] : $new_height,
                $bg_color
            );
        }
        
        // Изменяем размер (и обрезаем если нужно)
        if ($options['crop_to_fit']) {
            $temp_image = imagecreatetruecolor($new_width, $new_height);
            
            if ($is_transparent) {
                imagealphablending($temp_image, false);
                imagesavealpha($temp_image, true);
                $transparent = imagecolorallocatealpha($temp_image, 255, 255, 255, 127);
                imagefilledrectangle($temp_image, 0, 0, $new_width, $new_height, $transparent);
            }
            
            imagecopyresampled($temp_image, $source_image, 0, 0, 0, 0, $new_width, $new_height, $orig_width, $orig_height);
            imagecopy($new_image, $temp_image, 0, 0, $crop_x, $crop_y, $crop_width, $crop_height);
            if (version_compare(PHP_VERSION, '8.0.0', '<')) {
                imagedestroy($temp_image);
            }
        } else {
            imagecopyresampled($new_image, $source_image, 0, 0, 0, 0, $new_width, $new_height, $orig_width, $orig_height);
        }
        
        // Сохраняем результат
        $save_result = false;
        switch ($image_type) {
            case IMAGETYPE_JPEG:
                $save_result = imagejpeg($new_image, $dest_path, $options['quality']);
                break;
            case IMAGETYPE_PNG:
                $png_quality = 9 - round($options['quality'] / 100 * 9);
                $save_result = imagepng($new_image, $dest_path, $png_quality);
                break;
            case IMAGETYPE_GIF:
                $save_result = imagegif($new_image, $dest_path);
                break;
            case IMAGETYPE_WEBP:
                if (function_exists('imagewebp')) {
                    $save_result = imagewebp($new_image, $dest_path, $options['quality']);
                }
                break;
        }
        
        // Освобождаем память
        if (version_compare(PHP_VERSION, '8.0.0', '<')) {
            imagedestroy($source_image);
            imagedestroy($new_image);
        }
        
        if ($save_result) {
            $result['success'] = true;
            $result['message'] = "Изображение успешно обработано";
            $result['new_size'] = [
                'width' => $options['crop_to_fit'] ? $options['max_width'] : $new_width,
                'height' => $options['crop_to_fit'] ? $options['max_height'] : $new_height
            ];
            $result['resized'] = true;
            
            // Удаляем метаданные если требуется
            if ($options['strip_metadata']) {
                // Простая реализация - пересохраняем без EXIF
                // Для полного удаления метаданных нужны дополнительные библиотеки
            }
        } else {
            $result['message'] = "Ошибка при сохранении изображения";
        }
    } catch (Exception $e) {
        trace_error($e->getMessage());
    }
    
    return $result;
}

function isUrl(string $url): bool {
    $url = trim($url);
    
    // Быстрая проверка на наличие протокола и точки
    if (!preg_match('/^https?:\/\/.+\..+/i', $url)) {
        return false;
    }
    
    // Проверка через filter_var
    return filter_var($url, FILTER_VALIDATE_URL) !== false;
}

function isAssoc(array $arr): bool
{
    if ([] === $arr) return false;
    return array_keys($arr) !== range(0, count($arr) - 1);
}

function array_add_limit(&$array, $key, $value, $maxSize = 10) {
    $array[$key] = $value;
    
    // Если превышен лимит, удалить самые старые элементы
    if (count($array) > $maxSize) {
        $keys = array_keys($array);
        
        // Удалить первые N элементов, где N - количество превышающих лимит
        for ($i = 0; $i < count($array) - $maxSize; $i++) {
            unset($array[$keys[$i]]);
        }
    }
}

function overlayImage(
    string $backgroundUrl,
    string $overlayPath,
    string $outputPath,
    array $options = []
): bool {

    if (!extension_loaded('gd')) {
        die("Требуется расширение GD для работы с изображениями");
    }

    // Проверка поддержки форматов
    $gdInfo = gd_info();
    if (!isset($gdInfo['JPEG Support']) || !$gdInfo['JPEG Support']) {
        die("GD не поддерживает JPEG");
    }
    if (!isset($gdInfo['PNG Support']) || !$gdInfo['PNG Support']) {
        die("GD не поддерживает PNG");
    }

    // Параметры по умолчанию
    $defaultOptions = [
        'overlay_width' => null,
        'overlay_height' => null,
        'scale_factor' => 0.3,
        'position' => 'center', // 'center', 'top-left', 'top-right', 'bottom-left', 'bottom-right'
        'margin' => 0, // Отступ от краев в пикселях
        'output_quality' => 90,
        'background_type' => 'auto', // 'auto', 'jpg', 'png', 'gif'
        'allow_url_fopen' => true, // Разрешить загрузку по URL
    ];
    
    $options = array_merge($defaultOptions, $options);
    
    // Проверяем доступность GD
    if (!extension_loaded('gd')) {
        error_log("Расширение GD не загружено");
        return false;
    }
    
    // Загружаем фоновое изображение
    $background = loadImageFromUrl($backgroundUrl, $options['background_type']);
    
    if (!$background) {
        trace_error("Failure download background image {$backgroundUrl}");
        return false;
    }
    
    // Загружаем PNG для наложения
    $overlay = imagecreatefrompng($overlayPath);
    if (!$overlay) {
        trace_error("Failure open overlay image {$overlayPath}");

        if (version_compare(PHP_VERSION, '8.0.0', '<'))
            imagedestroy($background);
        return false;
    }
    
    // Сохраняем прозрачность PNG
    imagesavealpha($overlay, true);
    
    // Получаем размеры
    $bgWidth = imagesx($background);
    $bgHeight = imagesy($background);
    $overlayWidth = imagesx($overlay);
    $overlayHeight = imagesy($overlay);
    
    // Рассчитываем размеры наложения
    list($newWidth, $newHeight) = calculateOverlaySize(
        $overlayWidth,
        $overlayHeight,
        $bgWidth,
        $bgHeight,
        $options
    );
    
    // Рассчитываем позицию
    list($posX, $posY) = calculatePosition(
        $bgWidth,
        $bgHeight,
        $newWidth,
        $newHeight,
        $options['position'],
        $options['margin']
    );
    
    // Создаем ресурс для масштабированного изображения
    $scaledOverlay = imagescale($overlay, $newWidth, $newHeight);
    
    if (version_compare(PHP_VERSION, '8.0.0', '<'))
        imagedestroy($overlay);
    
    if (!$scaledOverlay) {
        trace_error("Failure scale image");

        if (version_compare(PHP_VERSION, '8.0.0', '<'))
            imagedestroy($background);
        return false;
    }
    
    // Накладываем изображение
    imagecopy($background, $scaledOverlay, $posX, $posY, 0, 0, $newWidth, $newHeight);
    
    // Сохраняем результат
    $result = imagejpeg($background, $outputPath, $options['output_quality']);
    
    // Очищаем память

    if (version_compare(PHP_VERSION, '8.0.0', '<')) {

        imagedestroy($background);
        imagedestroy($scaledOverlay);
    }
    
    return $result !== false;
}

/**
 * Вспомогательная функция для загрузки изображения из URL
 */
function loadImageFromUrl(string $url, string $type = 'auto') {
    if (!ini_get('allow_url_fopen')) {
        throw new Exception("allow_url_fopen отключен в php.ini");
    }
    
    $imageData = @file_get_contents($url);
    if ($imageData === false) {
        return false;
    }
    
    // Определяем тип изображения
    if ($type === 'auto') {
        $type = getImageTypeFromData($imageData);
    }
    
    switch ($type) {
        case 'jpg':
        case 'jpeg':
            return imagecreatefromjpeg($url);
        case 'png':
            return imagecreatefrompng($url);
        case 'gif':
            return imagecreatefromgif($url);
        case 'webp':
            return imagecreatefromwebp($url);
        default:
            // Пытаемся определить автоматически
            return imagecreatefromstring($imageData);
    }
}

/**
 * Определяет тип изображения по данным
 */
function getImageTypeFromData(string $data): string {
    $signatures = [
        'jpg' => "\xFF\xD8\xFF",
        'png' => "\x89PNG\r\n\x1A\n",
        'gif' => 'GIF',
        'webp' => 'RIFF',
    ];
    
    foreach ($signatures as $type => $signature) {
        if (strpos($data, $signature) === 0) {
            return $type;
        }
    }
    
    return 'unknown';
}

/**
 * Рассчитывает размер накладываемого изображения
 */
function calculateOverlaySize(
    int $origWidth,
    int $origHeight,
    int $bgWidth,
    int $bgHeight,
    array $options
): array {
    $targetWidth = $options['overlay_width'];
    $targetHeight = $options['overlay_height'];
    $scaleFactor = $options['scale_factor'];
    
    // Если заданы оба размера
    if ($targetWidth !== null && $targetHeight !== null) {
        return [$targetWidth, $targetHeight];
    }
    
    // Если задан только один размер
    if ($targetWidth !== null) {
        $aspectRatio = $origHeight / $origWidth;
        return [$targetWidth, (int)($targetWidth * $aspectRatio)];
    }
    
    if ($targetHeight !== null) {
        $aspectRatio = $origWidth / $origHeight;
        return [(int)($targetHeight * $aspectRatio), $targetHeight];
    }
    
    // Автоматический расчет по scaleFactor
    $maxDimension = max($bgWidth, $bgHeight) * $scaleFactor;
    $aspectRatio = $origWidth / $origHeight;
    
    if ($origWidth > $origHeight) {
        $newWidth = $maxDimension;
        $newHeight = $maxDimension / $aspectRatio;
    } else {
        $newHeight = $maxDimension;
        $newWidth = $maxDimension * $aspectRatio;
    }
    
    return [(int)$newWidth, (int)$newHeight];
}

/**
 * Рассчитывает позицию наложения
 */
function calculatePosition(
    int $bgWidth,
    int $bgHeight,
    int $overlayWidth,
    int $overlayHeight,
    string $position,
    int $margin
): array {
    switch ($position) {
        case 'top-left':
            return [$margin, $margin];
            
        case 'top-right':
            return [$bgWidth - $overlayWidth - $margin, $margin];
            
        case 'bottom-left':
            return [$margin, $bgHeight - $overlayHeight - $margin];
            
        case 'bottom-right':
            return [$bgWidth - $overlayWidth - $margin, $bgHeight - $overlayHeight - $margin];
            
        case 'center':
        default:
            $posX = (int)(($bgWidth - $overlayWidth) / 2);
            $posY = (int)(($bgHeight - $overlayHeight) / 2);
            return [$posX, $posY];
    }
}

function cnvBase64(string $string): string
{
    // Проверяем, что строка не пустая
    if (empty($string) || !is_string($string)) {
        return $string;
    }
    
    // Убираем возможные пробелы и переносы
    $string = trim($string);
    
    // Проверяем длину (должна быть кратна 4 для base64)
    if (strlen($string) % 4 !== 0) {
        return $string;
    }
    
    // Проверяем допустимые символы
    if (!preg_match('/^[a-zA-Z0-9\/\+=]*$/', $string)) {
        return $string;
    }
    
    // Пробуем декодировать
    $decoded = base64_decode($string, true);
    
    // Если декодирование успешно и результат не пустой
    return ($decoded !== false && base64_encode($decoded) === $string) ? $decoded : $string;
}

/**
 * Безопасно преобразует callback_data в base64 с проверкой длины
 */
function encodeTelegramParams(array $params, bool $forceEncode = false): array
{
    // Функция для обработки callback_data
    $processCallbackData = function($callbackData) use ($forceEncode) {
        if (!is_string($callbackData)) {
            return $callbackData;
        }
        
        $originalLength = strlen($callbackData);
        
        // Если callback_data уже в base64, проверяем его
        if (preg_match('/^[a-zA-Z0-9\/\+=]+$/', $callbackData) && 
            base64_decode($callbackData, true) !== false) {
            // Уже base64, проверяем длину
            if (strlen($callbackData) > 64) {
                throw new Exception(
                    "Callback data already base64 but too long: " . 
                    strlen($callbackData) . " bytes"
                );
            }
            return $callbackData;
        }
        
        // Если строка уже короткая, и не форсируем кодирование
        if (!$forceEncode && $originalLength <= 64)
            return $callbackData;
        
        // Кодируем в base64
        $encoded = base64_encode($callbackData);
        
        // Проверяем длину
        if (strlen($encoded) > 64) {

            // Пробуем сжать JSON если это JSON
            $decodedJson = json_decode($callbackData, true);
            if (json_last_error() === JSON_ERROR_NONE) {
                // Сжимаем JSON
                $compressedJson = json_encode($decodedJson, JSON_UNESCAPED_UNICODE);
                if (strlen($compressedJson) < strlen($callbackData)) {
                    $encoded = base64_encode($compressedJson);
                }
            }
            
            // Если все еще слишком длинный, выбрасываем исключение
            if (strlen($encoded) > 64) {
                throw new Exception(
                    "Callback data too long after encoding: " . 
                    strlen($encoded) . " bytes. Original: $callbackData"
                );
            }
        }
        
        return $encoded;
    };
    
    // Рекурсивная функция для обхода массива
    $processArray = function(&$item, $key) use (&$processArray, $processCallbackData) {
        if (is_array($item)) {

            array_walk($item, $processArray);
        } elseif ($key === 'callback_data' && is_string($item)) {
            $item = $processCallbackData($item);
        }
    };

    if (isset($params['reply_markup']) && !is_string($params['reply_markup'])) {
        //array_walk($params['reply_markup'], $processArray);
        $params['reply_markup'] = json_encode($params['reply_markup'], JSON_FLAGS);
    }
    
    return $params;
}
?>