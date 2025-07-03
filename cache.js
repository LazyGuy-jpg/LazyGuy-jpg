const NodeCache = require('node-cache');
const config = require('./config');

class CacheManager {
  constructor() {
    // Main cache instances
    this.userCache = new NodeCache({
      stdTTL: config.cache.userCacheTTL,
      checkperiod: config.cache.checkPeriod,
      maxKeys: Math.floor(config.cache.maxKeys / 4),
      useClones: false
    });

    this.priceCache = new NodeCache({
      stdTTL: config.cache.priceCacheTTL,
      checkperiod: config.cache.checkPeriod,
      maxKeys: 1000,
      useClones: false
    });

    this.callStateCache = new NodeCache({
      stdTTL: config.cache.callStateTTL,
      checkperiod: 60,
      maxKeys: Math.floor(config.cache.maxKeys / 2),
      useClones: false
    });

    this.generalCache = new NodeCache({
      stdTTL: config.cache.ttl,
      checkperiod: config.cache.checkPeriod,
      maxKeys: Math.floor(config.cache.maxKeys / 4),
      useClones: false
    });

    // Statistics tracking
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0
    };

    // Set up event listeners for debugging (only in development)
    if (config.nodeEnv !== 'production') {
      this.setupEventListeners();
    }
  }

  setupEventListeners() {
    const caches = [
      { name: 'user', cache: this.userCache },
      { name: 'price', cache: this.priceCache },
      { name: 'callState', cache: this.callStateCache },
      { name: 'general', cache: this.generalCache }
    ];

    caches.forEach(({ name, cache }) => {
      cache.on('expired', (key, value) => {
        if (config.nodeEnv !== 'production') {
          console.debug(`Cache ${name} - Key expired: ${key}`);
        }
      });

      cache.on('flush', () => {
        if (config.nodeEnv !== 'production') {
          console.debug(`Cache ${name} - Flushed`);
        }
      });
    });
  }

  // User cache methods
  getUserKey(apiKey) {
    return `user:${apiKey}`;
  }

  async getUser(apiKey) {
    const key = this.getUserKey(apiKey);
    const cached = this.userCache.get(key);
    
    if (cached) {
      this.stats.hits++;
      return cached;
    }
    
    this.stats.misses++;
    return null;
  }

  setUser(apiKey, userData, ttl) {
    const key = this.getUserKey(apiKey);
    this.stats.sets++;
    return this.userCache.set(key, userData, ttl || config.cache.userCacheTTL);
  }

  deleteUser(apiKey) {
    const key = this.getUserKey(apiKey);
    this.stats.deletes++;
    return this.userCache.del(key);
  }

  // Price cache methods
  getPriceKey(countryCode) {
    return `price:${countryCode}`;
  }

  async getCountryPrice(countryCode) {
    const key = this.getPriceKey(countryCode);
    const cached = this.priceCache.get(key);
    
    if (cached) {
      this.stats.hits++;
      return cached;
    }
    
    this.stats.misses++;
    return null;
  }

  setCountryPrice(countryCode, priceData, ttl) {
    const key = this.getPriceKey(countryCode);
    this.stats.sets++;
    return this.priceCache.set(key, priceData, ttl || config.cache.priceCacheTTL);
  }

  deleteCountryPrice(countryCode) {
    const key = this.getPriceKey(countryCode);
    this.stats.deletes++;
    return this.priceCache.del(key);
  }

  flushPriceCache() {
    this.priceCache.flushAll();
  }

  // Call state cache methods
  getCallStateKey(callId) {
    return `call:${callId}`;
  }

  async getCallState(callId) {
    const key = this.getCallStateKey(callId);
    const cached = this.callStateCache.get(key);
    
    if (cached) {
      this.stats.hits++;
      return cached;
    }
    
    this.stats.misses++;
    return null;
  }

  setCallState(callId, callData, ttl) {
    const key = this.getCallStateKey(callId);
    this.stats.sets++;
    return this.callStateCache.set(key, callData, ttl || config.cache.callStateTTL);
  }

  deleteCallState(callId) {
    const key = this.getCallStateKey(callId);
    this.stats.deletes++;
    return this.callStateCache.del(key);
  }

  // General cache methods
  get(key) {
    const cached = this.generalCache.get(key);
    
    if (cached) {
      this.stats.hits++;
      return cached;
    }
    
    this.stats.misses++;
    return null;
  }

  set(key, value, ttl) {
    this.stats.sets++;
    return this.generalCache.set(key, value, ttl || config.cache.ttl);
  }

  delete(key) {
    this.stats.deletes++;
    return this.generalCache.del(key);
  }

  // Multi-key operations
  mget(keys) {
    const results = this.generalCache.mget(keys);
    Object.keys(results).forEach(key => {
      if (results[key] !== undefined) {
        this.stats.hits++;
      } else {
        this.stats.misses++;
      }
    });
    return results;
  }

  // Utility methods
  flushAll() {
    this.userCache.flushAll();
    this.priceCache.flushAll();
    this.callStateCache.flushAll();
    this.generalCache.flushAll();
  }

  getStats() {
    return {
      ...this.stats,
      userCacheSize: this.userCache.getStats().keys,
      priceCacheSize: this.priceCache.getStats().keys,
      callStateCacheSize: this.callStateCache.getStats().keys,
      generalCacheSize: this.generalCache.getStats().keys,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0
    };
  }

  // Clean up expired keys manually
  cleanupExpired() {
    const caches = [this.userCache, this.priceCache, this.callStateCache, this.generalCache];
    caches.forEach(cache => {
      const keys = cache.keys();
      keys.forEach(key => {
        cache.get(key); // This will automatically remove expired keys
      });
    });
  }

  // Get all active call states (for monitoring)
  getAllActiveCallStates() {
    const keys = this.callStateCache.keys();
    const activeCalls = {};
    
    keys.forEach(key => {
      const callData = this.callStateCache.get(key);
      if (callData) {
        const callId = key.replace('call:', '');
        activeCalls[callId] = callData;
      }
    });
    
    return activeCalls;
  }

  // Session-specific caching
  getSessionKey(sessionId, key) {
    return `session:${sessionId}:${key}`;
  }

  getSessionData(sessionId, key) {
    const cacheKey = this.getSessionKey(sessionId, key);
    return this.get(cacheKey);
  }

  setSessionData(sessionId, key, value, ttl) {
    const cacheKey = this.getSessionKey(sessionId, key);
    return this.set(cacheKey, value, ttl || 1800); // 30 minutes default
  }

  deleteSessionData(sessionId, key) {
    const cacheKey = this.getSessionKey(sessionId, key);
    return this.delete(cacheKey);
  }

  // Batch operations for efficiency
  async batchGetUsers(apiKeys) {
    const keys = apiKeys.map(apiKey => this.getUserKey(apiKey));
    const results = {};
    
    keys.forEach((key, index) => {
      const cached = this.userCache.get(key);
      if (cached) {
        this.stats.hits++;
        results[apiKeys[index]] = cached;
      } else {
        this.stats.misses++;
      }
    });
    
    return results;
  }

  batchSetUsers(usersData) {
    const success = [];
    
    Object.entries(usersData).forEach(([apiKey, userData]) => {
      const key = this.getUserKey(apiKey);
      if (this.userCache.set(key, userData)) {
        this.stats.sets++;
        success.push(apiKey);
      }
    });
    
    return success;
  }
}

// Create singleton instance
const cacheManager = new CacheManager();

// Export both the class and the instance
module.exports = {
  CacheManager,
  cacheManager
};