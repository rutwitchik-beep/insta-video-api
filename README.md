# Instagram Video Downloader API

Бесплатный API для скачивания Instagram Reels. Деплоится на Vercel за 1 клик.

## Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/insta-video-api)

## API Usage

```
GET /api/video?url=https://www.instagram.com/reel/SHORTCODE/
```

Response:
```json
{
  "success": true,
  "videoUrl": "https://scontent.cdninstagram.com/...",
  "filename": "reel_SHORTCODE.mp4",
  "method": "embed"
}
```

## Methods (fallback chain)
1. Instagram embed page scraping
2. GraphQL API
3. Instagram Mobile API
