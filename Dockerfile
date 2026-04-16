# ✅ Remotion 官方建議：使用 node:22-bookworm-slim（Debian）
# ❌ 不要用 Alpine Linux（會導致 Rust 元件慢 10 秒以上且 Chrome 版本不穩定）
FROM node:22-bookworm-slim

# ── 1. 安裝 Chrome Headless Shell 必要的 shared libraries ──────────────
# 缺少這些 → "Failed to launch Chrome" / libnss3.so not found 錯誤
RUN apt-get update && apt-get install -y \
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
  # CJK 字型（中文/日文/韓文）
  fonts-noto-cjk \
  # Emoji 字型
  fonts-noto-color-emoji \
  # FFmpeg（影片處理）
  ffmpeg \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── 2. 先複製 package.json 安裝依賴（利用 Docker cache layer）──────────
COPY package.json package*.json yarn.lock* pnpm-lock.yaml* tsconfig.json* remotion.config.* ./

RUN npm install

# ── 3. 安裝正確版本的 Chrome Headless Shell ────────────────────────────
# 必須在 npm install 之後執行，確保 @remotion/renderer 已安裝
RUN npx remotion browser ensure

# ── 4. 複製應用程式碼 ──────────────────────────────────────────────────
COPY src ./src
# public 資料夾（若有素材放這裡）
COPY public ./public 2>/dev/null || true
COPY server.ts ./server.ts

# ── 5. 編譯 TypeScript ────────────────────────────────────────────────
RUN npm run build

# ── 6. 開放 Port ──────────────────────────────────────────────────────
EXPOSE 3000

# ── 7. 啟動 Express Server ────────────────────────────────────────────
CMD ["node", "dist/server.js"]
