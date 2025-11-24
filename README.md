# XIV Dye Tools Discord Bot

> Discord bot for XIV Dye Tools - Color harmony, matching, and accessibility tools for Final Fantasy XIV

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3%2B-blue)](https://www.typescriptlang.org/)
[![discord.js](https://img.shields.io/badge/discord.js-v14-5865F2)](https://discord.js.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)](https://nodejs.org/)

## Features

🎨 **Color Harmony Generation** - Create complementary, triadic, analogous, and more color schemes
🎯 **Dye Matching** - Find closest FFXIV dyes to any color (hex or image upload)
♿ **Accessibility** - Colorblindness simulation for protan, deutan, tritan vision types
📊 **Dye Comparison** - Side-by-side comparison of up to 4 dyes with visualizations
🌈 **Color Mixing** - Find intermediate dyes for smooth color gradients
💰 **Live Pricing** - Market board prices via Universalis API

## Privacy

🔒 **Privacy Policy:** See [PRIVACY.md](./docs/PRIVACY.md) for information about data collection, storage, and usage.

**Summary:**
- We collect Discord user IDs and command usage statistics for analytics
- Data is retained for 7-30 days and automatically deleted
- Images uploaded via `/match-image` are processed but **not stored**
- We do not share or sell your data
- Full details in [PRIVACY.md](./docs/PRIVACY.md)

## Commands

- `/harmony` - Generate color harmonies with color wheel visualization
- `/match <color>` - Find closest dye to a hex color
- `/match_image` - Upload an image to extract and match colors
- `/comparison <dye1> <dye2> [dye3] [dye4]` - Compare multiple dyes
- `/mixer <start> <end> [steps]` - Create color gradients
- `/accessibility <dye>` - Simulate colorblindness for a dye

## Tech Stack

- **discord.js v14** - Discord API wrapper with slash command support
- **xivdyetools-core** - Shared color algorithms and dye database
- **node-canvas** - Canvas API for image rendering
- **Sharp** - Fast image processing for uploads
- **Redis** - Caching for API responses and rendered images
- **TypeScript** - Type-safe development

## Quick Start

### Prerequisites

- Node.js 18+
- Redis server (local or Upstash)
- Discord bot token ([Discord Developer Portal](https://discord.com/developers/applications))

### Installation

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your bot token and configuration
nano .env

# Register slash commands
npm run deploy:commands

# Start development server
npm run dev
```

### Environment Variables

See `.env.example` for all configuration options. Required variables:

- `DISCORD_TOKEN` - Your bot token
- `DISCORD_CLIENT_ID` - Your application/client ID
- `REDIS_URL` - Redis connection URL

## Development

### Project Structure

```
src/
├── index.ts              # Bot entry point
├── deploy-commands.ts    # Slash command registration
├── commands/             # Command handlers
│   ├── harmony.ts
│   ├── match.ts
│   ├── match-image.ts
│   ├── comparison.ts
│   ├── mixer.ts
│   └── accessibility.ts
├── renderers/            # Image generation
│   ├── color-wheel.ts
│   ├── gradient.ts
│   ├── swatch-grid.ts
│   └── comparison-chart.ts
├── utils/                # Utilities
│   ├── embed-builder.ts
│   ├── cache-manager.ts
│   ├── rate-limiter.ts
│   └── logger.ts
└── types/                # TypeScript types
    └── index.ts
```

### Commands

```bash
npm run dev          # Start with auto-reload
npm run build        # Compile TypeScript
npm run start        # Start production build
npm test             # Run tests
npm run lint         # Type check
```

## Deployment

### Docker

```bash
docker build -t xivdyetools-bot .
docker run -d --env-file .env xivdyetools-bot
```

### Fly.io

```bash
fly launch
fly deploy
```

See [docs/DEPLOYMENT.md](../../XIVDyeTools/docs/discord-bot/DEPLOYMENT.md) for detailed deployment instructions.

## Performance

- **Response Time**: <500ms (without pricing), <2s (with pricing)
- **Image Rendering**: <200ms per image
- **Memory Usage**: <512 MB
- **Caching**: Redis with 5-minute TTL for API responses

## Rate Limiting

- **Per User**: 10 commands/minute, 100 commands/hour
- **Global**: Respects Discord rate limits

## Privacy

- All image processing is done in-memory (not stored)
- No user data is permanently stored
- Universalis API calls are cached but not linked to users

## Related Projects

- **[xivdyetools-core](https://github.com/FlashGalatine/xivdyetools-core)** - Core color algorithms (npm package)
- **[XIV Dye Tools Web App](https://github.com/FlashGalatine/xivdyetools)** - Interactive web tools

## License

MIT © 2025 Flash Galatine

## Legal Notice

**This is a fan-made tool and is not affiliated with or endorsed by Square Enix Co., Ltd. FINAL FANTASY is a registered trademark of Square Enix Holdings Co., Ltd.**

## Support

- **Issues**: [GitHub Issues](https://github.com/FlashGalatine/xivdyetools-discord-bot/issues)
- **Discord**: [Join Server](https://discord.gg/5VUSKTZCe5)
- **Documentation**: [Planning Docs](../../XIVDyeTools/docs/discord-bot/)

---

**Made with ❤️ for the FFXIV community**
