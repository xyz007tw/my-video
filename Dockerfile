FROM node:22-bookworm

# 1. 安裝 Chrome 所需的依賴套件，並加上關鍵的 chromium 與 ffmpeg
RUN apt-get update && apt-get install -y \
    chromium \
    ffmpeg \
    fonts-noto-cjk \
    libnss3 \
    libdbus-1-3 \
    libatk1.0-0 \
    libgbm-dev \
    libasound2 \
    libxrandr2 \
    libxkbcommon-dev \
    libxfixes3 \
    libxcomposite1 \
    libxdamage1 \
    libatk-bridge2.0-0 \
    libpango-1.0-0 \
    libcairo2 \
    libcups2 \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# 2. 設定環境變數讓 Remotion 找到 Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV CHROME_PATH=/usr/bin/chromium

# 複製設定檔案
COPY package.json package*.json ./
COPY tsconfig.json* remotion.config.* ./
COPY src ./src
COPY public ./public
# 也要記得複製您的 server.mjs
COPY server.mjs ./

# 安裝依賴
RUN npm install

# 執行 Remotion 打包 (確保 server.mjs 讀得到 build/index.js)
RUN npm run build

# 啟動 Express 伺服器
CMD ["node", "server.mjs"]
