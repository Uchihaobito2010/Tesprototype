const axios = require('axios');
const cheerio = require('cheerio');

// 通用 User-Agent
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36'
];

const getRandomUserAgent = () => {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
};

// Instagram 下载器
async function downloadInstagram(url) {
  try {
    const headers = {
      'User-Agent': getRandomUserAgent(),
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0'
    };

    const response = await axios.get(url, { headers });
    const $ = cheerio.load(response.data);

    // 从 meta 标签提取信息
    const title = $('meta[property="og:title"]').attr('content') || 
                  $('meta[name="twitter:title"]').attr('content') || 
                  'Instagram Content';
    
    const author = $('meta[name="twitter:site"]').attr('content') || 
                   $('meta[property="og:site_name"]').attr('content') || 
                   'Instagram User';
    
    const thumbnail = $('meta[property="og:image"]').attr('content') || 
                     $('meta[name="twitter:image"]').attr('content');

    // 尝试提取视频/图片URL
    const videoUrl = $('meta[property="og:video"]').attr('content') ||
                     $('meta[property="og:video:url"]').attr('content') ||
                     $('meta[name="twitter:player:stream"]').attr('content');

    const imageUrl = $('meta[property="og:image"]').attr('content') ||
                     $('meta[property="og:image:secure_url"]').attr('content');

    const medias = [];

    if (videoUrl) {
      medias.push({
        id: `media_${Date.now()}`,
        url: videoUrl,
        type: 'video',
        extension: 'mp4',
        quality: 'hd',
        has_no_audio: false
      });
    }

    if (imageUrl && !videoUrl) {
      medias.push({
        id: `media_${Date.now()}`,
        url: imageUrl,
        type: 'image',
        extension: 'jpg',
        quality: 'original'
      });
    }

    // 从页面脚本提取
    if (medias.length === 0) {
      const scripts = $('script');
      scripts.each((i, script) => {
        const scriptContent = $(script).html();
        if (scriptContent && scriptContent.includes('display_url')) {
          try {
            const jsonMatch = scriptContent.match(/({"config":.*?})/);
            if (jsonMatch) {
              const data = JSON.parse(jsonMatch[1]);
              const shortcodeMedia = data?.entry_data?.PostPage?.[0]?.graphql?.shortcode_media;
              
              if (shortcodeMedia) {
                if (shortcodeMedia.is_video) {
                  medias.push({
                    id: `media_${Date.now()}`,
                    url: shortcodeMedia.video_url,
                    type: 'video',
                    extension: 'mp4',
                    quality: 'hd',
                    width: shortcodeMedia.dimensions?.width,
                    height: shortcodeMedia.dimensions?.height,
                    duration: shortcodeMedia.video_duration,
                    has_no_audio: false
                  });
                } else if (shortcodeMedia.display_url) {
                  medias.push({
                    id: `media_${Date.now()}`,
                    url: shortcodeMedia.display_url,
                    type: 'image',
                    extension: 'jpg',
                    quality: 'original',
                    width: shortcodeMedia.dimensions?.width,
                    height: shortcodeMedia.dimensions?.height
                  });
                }
              }
            }
          } catch (e) {
            console.error('解析脚本失败:', e);
          }
        }
      });
    }

    return {
      success: true,
      url: url,
      source: 'instagram',
      title: title,
      author: author,
      thumbnail: thumbnail,
      duration: medias.find(m => m.type === 'video')?.duration || null,
      medias: {
        images: medias.filter(m => m.type === 'image'),
        videos: medias.filter(m => m.type === 'video')
      }
    };
  } catch (error) {
    throw new Error(`Instagram下载失败: ${error.message}`);
  }
}

// YouTube 下载器
async function downloadYouTube(url) {
  try {
    // 这里可以使用 youtube-dl-exec 或其他 YouTube API
    // 由于 YouTube 限制严格，这里提供简化版本
    
    const headers = {
      'User-Agent': getRandomUserAgent(),
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://www.youtube.com/'
    };

    // 这只是示例，实际实现需要更复杂的处理
    return {
      success: true,
      url: url,
      source: 'youtube',
      title: 'YouTube Video',
      author: 'YouTube Creator',
      thumbnail: 'https://img.youtube.com/vi/default/hqdefault.jpg',
      duration: 0,
      medias: {
        images: [],
        videos: [{
          id: `media_${Date.now()}`,
          url: url,
          type: 'video',
          extension: 'mp4',
          quality: '360p',
          note: '需要实现实际的YouTube下载逻辑'
        }]
      }
    };
  } catch (error) {
    throw new Error(`YouTube下载失败: ${error.message}`);
  }
}

// Twitter/X 下载器
async function downloadTwitter(url) {
  try {
    const headers = {
      'User-Agent': getRandomUserAgent(),
      'Accept': '*/*'
    };

    const response = await axios.get(url, { headers });
    const $ = cheerio.load(response.data);

    const title = $('meta[property="og:title"]').attr('content') || 'Tweet';
    const author = $('meta[name="twitter:site"]').attr('content') || 'Twitter User';
    const thumbnail = $('meta[property="og:image"]').attr('content');

    const videoUrl = $('meta[property="og:video:url"]').attr('content') ||
                    $('meta[property="og:video"]').attr('content');

    const medias = [];

    if (videoUrl) {
      medias.push({
        id: `media_${Date.now()}`,
        url: videoUrl,
        type: 'video',
        extension: 'mp4',
        quality: 'hd'
      });
    }

    return {
      success: true,
      url: url,
      source: 'twitter',
      title: title,
      author: author,
      thumbnail: thumbnail,
      medias: {
        images: medias.filter(m => m.type === 'image'),
        videos: medias.filter(m => m.type === 'video')
      }
    };
  } catch (error) {
    throw new Error(`Twitter下载失败: ${error.message}`);
  }
}

// TikTok 下载器
async function downloadTiktok(url) {
  // 类似实现，但TikTok有更强的反爬机制
  // 需要处理水印等问题
  return {
    success: true,
    url: url,
    source: 'tiktok',
    title: 'TikTok Video',
    author: 'TikTok User',
    medias: {
      images: [],
      videos: []
    }
  };
}

module.exports = {
  instagram: downloadInstagram,
  youtube: downloadYouTube,
  twitter: downloadTwitter,
  tiktok: downloadTiktok,
  facebook: downloadInstagram, // 临时使用相同的实现
  pinterest: downloadInstagram // 临时使用相同的实现
};
