module.exports = {
  // Server configuration
  port: process.env.PORT || 3000,
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
  sessionSecret: process.env.SESSION_SECRET || 'your-session-secret-here',
  
  // Admin configuration
  ADMIN_SECRET: process.env.ADMIN_SECRET || 'your-admin-secret-here',
  
  // Database configuration
  db: {
    dialect: process.env.DB_DIALECT || 'sqlite',
    storage: process.env.DB_STORAGE || './database.sqlite',
  },
  
  // Asterisk ARI configuration
  ari: {
    url: process.env.ARI_URL || 'http://localhost:8088',
    username: process.env.ARI_USERNAME || 'asterisk',
    password: process.env.ARI_PASSWORD || 'asterisk',
  },
  
  // Azure TTS configuration
  azureTts: {
    apiKey: process.env.AZURE_TTS_API_KEY || 'your-azure-tts-key',
    region: process.env.AZURE_TTS_REGION || 'eastus',
  },
  
  // Azure Speech configuration
  azureSpeech: {
    apiKey: process.env.AZURE_SPEECH_API_KEY || 'your-azure-speech-key',
    region: process.env.AZURE_SPEECH_REGION || 'eastus',
  },
  
  // OpenAI configuration
  openai: {
    apiKey: process.env.OPENAI_API_KEY || 'your-openai-api-key',
  },
  
  // NOWPayments configuration
  nowpayments: {
    apiKey: process.env.NOWPAYMENTS_API_KEY || 'your-nowpayments-api-key',
    ipnSecret: process.env.NOWPAYMENTS_IPN_SECRET || 'your-ipn-secret',
    callbackUrl: process.env.NOWPAYMENTS_CALLBACK_URL || 'http://localhost:3000/nowpayments-ipn',
    minTopup: parseFloat(process.env.MIN_TOPUP) || 5.00,
  },
};