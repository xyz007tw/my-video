FROM node:22-bookworm-slim

# 安裝 Chrome 所需的依賴套件
RUN apt-get update
RUN apt install -y \
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
  libcups2

COPY package.json package*.json yarn.lock* pnpm-lock.yaml* tsconfig.json* remotion.config.* ./
COPY src ./src
COPY public ./public

RUN npm i

# 安裝 Chrome
RUN npx remotion browser ensure

CMD ["npx", "remotion", "studio"]