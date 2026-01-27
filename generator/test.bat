curl -X POST http://localhost:5000/api/generate-audio \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello world", "language": "en", "gender": "female"}'