import express, { Request, Response } from 'express';
import { bundle } from '@remotion/bundler';
import { renderMediaOnLambda, getRenderProgress } from '@remotion/lambda/client';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const app = express();
app.use(express.json({ limit: '50mb' }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── 設定區 ───────────────────────────────────────────────
const AWS_REGION = process.env.AWS_REGION || 'ap-northeast-1';
const FUNCTION_NAME = process.env.REMOTION_FUNCTION_NAME || '';
const SERVE_URL = process.env.REMOTION_SERVE_URL || '';
const PORT = process.env.PORT || 3000;
const API_SECRET = process.env.API_SECRET_KEY || '';

// ─── Bundle 快取 ──────────────────────────────────────────
let cachedServeUrl: string = SERVE_URL;
let isBundling = false;

// ─── 渲染佇列（防止同時多個 Chromium 造成 OOM）─────────────
let renderQueue: Promise<any> = Promise.resolve();

function enqueueRender<T>(fn: () => Promise<T>): Promise<T> {
  const next = renderQueue.then(() => fn()).catch((err) => {
    console.error('渲染佇列錯誤:', err);
    throw err;
  });
  renderQueue = next.catch(() => {});
  return next;
}

// ─── API Key 驗證 middleware ──────────────────────────────
function authMiddleware(req: Request, res: Response, next: any) {
  if (!API_SECRET) return next(); // 未設定時跳過驗證
  const key = req.headers['x-api-key'];
  if (key !== API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ─── 健康檢查（不需驗證）────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    region: AWS_REGION,
    function_name: FUNCTION_NAME || '❗ 未設定',
    serve_url: cachedServeUrl ? '✅ 已設定' : '❗ 未設定',
    timestamp: new Date().toISOString(),
  });
});

// ─── 主渲染端點 ───────────────────────────────────────────
app.post('/render', authMiddleware, async (req: Request, res: Response) => {
  const startTime = Date.now();

  const {
    compositionName = 'VideoComposition',
    inputProps = {},
    durationInSeconds = 60,
    fps = 30,
    width = 1080,
    height = 1920,
    outputFilename,
  } = req.body;

  if (!FUNCTION_NAME) {
    return res.status(500).json({
      success: false,
      error: 'REMOTION_FUNCTION_NAME 環境變數未設定',
    });
  }

  if (!cachedServeUrl) {
    return res.status(500).json({
      success: false,
      error: 'REMOTION_SERVE_URL 環境變數未設定，請先執行 npm run deploy:site',
    });
  }

  try {
    // 加入佇列，確保不同時渲染多個（節省記憶體）
    const result = await enqueueRender(async () => {
      console.log(`🎬 開始渲染: ${compositionName} (${durationInSeconds}s)`);

      const { renderId, bucketName } = await renderMediaOnLambda({
        region: AWS_REGION as any,
        functionName: FUNCTION_NAME,
        serveUrl: cachedServeUrl,
        composition: compositionName,
        inputProps: {
          ...inputProps,
          durationInFrames: Math.round(durationInSeconds * fps),
          fps,
          width,
          height,
        },
        codec: 'h264',
        imageFormat: 'jpeg',
        maxRetries: 3,
        privacy: 'public',
        outName: outputFilename || `video_${Date.now()}.mp4`,
        // ✅ 關鍵設定：Linux 多進程模式（大幅提升渲染速度）
        chromiumOptions: {
          enableMultiProcessOnLinux: true,
        },
      });

      console.log(`⏳ Lambda 渲染已提交: ${renderId}`);

      // 輪詢等待完成
      const rendered = await pollUntilDone(renderId, bucketName);
      return { ...rendered, renderId, bucketName };
    });

    const duration = Date.now() - startTime;
    console.log(`✅ 渲染完成 (${duration}ms): ${result.outputFile}`);

    return res.json({
      success: true,
      s3Url: result.outputFile,
      renderId: result.renderId,
      bucketName: result.bucketName,
      renderDuration: duration,
    });

  } catch (err: any) {
    console.error('❌ 渲染失敗:', err.message);
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// ─── 輪詢渲染進度 ─────────────────────────────────────────
async function pollUntilDone(
  renderId: string,
  bucketName: string,
  timeoutMs = 300_000
) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const progress = await getRenderProgress({
      renderId,
      bucketName,
      functionName: FUNCTION_NAME,
      region: AWS_REGION as any,
    });

    if (progress.done) {
      return { outputFile: progress.outputFile || '', costs: progress.costs };
    }

    if (progress.fatalErrorEncountered) {
      const errMsg = progress.errors?.map((e: any) => e.message).join('; ') || '未知錯誤';
      throw new Error(`Lambda 渲染失敗: ${errMsg}`);
    }

    const pct = Math.round((progress.overallProgress || 0) * 100);
    console.log(`  進度 ${pct}%`);
    await sleep(3_000);
  }

  throw new Error(`渲染逾時（超過 ${timeoutMs / 1000} 秒）`);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── 啟動 ─────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
🚀 Remotion Render Server 啟動
   Port        : ${PORT}
   AWS Region  : ${AWS_REGION}
   Function    : ${FUNCTION_NAME || '❗ 請設定 REMOTION_FUNCTION_NAME'}
   Serve URL   : ${cachedServeUrl ? '✅ 已設定' : '❗ 請設定 REMOTION_SERVE_URL'}
   API Auth    : ${API_SECRET ? '✅ 已啟用' : '⚠️  未啟用（建議設定 API_SECRET_KEY）'}
   Health      : http://localhost:${PORT}/health
  `);
});
