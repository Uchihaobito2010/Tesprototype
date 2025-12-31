import axios from 'axios';
import * as cheerio from 'cheerio';

// 内存友好的缓存实现
const cache = new Map();
const CACHE_TTL = 300000; // 5分钟

// 简单的内存缓存
function getCached(key) {
  const item = cache.get(key);
  if (item && Date.now() - item.timestamp < CACHE_TTL) {
    return item.data;
  }
  cache.delete(key);
  return null;
}

function setCached(key, data) {
  cache.set(key, {
    data,
    timestamp: Date.now()
  });
  
  // 自动清理过期缓存（避免内存泄漏）
  if (cache.size > 100) {
    const keys = Array.from(cache.keys());
    for (let i = 0; i < 50; i++) {
      cache.delete(keys[i]);
    }
  }
}

// 优化的下载函数（内存友好）
async function downloadContent(url) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 10000, // 10秒超时
      maxContentLength: 1024 * 1024, // 限制响应大小 1MB
    });

    const $ = cheerio.load(response.data);
    
    // 提取基本信息（内存友好的方式）
    const result = {
      success: true,
      url: url,
      title: $('meta[property="og:title"]').attr('content') || 
             $('meta[name="twitter:title"]').attr('content') || 
             'Social Media Content',
      author: $('meta[name="twitter:site"]').attr('content') || 
              $('meta[property="og:site_name"]').attr('content') || 
              'Unknown',
      thumbnail: $('meta[property="og:image"]').attr('content') || 
                 $('meta[name="twitter:image"]').attr('content') || 
                 null,
      medias: {
        images: [],
        videos: []
      }
    };

    // 提取视频URL
    const videoUrl = $('meta[property="og:video"]').attr('content') ||
                     $('meta[property="og:video:url"]').attr('content');

    if (videoUrl) {
      result.medias.videos.push({
        url: videoUrl,
        type: 'video',
        quality: 'hd'
      });
    }

    // 提取图片URL
    const imageUrl = $('meta[property="og:image"]').attr('content');
    if (imageUrl && !videoUrl) {
      result.medias.images.push({
        url: imageUrl,
        type: 'image'
      });
    }

    return result;
  } catch (error) {
    throw new Error(`Failed to download content: ${error.message}`);
  }
}

// Vercel Serverless Handler
export default async function handler(req, res) {
  // 设置响应头
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 处理预检请求
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 只接受POST请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // URL验证
    try {
      new URL(url);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // 检查缓存
    const cacheKey = `download_${url}`;
    const cached = getCached(cacheKey);
    
    if (cached) {
      return res.json({
        ...cached,
        cached: true
      });
    }

    // 下载内容
    const result = await downloadContent(url);
    
    // 缓存结果
    setCached(cacheKey, result);

    res.json({
      ...result,
      cached: false
    });

  } catch (error) {
    console.error('Error:', error);
    
    // 友好的错误信息
    const errorMessage = error.message.includes('timeout') 
      ? 'Request timeout. Please try again.'
      : error.message.includes('ENOTFOUND')
      ? 'Unable to reach the website. Please check the URL.'
      : 'Failed to download content. Please try again.';

    res.status(500).json({
      error: errorMessage,
      success: false
    });
  }
}
