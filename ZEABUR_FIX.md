# Zeabur 部署修復指南

## 之前失敗的原因

| 問題 | 說明 |
|------|------|
| ❌ 缺少 shared libraries | Chrome Headless 在 Linux slim 映像中找不到 libnss3 等依賴 |
| ❌ 未安裝 Chrome Headless Shell | 沒有執行 `npx remotion browser ensure` |
| ❌ 使用錯誤的基底映像 | Alpine 或過舊的 Node 版本 |
| ❌ 未啟用 Linux 多進程模式 | `enableMultiProcessOnLinux` 未設定 |

---

## 修復版 Dockerfile 關鍵改動

```dockerfile
# ✅ 正確基底映像（Debian bookworm，非 Alpine）
FROM node:22-bookworm-slim

# ✅ 安裝 Chrome 需要的 shared libraries
RUN apt-get update && apt-get install -y \
  libnss3 libdbus-1-3 libatk1.0-0 libgbm-dev \
  libasound2 libxrandr2 libxkbcommon-dev \
  libxfixes3 libxcomposite1 libxdamage1 \
  libatk-bridge2.0-0 libpango-1.0-0 libcairo2 libcups2 \
  fonts-noto-cjk fonts-noto-color-emoji ffmpeg

# ✅ 安裝 Chrome Headless Shell（Remotion 自管版本）
RUN npx remotion browser ensure
```

---

## Zeabur 部署步驟

### Step 1：上傳程式碼到 GitHub
```bash
git init
git add .
git commit -m "fix: correct Remotion Docker setup"
git push origin main
```

### Step 2：在 Zeabur 建立新服務
1. 進入 Zeabur Dashboard
2. 你的專案（與 n8n 同一個）→ Add Service
3. 選擇 **Deploy from GitHub**
4. 選擇 `remotion-server` repo
5. Zeabur 自動偵測 Dockerfile 並建置

### Step 3：設定環境變數
在 Zeabur 服務 → **Variables** 頁面新增：

```
REMOTION_AWS_ACCESS_KEY_ID     = 你的_AWS_ACCESS_KEY
REMOTION_AWS_SECRET_ACCESS_KEY = 你的_AWS_SECRET_KEY
AWS_REGION                     = ap-northeast-1
REMOTION_FUNCTION_NAME         = remotion-render-4-0-0-mem2048mb-disk2048mb-180sec
REMOTION_SERVE_URL             = https://s3.ap-northeast-1.amazonaws.com/remotionlambda-xxx/...
PORT                           = 3000
API_SECRET_KEY                 = 你自訂的密鑰（n8n 呼叫時帶入）
```

### Step 4：確認部署成功
```bash
# 取得 Zeabur 分配的 URL，例如：
# https://remotion-server.zeabur.app

curl https://remotion-server.zeabur.app/health
# 應回傳：{"status":"ok","function_name":"remotion-render-xxx",...}
```

### Step 5：更新 n8n 工作流
將 ⑲ Remotion Lambda 渲染節點的 URL 改為：
```
https://remotion-server.zeabur.app/render
```

並在 Headers 加入：
```
X-API-Key: 你設定的 API_SECRET_KEY
```

---

## Zeabur 費用（此服務）

Zeabur 採用資源使用量計費。這個 Express Server 本身非常輕量：
- 只是接收 n8n 的請求、呼叫 AWS Lambda API
- **閒置時幾乎不消耗 CPU/Memory**
- 估計月費 **< $2 USD**（遠低於 Railway $5/月）

實際渲染工作由 AWS Lambda 執行，不佔用 Zeabur 資源。

---

## 常見錯誤排查

### 錯誤：`libnss3.so: cannot open shared object file`
→ Dockerfile 缺少 `RUN apt-get install -y libnss3 ...`
→ 使用修復版 Dockerfile

### 錯誤：`Chrome Headless Shell not found`
→ Dockerfile 缺少 `RUN npx remotion browser ensure`
→ 必須在 `npm install` 之後執行

### 錯誤：`REMOTION_FUNCTION_NAME not set`
→ Zeabur Variables 未設定環境變數
→ 先本機執行 `npm run deploy:lambda` 取得 function name

### 錯誤：`Container OOM killed` / 記憶體不足
→ Zeabur 調整 Memory 配置至 512MB 以上
→ server.ts 已加入渲染佇列，防止同時多個渲染

### 建置時間過長（> 10 分鐘）
→ `RUN npx remotion browser ensure` 需要下載 Chrome（約 120MB）
→ 第一次建置較慢，之後 Docker cache 會加速
