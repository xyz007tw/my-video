# 本機渲染模式部署指南（無需 AWS / GCP）

## 架構說明

```
n8n（工作流）
  → POST /render（Zeabur Express Server）
       ↓
  renderMedia()（容器內 Chrome + FFmpeg 直接渲染）
       ↓
  上傳至 Cloudflare R2
       ↓
  回傳公開影片 URL
```

**完全不需要 AWS 或 GCP 帳號！**

---

## 與之前版本的差異

| 項目 | 舊版（Lambda）| 新版（本機渲染）|
|------|------------|-------------|
| 需要 AWS | ✅ 必須 | ❌ 不需要 |
| 需要 GCP | ❌ | ❌ 不需要 |
| 渲染方式 | AWS Lambda 並行 | 容器內單機 |
| 渲染速度 | 快（30秒/片）| 較慢（60-120秒/片）|
| 費用（1000片/月）| ~$18 AWS + $5 Railway | 僅 Zeabur 容器費 |

---

## Zeabur 費用試算（本機渲染）

渲染 1 分鐘影片約需 60-120 秒，使用 2 CPU + 2GB RAM：

### Zeabur 按用量計費

Zeabur 以 vCPU-小時 + Memory GB-小時計費：

| 產量 | 渲染時間/月 | CPU 費用 | Memory 費用 | 月費合計 |
|------|-----------|---------|-----------|--------|
| 100片 | ~3小時 | ~$0.3 | ~$0.15 | **~$0.45** |
| 500片 | ~15小時 | ~$1.5 | ~$0.75 | **~$2.25** |
| 1000片 | ~30小時 | ~$3 | ~$1.5 | **~$4.5** |

加上 Zeabur 最低訂閱費（約 $5/月），1000片/月總計約 **$9.5/月 ≈ 304台幣**。

**每片費用：~0.3台幣**（比 AWS Lambda 方案還便宜！）

---

## 步驟一：更新 GitHub 上的檔案

將以下 3 個新檔案上傳至 `github.com/xyz007tw/my-video`：

1. **`server.ts`**（新版，使用 renderMedia 本機渲染）
2. **`package.json`**（新增 `@aws-sdk/client-s3`）
3. **`Dockerfile`**（與修復版相同，無需更改）

---

## 步驟二：設定 Cloudflare R2 公開存取

1. 進入 Cloudflare Dashboard → R2
2. 選擇你的 bucket（或新建一個叫 `videos`）
3. Settings → **Public Access → Allow Access**
4. 複製公開 URL（格式：`https://pub-xxxx.r2.dev`）

---

## 步驟三：在 Zeabur 設定環境變數

進入 Zeabur → 你的服務 → **Variables**，新增：

```
PORT              = 3000
API_SECRET_KEY    = 自訂密鑰（英數字）
R2_ACCOUNT_ID     = 你的 Cloudflare Account ID
R2_ACCESS_KEY     = R2 API Token 的 Access Key
R2_SECRET_KEY     = R2 API Token 的 Secret Key
R2_BUCKET_NAME    = videos
R2_PUBLIC_URL     = https://pub-xxxx.r2.dev
```

### 如何取得 R2 API Token：
1. Cloudflare Dashboard → R2 → Manage R2 API Tokens
2. Create API Token → **Admin Read & Write**
3. 複製 Access Key ID 和 Secret Access Key

---

## 步驟四：調整 Zeabur 容器規格

本機渲染需要足夠的 CPU 和 Memory：

1. Zeabur → 服務 → **Settings → Resources**
2. 建議設定：**CPU: 2 vCPU，Memory: 2 GB**
3. 確認後儲存，服務自動重啟

---

## 步驟五：測試渲染

```bash
# 健康檢查
curl https://你的zeabur網址/health

# 測試渲染（簡單測試）
curl -X POST https://你的zeabur網址/render \
  -H "Content-Type: application/json" \
  -H "X-API-Key: 你設定的密鑰" \
  -d '{
    "compositionName": "VideoComposition",
    "durationInSeconds": 10,
    "inputProps": {
      "title": "測試影片"
    }
  }'
```

成功回應：
```json
{
  "success": true,
  "video_url": "https://pub-xxxx.r2.dev/videos/video_1234567890.mp4",
  "render_duration_ms": 45000
}
```

---

## 步驟六：更新 n8n 工作流

在 n8n 的 **⑲ Remotion Lambda 渲染** 節點：

URL 改為：
```
https://你的zeabur網址/render
```

Headers 加入：
```
X-API-Key: 你設定的密鑰
```

回傳的 `video_url` 直接就是 R2 的公開 URL，可跳過之前的 ㉑ 上傳 R2 步驟（已在 server 內處理）。

---

## 注意事項

1. **第一次渲染較慢**：啟動後會預先 Bundle Remotion 專案（約 60 秒），之後會快很多
2. **渲染是排隊執行的**：同時只渲染一支影片，避免 OOM（記憶體不足）
3. **/tmp 空間**：Zeabur 容器的 /tmp 空間有限，渲染完成後會立即上傳 R2 並刪除暫存
4. **Cloudflare R2 免費額度**：每月 10GB 儲存 + 1,000 萬次讀取免費，基本上不會超過
