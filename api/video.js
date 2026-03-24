// Instagram Video Downloader API
// Vercel Serverless Function
// GET /api/video?url=https://www.instagram.com/reel/...
// Returns: { success: true, videoUrl: "...", filename: "..." }

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ success: false, error: 'Missing url parameter' });
  }

  if (!url.includes('instagram.com')) {
    return res.status(400).json({ success: false, error: 'Not an Instagram URL' });
  }

  // Extract shortcode
  const match = url.match(/\/(reel|p|tv)\/([A-Za-z0-9_-]+)/);
  if (!match) {
    return res.status(400).json({ success: false, error: 'Cannot extract shortcode from URL' });
  }
  const shortcode = match[2];

  const headers = {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Referer': 'https://www.instagram.com/',
    'Origin': 'https://www.instagram.com',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Cache-Control': 'no-cache',
  };

  // Method 1: Instagram embed page
  try {
    const embedUrl = `https://www.instagram.com/reel/${shortcode}/embed/captioned/`;
    const resp = await fetch(embedUrl, { headers });
    if (resp.ok) {
      const html = await resp.text();

      // Try multiple patterns to find video URL
      const patterns = [
        /"video_url"\s*:\s*"([^"]+)"/,
        /videoUrl\s*=\s*"([^"]+)"/,
        /"contentUrl"\s*:\s*"([^"]+\.mp4[^"]*)"/,
        /src="(https:\/\/[^"]+\.mp4[^"]*)"/,
        /"src"\s*:\s*"(https:\/\/[^"]+scontent[^"]+\.mp4[^"]*)"/,
      ];

      for (const pattern of patterns) {
        const m = html.match(pattern);
        if (m) {
          const videoUrl = m[1]
            .replace(/\\u0026/g, '&')
            .replace(/\\\//g, '/')
            .replace(/\\u003D/g, '=');

          if (videoUrl.startsWith('http')) {
            return res.json({
              success: true,
              videoUrl,
              filename: `reel_${shortcode}.mp4`,
              method: 'embed',
            });
          }
        }
      }

      // Try JSON-LD
      const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
      if (jsonLdMatch) {
        try {
          const jsonData = JSON.parse(jsonLdMatch[1]);
          const contentUrl = jsonData.contentUrl || (jsonData.video && jsonData.video.contentUrl);
          if (contentUrl) {
            return res.json({
              success: true,
              videoUrl: contentUrl,
              filename: `reel_${shortcode}.mp4`,
              method: 'jsonld',
            });
          }
        } catch {}
      }
    }
  } catch (e) {
    console.error('Embed method failed:', e.message);
  }

  // Method 2: Instagram oEmbed + GraphQL
  try {
    const gqlUrl = `https://www.instagram.com/graphql/query/?query_hash=b3055c01b4b222b8a47dc12b090e4e64&variables=${encodeURIComponent(JSON.stringify({ shortcode }))}`;
    const gqlResp = await fetch(gqlUrl, {
      headers: {
        ...headers,
        'X-IG-App-ID': '936619743392459',
        'X-Requested-With': 'XMLHttpRequest',
      }
    });
    if (gqlResp.ok) {
      const data = await gqlResp.json();
      const media = data?.data?.shortcode_media;
      if (media) {
        const videoUrl = media.video_url;
        if (videoUrl) {
          return res.json({
            success: true,
            videoUrl,
            filename: `reel_${shortcode}.mp4`,
            method: 'graphql',
          });
        }
      }
    }
  } catch (e) {
    console.error('GraphQL method failed:', e.message);
  }

  // Method 3: Instagram mobile API
  try {
    const mobileUrl = `https://i.instagram.com/api/v1/media/${shortcodeToId(shortcode)}/info/`;
    const mResp = await fetch(mobileUrl, {
      headers: {
        'User-Agent': 'Instagram 275.0.0.27.98 Android (33/13; 420dpi; 1080x2400; Google; Pixel 7; panther; google; en_US; 458229258)',
        'X-IG-App-ID': '567067343352427',
      }
    });
    if (mResp.ok) {
      const data = await mResp.json();
      const items = data?.items?.[0];
      if (items) {
        const videoVersions = items.video_versions || [];
        if (videoVersions.length > 0) {
          const best = videoVersions.sort((a, b) => (b.width || 0) - (a.width || 0))[0];
          return res.json({
            success: true,
            videoUrl: best.url,
            filename: `reel_${shortcode}.mp4`,
            method: 'mobile_api',
          });
        }
      }
    }
  } catch (e) {
    console.error('Mobile API failed:', e.message);
  }

  return res.status(404).json({
    success: false,
    error: 'Could not extract video URL. The reel may be private or Instagram changed their API.',
  });
}

// Convert shortcode to Instagram media ID
function shortcodeToId(shortcode) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let id = BigInt(0);
  for (const char of shortcode) {
    id = id * BigInt(64) + BigInt(alphabet.indexOf(char));
  }
  return id.toString();
}
