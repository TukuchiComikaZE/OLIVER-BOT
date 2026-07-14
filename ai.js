const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

const SYSTEM_PROMPT = 'You are a helpful assistant. Always respond in Khmer language. Keep responses concise and natural for text-to-speech.';
const DAILY_LIMIT = parseInt(process.env.AI_DAILY_LIMIT) || 50;
const COUNTER_FILE = path.join(__dirname, 'ai_usage.json');

function getUsage() {
  try {
    if (fs.existsSync(COUNTER_FILE)) {
      const data = JSON.parse(fs.readFileSync(COUNTER_FILE, 'utf8'));
      const today = new Date().toDateString();
      if (data.date === today) return data.count;
    }
  } catch (err) {
    console.error('Usage file error:', err.message);
  }
  return 0;
}

function saveUsage(count) {
  try {
    fs.writeFileSync(COUNTER_FILE, JSON.stringify({ date: new Date().toDateString(), count }));
  } catch (err) {
    console.error('Usage save error:', err.message);
  }
}

async function askGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('API key not set. Please set GEMINI_API_KEY.');

  const used = getUsage();
  if (used >= DAILY_LIMIT) {
    throw new Error('អស់សំណួរហើយសម្រាប់ថ្ងៃនេះ សូមត្រឡប់មកវិញនៅថ្ងៃស្អែក');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    });

    const response = result.response;
    saveUsage(used + 1);
    return response.text();
  } catch (err) {
    if (err.message && err.message.includes('429')) {
      throw new Error('អស់សំណួរហើយសម្រាប់ថ្ងៃនេះ សូមត្រឡប់មកវិញនៅថ្ងៃស្អែក');
    }
    throw err;
  }
}

function getRemaining() {
  const used = getUsage();
  return Math.max(0, DAILY_LIMIT - used);
}

module.exports = { askGemini, getRemaining, DAILY_LIMIT };
