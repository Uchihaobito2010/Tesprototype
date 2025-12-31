const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const { v4: uuidv4 } = require('uuid');
const downloaders = require('../lib/downloaders');
const cache = require('../lib/cache');

const app = express();

// 中间件配置
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"]
    }
  }
}));

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['https://yourdomain.com'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));

// 速率限制
const rateLimiter = new RateLimiterMemory({
  points: 10, // 10个请求
  duration: 60, // 每分钟
});

const rateLimiterMiddleware = (req, res, next) => {
  const clientIp = req.headers['x-forwarded-for'] || req.ip;
  rateLimiter.consume(clientIp)
    .then(() => next())
    .catch(() => {
      res.status(429).json({
        success: false,
        error: '请求过于频繁，请稍后再试'
      });
    });
};

// 验证请求中间件
const validateRequest = (req, res, next) => {
  const { url, platform } = req.body;
  
  if (!url) {
    return res.status(400).json({
      success: false,
      error: '缺少URL参数'
    });
  }

  // URL格式验证
  const urlPattern = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/;
  if (!urlPattern.test(url)) {
    return res.status(400).json({
      success: false,
      error: '无效的URL格式'
    });
  }

  req.validatedData = { url, platform: platform || 'auto' };
  next();
};

// 主下载端点
app.post('/api/download', rateLimiterMiddleware, validateRequest, async (req, res) => {
  try {
    const { url, platform } = req.validatedData;
    const requestId = uuidv4();

    console.log(`[${requestId}] 处理请求:`, { url, platform });

    // 检查缓存
    const cacheKey = `download:${url}`;
    const cached = await cache.get(cacheKey);
    
    if (cached) {
      console.log(`[${requestId}] 返回缓存数据`);
      return res.json({
        ...cached,
        cached: true,
        requestId
      });
    }

    // 确定平台
    const detectedPlatform = platform === 'auto' ? detectPlatform(url) : platform;
    
    if (!downloaders[detectedPlatform]) {
      return res.status(400).json({
        success: false,
        error: '不支持的平台',
        detectedPlatform
      });
    }

    // 下载内容
    const result = await downloaders[detectedPlatform](url);
    
    // 缓存结果（10分钟）
    await cache.set(cacheKey, result, 600);

    res.json({
      ...result,
      cached: false,
      requestId
    });

  } catch (error) {
    console.error('下载失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '下载失败',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// 健康检查端点
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// 平台检测函数
function detectPlatform(url) {
  if (url.includes('instagram.com')) return 'instagram';
  if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  if (url.includes('tiktok.com')) return 'tiktok';
  if (url.includes('facebook.com')) return 'facebook';
  if (url.includes('pinterest.com')) return 'pinterest';
  return 'generic';
}

// Vercel Serverless 导出
module.exports = app;
