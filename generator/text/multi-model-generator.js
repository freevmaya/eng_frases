// multi-model-generator.js
const { HfInference } = require('@huggingface/inference');

class MultiModelTextGenerator {
  constructor() {
    this.hf = new HfInference(os.environ.get('HF_API_KEY'));
    
    // Список приоритетных моделей (от лучшей к худшей)
    this.models = [
      "mistralai/Mistral-7B-Instruct-v0.1",  // Лучшая бесплатная
      "google/flan-t5-xxl",                   // Хорошая для инструкций
      "gpt2",                                 // Базовая, всегда работает
      "EleutherAI/gpt-neo-2.7B"              // Альтернатива
    ];
    
    this.currentModelIndex = 0;
  }

  async tryGenerateWithModel(prompt, model, options) {
    try {
      console.log(`Попытка с моделью: ${model}`);
      const response = await this.hf.textGeneration({
        model: model,
        inputs: prompt,
        parameters: options,
        options: {
          wait_for_model: true, // Ждем, если модель загружается
          use_cache: true
        }
      });
      
      return {
        success: true,
        model: model,
        text: response.generated_text
      };
    } catch (error) {
      console.log(`Модель ${model} не сработала: ${error.message}`);
      return {
        success: false,
        model: model,
        error: error.message
      };
    }
  }

  async generateWithFallback(prompt, options = {}) {
    const defaultOptions = {
      max_new_tokens: 300,
      temperature: 0.7
    };
    
    const mergedOptions = { ...defaultOptions, ...options };
    
    // Пробуем модели по порядку
    for (let i = 0; i < this.models.length; i++) {
      const model = this.models[i];
      const result = await this.tryGenerateWithModel(prompt, model, mergedOptions);
      
      if (result.success) {
        return result;
      }
      
      // Небольшая пауза между попытками
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error('Все модели недоступны');
  }
}

// Пример использования
async function testMultiModel() {
  const generator = new MultiModelTextGenerator();
  
  const prompt = "Объясни квантовые вычисления простыми словами";
  
  try {
    const result = await generator.generateWithFallback(prompt);
    console.log(`Успешно сгенерировано моделью: ${result.model}`);
    console.log(`Текст: ${result.text}`);
  } catch (error) {
    console.error('Ошибка:', error.message);
  }
}

testMultiModel();