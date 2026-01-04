// Интерактивное управление анимацией
document.addEventListener('DOMContentLoaded', function() {
    // Элементы для управления
    const tvScreen = document.querySelector('.tv-screen');
    const waves = document.querySelector('.water-waves');
    const drops = document.querySelector('.water-drops');
    const waterSurface = document.querySelector('.water-surface');
    const speedControl = document.getElementById('speedControl');
    
    // Кнопки управления
    document.getElementById('toggleWaves').addEventListener('click', function() {
        const isPaused = waves.style.animationPlayState === 'paused';
        waves.style.animationPlayState = isPaused ? 'running' : 'paused';
        waterSurface.style.animationPlayState = isPaused ? 'running' : 'paused';
        this.textContent = isPaused ? 'Остановить волны' : 'Запустить волны';
    });
    
    document.getElementById('toggleDrops').addEventListener('click', function() {
        const isHidden = drops.style.opacity === '0';
        drops.style.opacity = isHidden ? '1' : '0';
        this.textContent = isHidden ? 'Скрыть капли' : 'Показать капли';
    });
    
    document.getElementById('changeColor').addEventListener('click', function() {
        // Цветовые схемы для воды
        const colorSchemes = [
            { primary: '#001122', secondary: '#0077aa' }, // Синяя
            { primary: '#002200', secondary: '#00aa77' }, // Зеленая
            { primary: '#220011', secondary: '#aa0077' }, // Пурпурная
            { primary: '#222200', secondary: '#aaaa00' }, // Желтая
            { primary: '#000000', secondary: '#555555' }  // Монохромная
        ];
        
        // Случайный выбор схемы
        const randomScheme = colorSchemes[Math.floor(Math.random() * colorSchemes.length)];
        
        // Применение новой цветовой схемы
        document.querySelector('.water-effect').style.background = 
            `linear-gradient(180deg, 
                ${randomScheme.primary} 0%,
                ${window.mixColors(randomScheme.primary, randomScheme.secondary, 0.3)} 40%,
                ${window.mixColors(randomScheme.primary, randomScheme.secondary, 0.5)} 70%,
                ${randomScheme.secondary} 100%)`;
        
        // Обновление цвета капель
        document.querySelectorAll('.drop').forEach(drop => {
            drop.style.background = this.adjustColor(randomScheme.secondary, 50, 50);
        });
    });
    
    // Управление скоростью анимации
    speedControl.addEventListener('input', function() {
        const speed = this.value / 5; // Нормализуем от 0.2 до 2
        
        // Обновляем скорость всех анимаций
        const allAnimatedElements = document.querySelectorAll('*');
        allAnimatedElements.forEach(el => {
            const computedStyle = window.getComputedStyle(el);
            const animationDuration = computedStyle.animationDuration;
            
            if (animationDuration && animationDuration !== '0s') {
                // Сохраняем оригинальную длительность в data-атрибут
                if (!el.dataset.originalDuration) {
                    el.dataset.originalDuration = animationDuration;
                }
                
                // Вычисляем новую длительность
                const originalDuration = parseFloat(el.dataset.originalDuration);
                el.style.animationDuration = `${originalDuration / speed}s`;
            }
        });
    });
    
    // Добавление случайных капель по клику
    tvScreen.addEventListener('click', function(e) {
        const rect = this.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        createDrop(x, y);
    });
    
    // Функция создания капли
    function createDrop(x, y) {
        const drop = document.createElement('div');
        drop.className = 'drop';
        drop.style.left = `${x}px`;
        drop.style.top = `${y}px`;
        drop.style.width = `${Math.random() * 8 + 3}px`;
        drop.style.height = drop.style.width;
        
        drops.appendChild(drop);
        
        // Удаляем каплю после анимации
        setTimeout(() => {
            if (drop.parentNode) {
                drop.remove();
            }
        }, 3000);
    }
    
    // Функция смешивания цветов
    window.mixColors = function(color1, color2, weight = 0.5) {
        const hex = color => color.replace('#', '');
        const hex1 = hex(color1);
        const hex2 = hex(color2);
        
        const r = Math.round(parseInt(hex1.substring(0, 2), 16) * weight + 
                            parseInt(hex2.substring(0, 2), 16) * (1 - weight));
        const g = Math.round(parseInt(hex1.substring(2, 4), 16) * weight + 
                            parseInt(hex2.substring(2, 4), 16) * (1 - weight));
        const b = Math.round(parseInt(hex1.substring(4, 6), 16) * weight + 
                            parseInt(hex2.substring(4, 6), 16) * (1 - weight));
        
        return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
    };
    
    // Функция настройки цвета (яркость/насыщенность)
    window.adjustColor = function(color, brightness = 0, saturation = 0) {
        const hex = color => color.replace('#', '');
        const hexColor = hex(color);
        
        let r = parseInt(hexColor.substring(0, 2), 16);
        let g = parseInt(hexColor.substring(2, 4), 16);
        let b = parseInt(hexColor.substring(4, 6), 16);
        
        // Корректировка яркости
        r = Math.min(255, Math.max(0, r + brightness));
        g = Math.min(255, Math.max(0, g + brightness));
        b = Math.min(255, Math.max(0, b + brightness));
        
        // Корректировка насыщенности (упрощенная)
        const avg = (r + g + b) / 3;
        r = avg + (r - avg) * (1 + saturation / 100);
        g = avg + (g - avg) * (1 + saturation / 100);
        b = avg + (b - avg) * (1 + saturation / 100);
        
        return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
    };
    
    // Автоматическое добавление случайных капель
    setInterval(() => {
        if (Math.random() > 0.7 && drops.style.opacity !== '0') {
            const x = Math.random() * tvScreen.offsetWidth;
            const y = Math.random() * tvScreen.offsetHeight;
            createDrop(x, y);
        }
    }, 1000);
});