FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y \
  libnss3 libdbus-1-3 libatk1.0-0 libgbm-dev \
  libasound2 libxrandr2 libxkbcommon-dev \
  libxfixes3 libxcomposite1 libxdamage1 \
  libatk-bridge2.0-0 libpango-1.0-0 libcairo2 libcups2 \
  fonts-noto-cjk fonts-noto-color-emoji ffmpeg \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package*.json tsconfig.json* remotion.config.* ./

RUN npm install

RUN npx remotion browser ensure

COPY src ./src
COPY server.ts ./server.ts

RUN npm run build

EXPOSE 3000

CMD ["node", "dist/server.js"]
