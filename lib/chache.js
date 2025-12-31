// 简单内存缓存（生产环境建议使用 Redis）
class MemoryCache {
  constructor() {
    this.cache = new Map();
  }

  async get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (item.expiry && item.expiry < Date.now()) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }

  async set(key, value, ttl = 300) {
    const item = {
      value,
      expiry: ttl ? Date.now() + (ttl * 1000) : null
    };
    this.cache.set(key, item);
  }

  async delete(key) {
    this.cache.delete(key);
  }

  async clear() {
    this.cache.clear();
  }
}

// 如果是生产环境，这里可以换成 Redis
const cache = new MemoryCache();

module.exports = cache;
