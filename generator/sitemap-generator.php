<?
	require dirname(__FILE__, 2).'/src/Vmaya/engine.php';

	define('TOP_PRIORITY', 1);

	function Route($params) {
		$url = rtrim(BASEURL, '/');
		foreach ($params as $key=>$value)
			$url .= DS.$value;

		return $url;
	}
		
	$dbp = new mySQLProvider('localhost', _dbname_default, _dbuser, _dbpassword);

	$content = '';

	$target = 'en';

	foreach (LANGUAGES as $lang=>$value) {

		$direction = $target.'-'.$lang;

		$items = $dbp->asArray("SELECT *, GREATEST((SELECT MAX(updated_at) FROM phrases WHERE type_id = t.id AND is_active = 1 AND direction = '{$direction}'), updated_at) AS lastmod FROM `phrase_types` t WHERE t.is_active = 1 AND (SELECT COUNT(id) FROM phrases WHERE type_id = t.id AND direction = '{$direction}') > 0;");
		
		foreach ($items as $type) {
			$content .= '
	<url>
	    <loc>'.Route(['phrases', $lang, str_replace(' ', '_', $type['type_name'])]).'</loc>
	    <lastmod>'.date('Y-m-d\TH:i:sP', strtotime($type['lastmod'])).'</lastmod>
	    <priority>'.(round(TOP_PRIORITY / $type['order'] * 10) / 10).'</priority>
	</url>';
		}
	}

	$full_content = '<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'.$content.'
</urlset>';

	$filename = BASEPATH.DS.'public'.DS.'sitemap.xml';
	file_put_contents($filename, $full_content);

	chmod($filename, 0744);

	$robots_text = 'User-agent: *
Allow: /
Sitemap: '.BASEURL.'/sitemap.xml';

	$filename = BASEPATH.DS.'public'.DS.'robots.txt';
	file_put_contents($filename, $robots_text);

	chmod($filename, 0744);

	$dbp->Close();
?>