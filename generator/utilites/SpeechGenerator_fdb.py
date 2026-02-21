from gtts import gTTS
import hashlib
import os
import mysql.connector
from mysql.connector import Error
from pathlib import Path
import time
from typing import Dict, List, Optional, Tuple, Any
import requests
import tempfile
from concurrent.futures import ThreadPoolExecutor, as_completed
import logging
import re
import sys
from dotenv import load_dotenv

# Настройка логирования
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Загрузить переменные из .env файла
load_dotenv()

BASE_AUDIO_DIR = os.environ.get('BASE_AUDIO_DIR', 
    os.path.abspath("../../public/data/voises"))

DB_USER             = os.environ.get('DB_USER', 'root')
DB_PASSWORD         = os.environ.get('DB_PASSWORD', '')
DEFAULT_DIRECTION   = os.environ.get('DEFAULT_DIRECTION', 'en-ru')

class EnhancedSpeechGenerator:
    def __init__(self,
                 use_edge_tts: bool = True,
                 voice_name: Optional[str] = None,
                 output_dir: str = BASE_AUDIO_DIR,
                 style: str = 'neutral',
                 db_host: str = 'localhost',
                 db_user: str = DB_USER,
                 db_password: str = DB_PASSWORD,
                 db_name: str = 'eng_phrases',
                 db_port: int = 3306):
        """
        Улучшенный генератор речи, загружающий фразы из MySQL.

        Args:
            use_edge_tts: Использовать Edge-TTS (True) или gTTS (False)
            voice_name: Имя конкретного голоса
            output_dir: Базовая директория для сохранения
            style: Стиль голоса
            db_host: Хост MySQL
            db_user: Имя пользователя MySQL
            db_password: Пароль MySQL
            db_name: Имя базы данных
            db_port: Порт MySQL
        """
        self.style = style

        # Параметры подключения к БД
        self.db_config = {
            'host': db_host,
            'user': db_user,
            'password': db_password,
            'database': db_name,
            'port': db_port,
            'charset': 'utf8mb4',
            'collation': 'utf8mb4_unicode_ci'
        }
        self.connection = None
        self.cursor = None

        # Проверяем доступность Edge-TTS
        self.use_edge_tts = use_edge_tts
        if use_edge_tts:
            try:
                import edge_tts
                self.edge_tts_available = True
                logger.info("✓ Edge-TTS доступен")
            except ImportError:
                self.edge_tts_available = False
                logger.warning("✗ Edge-TTS не установлен. Используем gTTS.")
                self.use_edge_tts = False
        else:
            self.edge_tts_available = False

        self.voice_name = voice_name

        # Типы голосов для генерации
        self.voice_types = ['male', 'female']

        # Базовая директория для сохранения аудиофайлов
        self.base_output_dir = output_dir
        Path(self.base_output_dir).mkdir(exist_ok=True)

        # TLD для gTTS (разные домены для разных языков)
        self.gtts_tld_map = {
            'en': 'com',      # Английский
            'ru': 'ru',       # Русский
            'hi': 'co.in',    # Хинди
            'es': 'es',       # Испанский
            'fr': 'fr',       # Французский
            'de': 'de',       # Немецкий
            'it': 'it',       # Итальянский
            'pt': 'com.br',   # Португальский
            'ja': 'co.jp',    # Японский
            'ko': 'co.kr',    # Корейский
            'zh': 'com',      # Китайский (мандарин)
            'ar': 'com',      # Арабский
            'tr': 'com.tr',   # Турецкий
            'nl': 'nl',       # Нидерландский
            'pl': 'pl',       # Польский
            'vi': 'com',      # Вьетнамский
            'th': 'co.th',    # Тайский
            'sv': 'se',       # Шведский
            'cs': 'cz',       # Чешский
            'el': 'gr',       # Греческий
            'hu': 'hu',       # Венгерский
            'ro': 'ro',       # Румынский
            'uk': 'ua',       # Украинский
            'id': 'id',       # Индонезийский
            'ms': 'com',      # Малайский
            'fa': 'com',      # Персидский
            'bn': 'com',      # Бенгальский
            'ta': 'com',      # Тамильский
            'te': 'com',      # Телугу
            'mr': 'com',      # Маратхи
            'ur': 'com',      # Урду
            'pa': 'com',      # Панджаби
            'jv': 'com',      # Яванский
            'tl': 'com',      # Тагальский
            'ha': 'com',      # Хауса
            'sw': 'com',      # Суахили
            'yo': 'com',      # Йоруба
            'ig': 'com',      # Игбо
            'am': 'com',      # Амхарский
            'so': 'com',      # Сомали
            'my': 'com',      # Бирманский
            'km': 'com',      # Кхмерский
            'lo': 'com',      # Лаосский
            'ne': 'com',      # Непальский
            'si': 'com',      # Сингальский
            'ka': 'com',      # Грузинский
            'hy': 'com',      # Армянский
            'az': 'com',      # Азербайджанский
            'kk': 'com',      # Казахский
            'uz': 'com',      # Узбекский
            'mn': 'com',      # Монгольский
            'af': 'za',       # Африкаанс
        }

        # Задержка между запросами
        self.request_delay = 0.3

        # Пул потоков для параллельной генерации
        self.max_workers = 3

        # Настройки голосов для Edge-TTS
        self.edge_tts_voices = {
            # Английский (разные варианты)
            'en': {
                'male': [
                    'en-US-ChristopherNeural', 'en-US-EricNeural', 'en-US-BrandonNeural',
                    'en-US-GuyNeural', 'en-US-RogerNeural', 'en-US-SteffanNeural',
                    'en-GB-RyanNeural', 'en-GB-AlfieNeural', 'en-GB-ThomasNeural',
                    'en-AU-WilliamNeural', 'en-CA-LiamNeural', 'en-IN-PrabhatNeural',
                    'en-IE-ConnorNeural'
                ],
                'female': [
                    'en-US-AriaNeural', 'en-US-JennyNeural', 'en-US-EmmaNeural',
                    'en-US-NancyNeural', 'en-US-AmberNeural', 'en-US-AnaNeural',
                    'en-US-MichelleNeural', 'en-US-SaraNeural',
                    'en-GB-SoniaNeural', 'en-GB-LibbyNeural', 'en-GB-MollyNeural',
                    'en-AU-NatashaNeural', 'en-AU-AnnetteNeural', 'en-CA-ClaraNeural',
                    'en-IN-SwaraNeural', 'en-IN-NeerjaNeural', 'en-IE-EmilyNeural'
                ]
            },
            # Русский
            'ru': {
                'male': ['ru-RU-DmitryNeural', 'ru-RU-SergeyNeural'],
                'female': ['ru-RU-SvetlanaNeural', 'ru-RU-DariyaNeural']
            },
            # Хинди
            'hi': {
                'male': ['hi-IN-MadhurNeural', 'hi-IN-PrabhatNeural'],
                'female': ['hi-IN-SwaraNeural', 'hi-IN-AarohiNeural', 'hi-IN-AnanyaNeural']
            },
            # Испанский
            'es': {
                'male': [
                    'es-ES-AlvaroNeural', 'es-ES-DarioNeural', 'es-ES-GonzaloNeural',
                    'es-MX-JorgeNeural', 'es-AR-TomasNeural', 'es-CO-GonzaloNeural'
                ],
                'female': [
                    'es-ES-ElviraNeural', 'es-ES-AbrilNeural', 'es-ES-EstrellaNeural',
                    'es-MX-DaliaNeural', 'es-AR-ElenaNeural', 'es-CO-SalomeNeural'
                ]
            },
            # Французский
            'fr': {
                'male': [
                    'fr-FR-HenriNeural', 'fr-FR-AlainNeural', 'fr-FR-ClaudeNeural',
                    'fr-CA-AntoineNeural', 'fr-CH-FabriceNeural', 'fr-BE-GerardNeural'
                ],
                'female': [
                    'fr-FR-DeniseNeural', 'fr-FR-JosephineNeural', 'fr-FR-YvetteNeural',
                    'fr-CA-SylvieNeural', 'fr-CH-ArianeNeural', 'fr-BE-CharlineNeural'
                ]
            },
            # Немецкий
            'de': {
                'male': [
                    'de-DE-ConradNeural', 'de-DE-BerndNeural', 'de-DE-ChristophNeural',
                    'de-DE-KasperNeural', 'de-DE-KillianNeural', 'de-DE-KlausNeural',
                    'de-DE-RalfNeural', 'de-AT-JonasNeural', 'de-CH-JanNeural'
                ],
                'female': [
                    'de-DE-KatjaNeural', 'de-DE-AmalaNeural', 'de-DE-ElkeNeural',
                    'de-DE-GiselaNeural', 'de-DE-LouisaNeural', 'de-DE-MajaNeural',
                    'de-DE-TanjaNeural', 'de-AT-IngridNeural', 'de-CH-LeniNeural'
                ]
            },
            # Итальянский
            'it': {
                'male': ['it-IT-DiegoNeural', 'it-IT-BenignoNeural'],
                'female': ['it-IT-ElsaNeural', 'it-IT-IsabellaNeural']
            },
            # Португальский
            'pt': {
                'male': ['pt-BR-AntonioNeural', 'pt-BR-FranciscoNeural', 'pt-PT-DuarteNeural'],
                'female': ['pt-BR-FranciscaNeural', 'pt-BR-JulioNeural', 'pt-PT-RaquelNeural']
            },
            # Японский
            'ja': {
                'male': ['ja-JP-KeitaNeural', 'ja-JP-DaichiNeural'],
                'female': ['ja-JP-NanamiNeural', 'ja-JP-AoiNeural', 'ja-JP-ShioriNeural']
            },
            # Корейский
            'ko': {
                'male': ['ko-KR-InJoonNeural', 'ko-KR-BongJinNeural'],
                'female': ['ko-KR-SunHiNeural', 'ko-KR-JiMinNeural', 'ko-KR-SeoHyeonNeural']
            },
            # Китайский (мандарин)
            'zh': {
                'male': [
                    'zh-CN-YunxiNeural', 'zh-CN-YunyangNeural', 'zh-CN-YunfengNeural',
                    'zh-TW-YunJheNeural', 'zh-HK-WanLungNeural'
                ],
                'female': [
                    'zh-CN-XiaoxiaoNeural', 'zh-CN-XiaoyiNeural', 'zh-CN-XiaohanNeural',
                    'zh-CN-XiaomengNeural', 'zh-TW-HsiaoChenNeural', 'zh-TW-HsiaoYuNeural',
                    'zh-HK-HiuGaaiNeural', 'zh-HK-HiuMaanNeural'
                ]
            },
            # Арабский
            'ar': {
                'male': [
                    'ar-EG-ShakirNeural', 'ar-EG-HamedNeural',
                    'ar-SA-HamedNeural', 'ar-AE-HamdanNeural'
                ],
                'female': [
                    'ar-EG-SalmaNeural', 'ar-SA-ZariyahNeural',
                    'ar-AE-FatimaNeural', 'ar-QA-AmalNeural'
                ]
            },
            # Турецкий
            'tr': {
                'male': ['tr-TR-AhmetNeural'],
                'female': ['tr-TR-EmelNeural']
            },
            # Нидерландский
            'nl': {
                'male': ['nl-NL-MaartenNeural', 'nl-BE-ArnaudNeural'],
                'female': ['nl-NL-FennaNeural', 'nl-BE-DenaNeural']
            },
            # Польский
            'pl': {
                'male': ['pl-PL-MarekNeural'],
                'female': ['pl-PL-ZofiaNeural']
            },
            # Вьетнамский
            'vi': {
                'male': ['vi-VN-NamMinhNeural'],
                'female': ['vi-VN-HoaiMyNeural']
            },
            # Тайский
            'th': {
                'male': ['th-TH-NiwatNeural'],
                'female': ['th-TH-PremwadeeNeural', 'th-TH-AcharaNeural']
            },
            # Шведский
            'sv': {
                'male': ['sv-SE-MattiasNeural'],
                'female': ['sv-SE-SofieNeural']
            },
            # Чешский
            'cs': {
                'male': ['cs-CZ-AntoninNeural'],
                'female': ['cs-CZ-VlastaNeural']
            },
            # Греческий
            'el': {
                'male': ['el-GR-NestorasNeural'],
                'female': ['el-GR-AthinaNeural']
            },
            # Венгерский
            'hu': {
                'male': ['hu-HU-TamasNeural'],
                'female': ['hu-HU-NoemiNeural']
            },
            # Румынский
            'ro': {
                'male': ['ro-RO-EmilNeural'],
                'female': ['ro-RO-AlinaNeural']
            },
            # Украинский
            'uk': {
                'male': ['uk-UA-OstapNeural'],
                'female': ['uk-UA-UlianaNeural']
            },
            # Индонезийский
            'id': {
                'male': ['id-ID-ArdiNeural'],
                'female': ['id-ID-GadisNeural']
            },
            # Малайский
            'ms': {
                'male': ['ms-MY-OsmanNeural'],
                'female': ['ms-MY-YasminNeural']
            },
            # Персидский (фарси)
            'fa': {
                'male': ['fa-IR-FaridNeural'],
                'female': ['fa-IR-DilaraNeural']
            },
            # Бенгальский
            'bn': {
                'male': ['bn-IN-BashkarNeural', 'bn-BD-PradeepNeural'],
                'female': ['bn-IN-TanishaaNeural', 'bn-BD-NabanitaNeural']
            },
            # Тамильский
            'ta': {
                'male': ['ta-IN-ValluvarNeural', 'ta-LK-KumarNeural'],
                'female': ['ta-IN-PallaviNeural', 'ta-LK-SaranyaNeural']
            },
            # Телугу
            'te': {
                'male': ['te-IN-MohanNeural'],
                'female': ['te-IN-ShrutiNeural']
            },
            # Маратхи
            'mr': {
                'male': ['mr-IN-HemantNeural'],
                'female': ['mr-IN-AarohiNeural']
            },
            # Урду
            'ur': {
                'male': ['ur-IN-SalmanNeural', 'ur-PK-AsadNeural'],
                'female': ['ur-IN-GulNeural', 'ur-PK-UzmaNeural']
            },
            # Панджаби
            'pa': {
                'male': ['pa-IN-ByjusNeural'],
                'female': ['pa-IN-NavdeepNeural']
            },
            # Яванский (используем индонезийские голоса)
            'jv': {
                'male': ['id-ID-ArdiNeural'],
                'female': ['id-ID-GadisNeural']
            },
            # Тагальский (филиппинский)
            'tl': {
                'male': ['fil-PH-AngeloNeural'],
                'female': ['fil-PH-BlessicaNeural']
            },
            # Хауса
            'ha': {
                'male': ['ha-NG-AbubakarNeural'],
                'female': ['ha-NG-AminaNeural']
            },
            # Суахили
            'sw': {
                'male': ['sw-KE-RafikiNeural'],
                'female': ['sw-KE-ZuriNeural']
            },
            # Йоруба
            'yo': {
                'male': ['yo-NG-FemiNeural'],
                'female': ['yo-NG-ModupcolaNeural']
            },
            # Игбо
            'ig': {
                'male': ['ig-NG-StanleyNeural'],
                'female': ['ig-NG-ChinweNeural']
            },
            # Амхарский
            'am': {
                'male': ['am-ET-AmehaNeural'],
                'female': ['am-ET-MekdesNeural']
            },
            # Сомали
            'so': {
                'male': ['so-SO-MuuseNeural'],
                'female': ['so-SO-UbaxNeural']
            },
            # Бирманский
            'my': {
                'male': ['my-MM-ThihaNeural'],
                'female': ['my-MM-NilarNeural']
            },
            # Кхмерский
            'km': {
                'male': ['km-KH-PisethNeural'],
                'female': ['km-KH-SreymomNeural']
            },
            # Лаосский
            'lo': {
                'male': ['lo-LA-AnousoneNeural'],
                'female': ['lo-LA-KeomanyNeural']
            },
            # Непальский
            'ne': {
                'male': ['ne-NP-SagarNeural'],
                'female': ['ne-NP-HemkalaNeural']
            },
            # Сингальский
            'si': {
                'male': ['si-LK-SameeraNeural'],
                'female': ['si-LK-ThiliniNeural']
            },
            # Грузинский
            'ka': {
                'male': ['ka-GE-GiorgiNeural'],
                'female': ['ka-GE-EkaNeural']
            },
            # Армянский
            'hy': {
                'male': ['hy-AM-HaykNeural'],
                'female': ['hy-AM-AnahitNeural']
            },
            # Азербайджанский
            'az': {
                'male': ['az-AZ-BabekNeural'],
                'female': ['az-AZ-BanuNeural']
            },
            # Казахский
            'kk': {
                'male': ['kk-KZ-DauletNeural'],
                'female': ['kk-KZ-AigulNeural']
            },
            # Узбекский
            'uz': {
                'male': ['uz-UZ-SardorNeural'],
                'female': ['uz-UZ-MadinaNeural']
            },
            # Монгольский
            'mn': {
                'male': ['mn-MN-BataaNeural'],
                'female': ['mn-MN-YesuiNeural']
            },
            # Африкаанс
            'af': {
                'male': ['af-ZA-WillemNeural'],
                'female': ['af-ZA-AdriNeural']
            },
            # Датский
            'da': {
                'male': ['da-DK-JeppeNeural'],
                'female': ['da-DK-ChristelNeural']
            },
            # Норвежский
            'no': {
                'male': ['nb-NO-FinnNeural'],
                'female': ['nb-NO-PernilleNeural']
            },
            # Финский
            'fi': {
                'male': ['fi-FI-HarriNeural'],
                'female': ['fi-FI-NooraNeural']
            },
            # Словацкий
            'sk': {
                'male': ['sk-SK-LukasNeural'],
                'female': ['sk-SK-ViktoriaNeural']
            },
            # Хорватский
            'hr': {
                'male': ['hr-HR-SreckoNeural'],
                'female': ['hr-HR-GabrijelaNeural']
            },
            # Сербский
            'sr': {
                'male': ['sr-RS-NicholasNeural'],
                'female': ['sr-RS-SophieNeural']
            },
            # Словенский
            'sl': {
                'male': ['sl-SI-RokNeural'],
                'female': ['sl-SI-PetraNeural']
            },
            # Болгарский
            'bg': {
                'male': ['bg-BG-BorislavNeural'],
                'female': ['bg-BG-KalinaNeural']
            },
            # Литовский
            'lt': {
                'male': ['lt-LT-LeonasNeural'],
                'female': ['lt-LT-OnaNeural']
            },
            # Латышский
            'lv': {
                'male': ['lv-LV-NilsNeural'],
                'female': ['lv-LV-EveritaNeural']
            },
            # Эстонский
            'et': {
                'male': ['et-EE-AnteroNeural'],
                'female': ['et-EE-KertuNeural']
            },
            # Иврит
            'he': {
                'male': ['he-IL-AvriNeural'],
                'female': ['he-IL-HilaNeural']
            }
        }

    # --- Методы для работы с БД ---

    def connect_to_db(self):
        """Подключение к базе данных MySQL."""
        try:
            self.connection = mysql.connector.connect(**self.db_config)
            if self.connection.is_connected():
                # Используем dictionary=True для получения результатов в виде словарей
                self.cursor = self.connection.cursor(dictionary=True)
                logger.info("✓ Подключение к MySQL успешно")
        except Error as e:
            logger.error(f"Ошибка подключения к MySQL: {e}")
            sys.exit(1)

    def disconnect_from_db(self):
        """Отключение от базы данных."""
        if self.connection and self.connection.is_connected():
            if self.cursor:
                self.cursor.close()
            self.connection.close()
            logger.info("✗ Отключение от MySQL")

    def fetch_phrases_by_direction(self, direction: str = DEFAULT_DIRECTION) -> List[Dict[str, Any]]:
        """
        Получение списка фраз из БД по заданному направлению.

        Args:
            direction: Направление перевода (например, 'en-ru').

        Returns:
            Список словарей с ключами 'direction', 'target' и 'native'.
        """
        if not self.connection or not self.connection.is_connected():
            self.connect_to_db()

        phrases = []
        try:
            # SQL запрос для получения данных
            query = """
            SELECT
                direction,
                target_text,
                native_text
            FROM phrases
            WHERE direction = %s AND is_active = 1
            ORDER BY type_id, id
            """
            self.cursor.execute(query, (direction,))
            results = self.cursor.fetchall()

            for row in results:
                phrases.append({
                    'direction': row['direction'],
                    'target': row['target_text'].strip(),
                    'native': row['native_text'].strip()
                })

            logger.info(f"✓ Загружено {len(phrases)} фраз для направления '{direction}' из БД")
            return phrases

        except Error as e:
            logger.error(f"Ошибка при загрузке фраз из БД: {e}")
            return []

    def list_all_voices(self):
        """Вывести список всех доступных голосов Edge-TTS"""
        if not self.edge_tts_available:
            print("Edge-TTS не доступен. Установите: pip install edge-tts")
            return

        import edge_tts
        import asyncio

        async def list_voices():
            voices = await edge_tts.list_voices()
            print(f"\n{'='*60}")
            print(f"ДОСТУПНЫЕ ГОЛОСА EDGE-TTS ({len(voices)} голосов)")
            print(f"{'='*60}")

            # Группируем по языкам
            voices_by_lang = {}
            for voice in voices:
                lang = voice['Locale'].split('-')[0]
                if lang not in voices_by_lang:
                    voices_by_lang[lang] = []
                voices_by_lang[lang].append(voice)

            # Выводим по языкам
            for lang_code in sorted(voices_by_lang.keys()):
                lang_voices = voices_by_lang[lang_code]
                print(f"\n{lang_code.upper()} ({len(lang_voices)} голосов):")
                print("-" * 40)

                for voice in sorted(lang_voices, key=lambda x: x['ShortName']):
                    gender = voice['Gender']
                    name = voice['ShortName']
                    locale = voice['Locale']

                    print(f"  {name} ({gender}) - {locale}")

        asyncio.run(list_voices())

    def get_voice_by_preference(self, lang: str,
                               gender: str = 'female',
                               style: str = 'neutral',
                               country: Optional[str] = None) -> str:
        """
        Выбор голоса по предпочтениям

        Args:
            lang: Язык (en, ru, hi, es, fr, de, etc.)
            gender: Пол (male/female)
            style: Стиль (neutral, friendly, professional, energetic, young, etc.)
            country: Страна (US, GB, IN, MX, FR, DE и т.д.)

        Returns:
            str: Имя голоса
        """
        if lang not in self.edge_tts_voices:
            # По умолчанию возвращаем английский голос
            return 'en-US-AriaNeural'

        voices = self.edge_tts_voices[lang].get(gender, [])

        if not voices:
            return 'en-US-AriaNeural'

        # Простые правила выбора по стилю (расширим для основных языков)
        style_map = {
            'en': {
                'neutral': ['en-US-AriaNeural', 'en-US-JennyNeural'],
                'friendly': ['en-US-JennyNeural', 'en-US-NancyNeural'],
                'professional': ['en-US-EmmaNeural', 'en-US-ChristopherNeural'],
                'energetic': ['en-US-AmberNeural', 'en-US-BrandonNeural'],
                'young': ['en-US-AmberNeural', 'en-US-BrandonNeural'],
                'child': ['en-US-AnaNeural']
            },
            'ru': {
                'neutral': ['ru-RU-SvetlanaNeural', 'ru-RU-DmitryNeural'],
                'friendly': ['ru-RU-DariyaNeural'],
                'professional': ['ru-RU-SvetlanaNeural'],
                'deep': ['ru-RU-SergeyNeural']
            },
            'hi': {
                'neutral': ['hi-IN-SwaraNeural', 'hi-IN-MadhurNeural'],
                'friendly': ['hi-IN-AarohiNeural', 'hi-IN-SwaraNeural'],
                'professional': ['hi-IN-PrabhatNeural', 'hi-IN-MadhurNeural'],
                'young': ['hi-IN-AarohiNeural']
            },
            'es': {
                'neutral': ['es-ES-ElviraNeural', 'es-ES-AlvaroNeural'],
                'friendly': ['es-ES-AbrilNeural', 'es-MX-DaliaNeural'],
                'professional': ['es-ES-AlvaroNeural', 'es-AR-TomasNeural']
            },
            'fr': {
                'neutral': ['fr-FR-DeniseNeural', 'fr-FR-HenriNeural'],
                'friendly': ['fr-FR-JosephineNeural', 'fr-CA-SylvieNeural'],
                'professional': ['fr-FR-HenriNeural', 'fr-CH-FabriceNeural']
            },
            'de': {
                'neutral': ['de-DE-KatjaNeural', 'de-DE-ConradNeural'],
                'friendly': ['de-DE-KatjaNeural', 'de-AT-IngridNeural'],
                'professional': ['de-DE-ConradNeural', 'de-CH-JanNeural']
            },
            'it': {
                'neutral': ['it-IT-ElsaNeural', 'it-IT-DiegoNeural'],
                'friendly': ['it-IT-ElsaNeural', 'it-IT-IsabellaNeural']
            },
            'pt': {
                'neutral': ['pt-BR-FranciscaNeural', 'pt-BR-AntonioNeural'],
                'friendly': ['pt-BR-FranciscaNeural', 'pt-PT-RaquelNeural']
            },
            'ja': {
                'neutral': ['ja-JP-NanamiNeural', 'ja-JP-KeitaNeural'],
                'friendly': ['ja-JP-NanamiNeural', 'ja-JP-AoiNeural']
            },
            'ko': {
                'neutral': ['ko-KR-SunHiNeural', 'ko-KR-InJoonNeural'],
                'friendly': ['ko-KR-SunHiNeural', 'ko-KR-JiMinNeural']
            },
            'zh': {
                'neutral': ['zh-CN-XiaoxiaoNeural', 'zh-CN-YunxiNeural'],
                'friendly': ['zh-CN-XiaoxiaoNeural', 'zh-TW-HsiaoChenNeural'],
                'professional': ['zh-CN-YunxiNeural', 'zh-HK-WanLungNeural']
            },
            'ar': {
                'neutral': ['ar-EG-SalmaNeural', 'ar-EG-ShakirNeural'],
                'friendly': ['ar-SA-ZariyahNeural', 'ar-AE-FatimaNeural']
            }
        }

        # Если указана страна, фильтруем по стране
        if country:
            filtered_voices = [v for v in voices if f'-{country}-' in v]
            if filtered_voices:
                voices = filtered_voices

        # Выбор по стилю
        if lang in style_map and style in style_map[lang]:
            preferred = style_map[lang][style]
            for voice in preferred:
                if voice in voices:
                    return voice

        # Возвращаем первый доступный голос
        return voices[0]

    def get_supported_languages(self) -> List[str]:
        """
        Возвращает список всех поддерживаемых языков.

        Returns:
            List[str]: Список кодов языков
        """
        return sorted(list(self.edge_tts_voices.keys()))

    def get_language_info(self, lang_code: str) -> Dict:
        """
        Возвращает информацию о языке.

        Args:
            lang_code: Код языка

        Returns:
            Dict: Информация о языке
        """
        language_names = {
            'en': 'Английский',
            'ru': 'Русский',
            'hi': 'Хинди',
            'es': 'Испанский',
            'fr': 'Французский',
            'de': 'Немецкий',
            'it': 'Итальянский',
            'pt': 'Португальский',
            'ja': 'Японский',
            'ko': 'Корейский',
            'zh': 'Китайский',
            'ar': 'Арабский',
            'tr': 'Турецкий',
            'nl': 'Нидерландский',
            'pl': 'Польский',
            'vi': 'Вьетнамский',
            'th': 'Тайский',
            'sv': 'Шведский',
            'cs': 'Чешский',
            'el': 'Греческий',
            'hu': 'Венгерский',
            'ro': 'Румынский',
            'uk': 'Украинский',
            'id': 'Индонезийский',
            'ms': 'Малайский',
            'fa': 'Персидский',
            'bn': 'Бенгальский',
            'ta': 'Тамильский',
            'te': 'Телугу',
            'mr': 'Маратхи',
            'ur': 'Урду',
            'pa': 'Панджаби',
            'jv': 'Яванский',
            'tl': 'Тагальский',
            'ha': 'Хауса',
            'sw': 'Суахили',
            'yo': 'Йоруба',
            'ig': 'Игбо',
            'am': 'Амхарский',
            'so': 'Сомали',
            'my': 'Бирманский',
            'km': 'Кхмерский',
            'lo': 'Лаосский',
            'ne': 'Непальский',
            'si': 'Сингальский',
            'ka': 'Грузинский',
            'hy': 'Армянский',
            'az': 'Азербайджанский',
            'kk': 'Казахский',
            'uz': 'Узбекский',
            'mn': 'Монгольский',
            'af': 'Африкаанс'
        }

        if lang_code in self.edge_tts_voices:
            male_count = len(self.edge_tts_voices[lang_code].get('male', []))
            female_count = len(self.edge_tts_voices[lang_code].get('female', []))
            return {
                'code': lang_code,
                'name': language_names.get(lang_code, lang_code),
                'male_voices': male_count,
                'female_voices': female_count,
                'total_voices': male_count + female_count
            }
        return None

    def _check_internet_connection(self) -> bool:
        """Проверка интернет-соединения"""
        try:
            response = requests.get('https://www.google.com', timeout=5)
            return response.status_code == 200
        except requests.ConnectionError:
            logger.warning("Нет интернет-соединения")
            return False

    def _generate_filename(self, phrase: str, lang_code: str, voice_type: str) -> str:
        """
        Генерация имени файла на основе текста, языка и типа голоса

        Args:
            phrase: Текст фразы
            lang_code: Код языка (en, ru, hi, etc.)
            voice_type: Тип голоса (male, female)

        Returns:
            str: Имя файла
        """
        # Нормализуем фразу
        normalized_phrase = ' '.join(phrase.strip().split()).lower()

        # Создаем MD5 хэш
        phrase_hash = hashlib.md5(normalized_phrase.encode('utf-8')).hexdigest()

        # Формат: voice_type_lang_hash.mp3
        return f"{lang_code}_{phrase_hash}.mp3"

    def _generate_with_gtts(self, text: str, lang: str, settings: Dict) -> Optional[bytes]:
        """Генерация аудио с помощью gTTS"""
        try:
            tld = settings.get('tld', self.gtts_tld_map.get(lang, 'com'))

            tts = gTTS(
                text=text,
                lang=lang,
                tld=tld,
                slow=settings.get('slow', False)
            )

            # Сохраняем во временный файл
            with tempfile.NamedTemporaryFile(suffix='.mp3', delete=False) as tmp:
                temp_file = tmp.name
                tts.save(temp_file)

                # Читаем и возвращаем данные
                with open(temp_file, 'rb') as f:
                    audio_data = f.read()

                # Удаляем временный файл
                os.unlink(temp_file)

                return audio_data

        except Exception as e:
            logger.error(f"Ошибка gTTS: {e}")
            return None

    def _generate_with_edge_tts(self, text: str, lang: str, voice_type: str, settings: Dict) -> Optional[bytes]:
        """Генерация аудио с помощью Edge-TTS (высокое качество)"""
        try:
            import edge_tts
            import asyncio

            # Выбираем голос на основе типа
            voice = settings.get('voice_name')

            if not voice:
                voice = self.get_voice_by_preference(lang, voice_type, style=self.style)

            rate = settings.get('rate', '+0%')

            async def generate():
                tts = edge_tts.Communicate(text=text, voice=voice, rate=rate)
                audio_chunks = []

                async for chunk in tts.stream():
                    if chunk["type"] == "audio":
                        audio_chunks.append(chunk["data"])

                return b''.join(audio_chunks)

            # Запускаем асинхронную генерацию
            audio_data = asyncio.run(generate())
            return audio_data

        except Exception as e:
            logger.error(f"Ошибка Edge-TTS: {e}")
            return None

    def generate_audio(self, text: str, lang_code: str, voice_type: str) -> Optional[Dict]:
        """
        Генерация аудиофайла для указанного текста, языка и типа голоса

        Args:
            text: Текст фразы
            lang_code: Код языка (en, ru, hi, etc.)
            voice_type: Тип голоса (male, female)

        Returns:
            dict: Информация о сгенерированном файле
        """

        if not text or not isinstance(text, str):
            logger.warning("Пустой текст")
            return None

        # Нормализуем текст
        clean_text = re.sub(r'\([^()]*\)|\[[^\[\]]*\]', '', ' '.join(text.strip().split())).strip()

        # Генерация имени файла
        filename = self._generate_filename(clean_text, lang_code, voice_type)

        # Настройки
        settings = {
            'rate': '+0%'
        }

        # Определение директории для сохранения
        save_dir = Path(self.base_output_dir) / voice_type / lang_code
        save_dir.mkdir(parents=True, exist_ok=True)

        # Полный путь к файлу
        filepath = save_dir / filename

        # Проверяем, существует ли уже файл
        if filepath.exists() and filepath.stat().st_size > 0:
            logger.info(f"Файл уже существует: {filename}")
            return {
                'text': clean_text,
                'lang_code': lang_code,
                'voice_type': voice_type,
                'filename': filename,
                'filepath': str(filepath),
                'file_size': filepath.stat().st_size,
                'already_exists': True,
                'engine': 'edge_tts' if self.use_edge_tts else 'gtts'
            }

        logger.info(f"Генерация [{voice_type}/{lang_code}]: '{clean_text[:60]}...' ({'Edge-TTS' if self.use_edge_tts else 'gTTS'})")

        # Выбираем метод генерации
        audio_data = None

        if self.use_edge_tts and self.edge_tts_available:
            audio_data = self._generate_with_edge_tts(clean_text, lang_code, voice_type, settings)
        else:
            # Настройки для gTTS
            gtts_settings = {
                'tld': self.gtts_tld_map.get(lang_code, 'com'),
                'slow': False
            }
            audio_data = self._generate_with_gtts(clean_text, lang_code, gtts_settings)

        if audio_data:
            # Сохраняем в файл
            with open(filepath, 'wb') as f:
                f.write(audio_data)

            # Задержка между запросами
            time.sleep(self.request_delay)

            # Проверяем файл
            if filepath.exists() and filepath.stat().st_size > 0:
                file_size_kb = filepath.stat().st_size / 1024
                logger.info(f"✓ Создан: {filename} ({file_size_kb:.1f} KB)")

                return {
                    'text': clean_text,
                    'lang_code': lang_code,
                    'voice_type': voice_type,
                    'filename': filename,
                    'filepath': str(filepath),
                    'file_size': filepath.stat().st_size,
                    'already_exists': False,
                    'engine': 'edge_tts' if self.use_edge_tts else 'gtts'
                }

        logger.error(f"Ошибка генерации для [{voice_type}/{lang_code}]: '{clean_text[:30]}...'")
        return None

    def parse_direction(self, direction_str):
        parts = direction_str.split('-')
        if len(parts) == 2:
            return {'source': parts[0], 'target': parts[1]}
        return None

    def generate_all_from_db(self, direction: str = DEFAULT_DIRECTION) -> Dict:
        """
        Генерация всех аудиофайлов для фраз из БД по заданному направлению.

        Args:
            direction: Направление перевода для выборки из БД.

        Returns:
            dict: Статистика выполнения.
        """
        # Проверяем интернет для онлайн-движков
        if not self._check_internet_connection():
            return {"error": "Требуется интернет-соединение"}

        # Загружаем фразы из БД
        phrases_list = self.fetch_phrases_by_direction(direction)

        if not phrases_list:
            logger.warning(f"Нет данных для обработки для направления '{direction}'")
            return {"error": f"Нет данных для обработки для направления '{direction}'"}

        # Инициализируем статистику для всех поддерживаемых языков
        supported_langs = self.get_supported_languages()
        lang_stats = {}
        for lang in supported_langs:
            lang_stats[lang] = {'files': 0, 'existing': 0, 'errors': 0}

        results = {
            'engine': 'edge_tts' if self.use_edge_tts else 'gtts',
            'direction': direction,
            'total_phrases': len(phrases_list),
            'total_operations': 0,
            'generated_files': 0,
            'existing_files': 0,
            'errors': 0,
            'voice_types': {
                'male': {
                    'languages': lang_stats.copy(),
                    'directions': {}
                },
                'female': {
                    'languages': lang_stats.copy(),
                    'directions': {}
                }
            }
        }

        logger.info(f"\n{'='*60}")
        logger.info(f"ГЕНЕРАЦИЯ АУДИОФАЙЛОВ ДЛЯ ВСЕХ ТИПОВ ГОЛОСОВ ({'Edge-TTS' if self.use_edge_tts else 'gTTS'})")
        logger.info(f"Стиль голоса: {self.style}")
        logger.info(f"Направление из БД: {direction}")
        logger.info(f"Поддерживается {len(supported_langs)} языков")
        logger.info(f"{'='*60}")

        # Обрабатываем каждую фразу
        for i, phrase_item in enumerate(phrases_list, 1):
            current_direction = phrase_item['direction']
            target_text = phrase_item['target']
            native_text = phrase_item['native']

            lang_mapping = self.parse_direction(current_direction)
            if not lang_mapping:
                logger.warning(f"  Фраза #{i}: некорректное направление '{current_direction}', пропускаем")
                continue

            source_lang = lang_mapping['source']
            target_lang = lang_mapping['target']

            # Проверяем, поддерживаются ли языки
            if source_lang not in supported_langs:
                logger.warning(f"  Язык {source_lang} не поддерживается, пропускаем target")
                continue
            if target_lang not in supported_langs:
                logger.warning(f"  Язык {target_lang} не поддерживается, пропускаем native")
                continue

            logger.info(f"  Фраза #{i} [{current_direction}]:")
            logger.info(f"    Target ({source_lang}): '{target_text[:50]}...'")
            logger.info(f"    Native ({target_lang}): '{native_text[:50]}...'")

            # Для каждого типа голоса
            for voice_type in self.voice_types:
                # Инициализируем статистику для направления если нужно
                if current_direction not in results['voice_types'][voice_type]['directions']:
                    results['voice_types'][voice_type]['directions'][current_direction] = {
                        'files': 0,
                        'existing': 0,
                        'errors': 0
                    }

                logger.info(f"    Тип голоса: {voice_type}")

                # Генерируем аудио для target (язык source)
                if target_text:
                    target_result = self.generate_audio(target_text, source_lang, voice_type)

                    if target_result:
                        if target_result.get('already_exists'):
                            results['voice_types'][voice_type]['languages'][source_lang]['existing'] += 1
                            results['voice_types'][voice_type]['directions'][current_direction]['existing'] += 1
                            results['existing_files'] += 1
                        else:
                            results['voice_types'][voice_type]['languages'][source_lang]['files'] += 1
                            results['voice_types'][voice_type]['directions'][current_direction]['files'] += 1
                            results['generated_files'] += 1
                        results['total_operations'] += 1
                    else:
                        results['voice_types'][voice_type]['languages'][source_lang]['errors'] += 1
                        results['voice_types'][voice_type]['directions'][current_direction]['errors'] += 1
                        results['errors'] += 1
                        results['total_operations'] += 1

                # Генерируем аудио для native (язык target)
                if native_text:
                    native_result = self.generate_audio(native_text, target_lang, voice_type)

                    if native_result:
                        if native_result.get('already_exists'):
                            results['voice_types'][voice_type]['languages'][target_lang]['existing'] += 1
                            results['voice_types'][voice_type]['directions'][current_direction]['existing'] += 1
                            results['existing_files'] += 1
                        else:
                            results['voice_types'][voice_type]['languages'][target_lang]['files'] += 1
                            results['voice_types'][voice_type]['directions'][current_direction]['files'] += 1
                            results['generated_files'] += 1
                        results['total_operations'] += 1
                    else:
                        results['voice_types'][voice_type]['languages'][target_lang]['errors'] += 1
                        results['voice_types'][voice_type]['directions'][current_direction]['errors'] += 1
                        results['errors'] += 1
                        results['total_operations'] += 1

        # Итоги
        logger.info(f"\n{'='*60}")
        logger.info("ИТОГИ:")
        logger.info(f"{'='*60}")
        logger.info(f"Движок: {results['engine']}")
        logger.info(f"Стиль голоса: {self.style}")
        logger.info(f"Направление: {results['direction']}")
        logger.info(f"Всего фраз в выборке: {results['total_phrases']}")
        logger.info(f"Всего операций генерации: {results['total_operations']}")
        logger.info(f"Новых файлов: {results['generated_files']}")
        logger.info(f"Существовало: {results['existing_files']}")
        logger.info(f"Ошибок: {results['errors']}")
        logger.info(f"Файлы сохранены в: {self.base_output_dir}/")

        # Показываем статистику по типам голосов и языкам
        logger.info(f"\nСтатистика по типам голосов и языкам:")
        for voice_type in self.voice_types:
            logger.info(f"\n  {voice_type.upper()}:")
            # Показываем только языки с ненулевой статистикой
            for lang_code in sorted(self.get_supported_languages()):
                stats = results['voice_types'][voice_type]['languages'][lang_code]
                if stats['files'] > 0 or stats['existing'] > 0 or stats['errors'] > 0:
                    lang_info = self.get_language_info(lang_code)
                    lang_name = lang_info['name'] if lang_info else lang_code
                    logger.info(f"    {lang_name} ({lang_code}): создано {stats['files']}, существовало {stats['existing']}, ошибок {stats['errors']}")

        # Показываем статистику по направлениям для каждого типа голоса
        logger.info(f"\nСтатистика по направлениям:")
        for voice_type in self.voice_types:
            logger.info(f"\n  {voice_type.upper()}:")
            for dir_name, stats in results['voice_types'][voice_type]['directions'].items():
                logger.info(f"    {dir_name}: создано {stats['files']}, существовало {stats['existing']}, ошибок {stats['errors']}")

        # Показываем структуру директорий
        logger.info(f"\nСтруктура директорий:")
        for voice_type in self.voice_types:
            for lang_code in sorted(self.get_supported_languages()):
                lang_dir = Path(self.base_output_dir) / voice_type / lang_code
                if lang_dir.exists():
                    mp3_files = list(lang_dir.glob("*.mp3"))
                    if mp3_files:  # Показываем только непустые директории
                        lang_info = self.get_language_info(lang_code)
                        lang_name = lang_info['name'] if lang_info else lang_code
                        logger.info(f"  {voice_type}/{lang_code}/ - {lang_name}: {len(mp3_files)} файлов")

        return results


