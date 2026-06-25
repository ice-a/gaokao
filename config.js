require('dotenv').config();

module.exports = {
  mongo: {
    uri: process.env.MONGO_URI || 'mongodb://localhost:27017',
    db: process.env.MONGO_DB || 'gaokaodb',
    collection: 'schools',
  },
  llm: {
    apiKey: process.env.LLM_API_KEY || '',
    baseURL: process.env.LLM_API_BASE || 'https://api.openai.com/v1',
    model: process.env.LLM_MODEL || 'gpt-4o-mini',
  },
  server: {
    port: parseInt(process.env.PORT) || 3000,
  },
  auth: {
    password: process.env.SITE_PASSWORD || 'gaokao2026',
    cookieName: 'gaokao_auth',
    cookieMaxAge: 7 * 24 * 60 * 60 * 1000,
  },
};
