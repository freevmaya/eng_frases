-- init_db.sql
CREATE DATABASE IF NOT EXISTS eng_phrases;
USE eng_phrases;

CREATE TABLE IF NOT EXISTS phrase_cache (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cache_key VARCHAR(32) UNIQUE NOT NULL,
    native_lang VARCHAR(2) NOT NULL,
    target_lang VARCHAR(2) NOT NULL,
    theme TEXT NOT NULL,
    phrases_json TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_cache_key (cache_key)
);