def main():
    import argparse

    parser = argparse.ArgumentParser(description='Генератор речи из базы данных MySQL для всех типов голосов (male и female)')
    parser.add_argument('--direction', default=DEFAULT_DIRECTION,
                       help='Направление перевода для выборки из БД (например, en-ru)')
    parser.add_argument('--output-dir', default=BASE_AUDIO_DIR,
                       help='Директория для сохранения аудиофайлов')
    parser.add_argument('--use-gtts', action='store_true',
                       help='Использовать gTTS вместо Edge-TTS')
    parser.add_argument('--voice', help='Имя конкретного голоса для Edge-TTS')
    parser.add_argument('--style', choices=['neutral', 'friendly', 'professional', 'energetic', 'young', 'child'], default='neutral',
                       help='Стиль голоса (neutral/friendly/professional/energetic/young/child)')
    parser.add_argument('--db-host', default='localhost',
                       help='Хост MySQL')
    parser.add_argument('--db-user', default=DB_USER,
                       help='Имя пользователя MySQL')
    parser.add_argument('--db-password', default=DB_PASSWORD,
                       help='Пароль MySQL')
    parser.add_argument('--db-name', default='eng_phrases',
                       help='Имя базы данных')
    parser.add_argument('--db-port', type=int, default=3306,
                       help='Порт MySQL')
    parser.add_argument('--list-languages', action='store_true',
                       help='Показать список поддерживаемых языков и выйти')
    parser.add_argument('--list-voices', action='store_true',
                       help='Показать список всех доступных голосов и выйти')

    args = parser.parse_args()

    # Создаем генератор
    generator = EnhancedSpeechGenerator(
        use_edge_tts=not args.use_gtts,
        voice_name=args.voice,
        output_dir=args.output_dir,
        style=args.style,
        db_host=args.db_host,
        db_user=args.db_user,
        db_password=args.db_password,
        db_name=args.db_name,
        db_port=args.db_port
    )

    if args.list_languages:
        print(f"\n{'='*60}")
        print("ПОДДЕРЖИВАЕМЫЕ ЯЗЫКИ (с населением > 5 млн человек)")
        print(f"{'='*60}")
        for lang_code in sorted(generator.get_supported_languages()):
            info = generator.get_language_info(lang_code)
            if info:
                print(f"  {lang_code}: {info['name']} - {info['total_voices']} голосов ({info['male_voices']} мужских, {info['female_voices']} женских)")
        sys.exit(0)

    if args.list_voices:
        generator.list_all_voices()
        sys.exit(0)

    try:
        # Запускаем генерацию
        start_time = time.time()
        results = generator.generate_all_from_db(direction=args.direction)
        end_time = time.time()

        # Добавляем время выполнения
        if 'error' not in results:
            results['total_time'] = f"{end_time - start_time:.2f} сек"

        print(f"\n{'='*60}")
        print("ЗАВЕРШЕНО!")
        print(f"{'='*60}")
        if 'total_time' in results:
            print(f"Общее время: {results['total_time']}")
        print(f"Аудиофайлы сохранены в: {generator.base_output_dir}/")
        print(f"Структура: {generator.base_output_dir}/[male|female]/[язык]/")
    finally:
        # Важно отключиться от БД даже при ошибке
        generator.disconnect_from_db()


if __name__ == "__main__":
    main()