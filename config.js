module.exports = {
  // Server configuration
  port: process.env.PORT || 3000,
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
  sessionSecret: process.env.SESSION_SECRET || 'your-session-secret-here',
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Admin configuration
  ADMIN_SECRET: process.env.ADMIN_SECRET || 'your-admin-secret-here',
  
  // MySQL Database configuration
  db: {
    dialect: 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    username: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'asterisk_api',
    // Connection pool configuration
    pool: {
      max: parseInt(process.env.DB_POOL_MAX) || 100,
      min: parseInt(process.env.DB_POOL_MIN) || 5,
      acquire: parseInt(process.env.DB_POOL_ACQUIRE) || 60000,
      idle: parseInt(process.env.DB_POOL_IDLE) || 10000,
      evict: parseInt(process.env.DB_POOL_EVICT) || 1000,
      handleDisconnects: true
    },
    // MySQL specific optimizations
    dialectOptions: {
      charset: 'utf8mb4',
      connectTimeout: 60000,
      ssl: process.env.DB_SSL === 'true' ? {
        rejectUnauthorized: false
      } : false
    },
    // Query optimizations
    logging: process.env.NODE_ENV === 'production' ? false : console.log,
    benchmark: process.env.NODE_ENV !== 'production',
    define: {
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci',
      underscored: false,
      freezeTableName: true,
      timestamps: true
    }
  },
  
  // Cache configuration
  cache: {
    ttl: parseInt(process.env.CACHE_TTL) || 300, // 5 minutes default
    checkPeriod: parseInt(process.env.CACHE_CHECK_PERIOD) || 60, // 1 minute
    maxKeys: parseInt(process.env.CACHE_MAX_KEYS) || 10000,
    // Specific TTLs for different cache types
    userCacheTTL: parseInt(process.env.USER_CACHE_TTL) || 600, // 10 minutes
    priceCacheTTL: parseInt(process.env.PRICE_CACHE_TTL) || 3600, // 1 hour
    callStateTTL: parseInt(process.env.CALL_STATE_TTL) || 1800, // 30 minutes
  },
  
  // Asterisk ARI configuration
  ari: {
    url: process.env.ARI_URL || 'http://localhost:8088',
    username: process.env.ARI_USERNAME || 'asterisk',
    password: process.env.ARI_PASSWORD || 'asterisk',
    reconnectInterval: parseInt(process.env.ARI_RECONNECT_INTERVAL) || 5000,
    maxReconnectAttempts: parseInt(process.env.ARI_MAX_RECONNECT_ATTEMPTS) || 10,
  },
  
  // Azure TTS configuration
  azureTts: {
    apiKey: process.env.AZURE_TTS_API_KEY || 'your-azure-tts-key',
    region: process.env.AZURE_TTS_REGION || 'eastus',
    maxRetries: parseInt(process.env.AZURE_TTS_MAX_RETRIES) || 3,
    retryDelay: parseInt(process.env.AZURE_TTS_RETRY_DELAY) || 1000,
  },
  
  // Azure Speech configuration
  azureSpeech: {
    apiKey: process.env.AZURE_SPEECH_API_KEY || 'your-azure-speech-key',
    region: process.env.AZURE_SPEECH_REGION || 'eastus',
    maxRetries: parseInt(process.env.AZURE_SPEECH_MAX_RETRIES) || 3,
    retryDelay: parseInt(process.env.AZURE_SPEECH_RETRY_DELAY) || 1000,
  },
  
  // OpenAI configuration
  openai: {
    apiKey: process.env.OPENAI_API_KEY || 'your-openai-api-key',
    maxRetries: parseInt(process.env.OPENAI_MAX_RETRIES) || 3,
    timeout: parseInt(process.env.OPENAI_TIMEOUT) || 30000,
  },
  
  // NOWPayments configuration
  nowpayments: {
    apiKey: process.env.NOWPAYMENTS_API_KEY || 'your-nowpayments-api-key',
    ipnSecret: process.env.NOWPAYMENTS_IPN_SECRET || 'your-ipn-secret',
    callbackUrl: process.env.NOWPAYMENTS_CALLBACK_URL || 'http://localhost:3000/nowpayments-ipn',
    minTopup: parseFloat(process.env.MIN_TOPUP) || 5.00,
  },
  
  // Performance settings
  performance: {
    maxConcurrentCalls: parseInt(process.env.MAX_CONCURRENT_CALLS) || 1000,
    callStateCleanupInterval: parseInt(process.env.CALL_STATE_CLEANUP_INTERVAL) || 300000, // 5 minutes
    recordingCleanupInterval: parseInt(process.env.RECORDING_CLEANUP_INTERVAL) || 3600000, // 1 hour
    dbCleanupInterval: parseInt(process.env.DB_CLEANUP_INTERVAL) || 86400000, // 24 hours
  },
  
  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'error' : 'info'),
    maxFiles: parseInt(process.env.LOG_MAX_FILES) || 30,
    maxSize: process.env.LOG_MAX_SIZE || '20m',
    datePattern: 'YYYY-MM-DD',
    dirname: process.env.LOG_DIR || 'logs',
  }
};