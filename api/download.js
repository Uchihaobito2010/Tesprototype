export default async function handler(req, res) {
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method === 'GET') {
    return res.json({
      status: 'online',
      message: 'Social Media Downloader API',
      timestamp: new Date().toISOString()
    });
  }
  
  if (req.method === 'POST') {
    try {
      const { url } = req.body;
      
      if (!url) {
        return res.status(400).json({
          error: 'URL is required',
          success: false
        });
      }
      
      // 简单的返回示例
      return res.json({
        success: true,
        url: url,
        title: 'Social Media Content',
        author: 'Unknown',
        source: 'instagram',
        medias: {
          images: [],
          videos: [{
            url: url,
            type: 'video',
            quality: 'hd',
            note: 'This is a demo response. Implement actual download logic.'
          }]
        }
      });
    } catch (error) {
      return res.status(500).json({
        error: error.message,
        success: false
      });
    }
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
}
