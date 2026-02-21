<?
	require dirname(__FILE__, 2).'/src/Vmaya/engine.php';
	session_start();
	$_SESSION = [];
	session_destroy();

?>
<html>
<head>
	<script type="text/javascript">
		localStorage.clear();
		console.log('localStorage.clear()');
	</script>
</head>
Clear ALL!
</html>