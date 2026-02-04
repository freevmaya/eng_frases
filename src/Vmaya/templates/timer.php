<script type="text/javascript">
    // Тестирование разных значений

    $(window).ready(()=>{

        $('.page').addClass('page-loaded');

        function testTimeout(delay, description) {
            const start = performance.now();
            
            setTimeout(() => {
                const actual = performance.now() - start;
                $(output).append(`<p>${description}: ${delay}ms → фактически ${actual.toFixed(2)}ms</p>`);
            }, delay);
        }

        // Тесты
        testTimeout(0, "Ноль");
        testTimeout(1, "1 миллисекунда");
        testTimeout(4, "4ms (минимальный в браузерах)");
        testTimeout(1000.123, "Дробное число");
        testTimeout(Number.MAX_SAFE_INTEGER, "Максимальное безопасное целое");
        testTimeout(Infinity, "Бесконечность");
        testTimeout(-100, "Отрицательное число");
        testTimeout("1000", "Строка '1000'"); // Будет преобразовано к числу

    });
</script>
<div id="output" class="card bg-dark-gradient border-primary border-3 animate-card">
<div>