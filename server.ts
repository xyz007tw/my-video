import express, { Request, Response } from 'express';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const app = express();
app.use(express.json({ limit: '50mb' }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// ─── 設定區（從環境變數讀取）─────────────────────────────────
const PORT = process.env.PORT || 3000;
const API_SECRET = process.env.API_SECRET_KEY || '';

// Cloudflare R2 設定（S3 相容 API）
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '';
const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY || '';
const R2_SECRET_KEY = process.env.R2_SECRET_KEY || '';
const R2_BUCKET = process.env.R2_BUCKET_NAME || 'videos';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || ''; // 你的 R2 公開網域

// ─── R2 Client（S3 相容）────────────────────────────────────
const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY,
    secretAccessKey: R2_SECRET_KEY,
  },
});

// ─── Bundle 快取（啟動時只 Bundle 一次）─────────────────────
let cachedBundleLocation: string | null = null;

async function getBundle(): Promise<string> {
  if (cachedBundleLocation) return cachedBundleLocation;

  console.log('📦 建立 Webpack Bundle（首次啟動約需 60 秒）...');
  const entryPoint = path.resolve(__dirname, '../src/index.ts');

  cachedBundleLocation = await bundle({
    entryPoint,
    webpackOverride: (config) => ({
      ...config,
      cache: { type: 'filesystem' },
    }),
  });

  console.log(`✅ Bundle 完成: ${cachedBundleLocation}`);
  return cachedBundleLocation;
}

// ─── 渲染佇列（防止同時多個渲染造成 OOM）───────────────────
let renderQueue: Promise<any> = Promise.resolve();

function enqueueRender<T>(fn: () => Promise<T>): Promise<T> {
  const next = renderQueue
    .then(() => fn())
    .catch((err) => { throw err; });
  renderQueue = next.catch(() => {});
  return next;
}

// ─── API Key 驗證 ─────────────────────────────────────────
function authMiddleware(req: Request, res: Response, next: any) {
  if (!API_SECRET) return next();
  const key = req.headers['x-api-key'];
  if (key !== API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ─── 健康檢查 ─────────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    mode: 'local-render',
    bundle_ready: !!cachedBundleLocation,
    r2_configured: !!(R2_ACCOUNT_ID && R2_ACCESS_KEY),
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

  try {
    const result = await enqueueRender(async () => {
      console.log(`🎬 開始渲染: ${compositionName} (${durationInSeconds}s, ${width}x${height})`);

      // 取得 Bundle
      const serveUrl = await getBundle();

      // 輸出檔案路徑（容器內暫存）
      const filename = outputFilename || `video_${Date.now()}.mp4`;
      const outputPath = path.join('/tmp', filename);

      // 選取 Composition
      const composition = await selectComposition({
        serveUrl,
        id: compositionName,
        inputProps: {
          ...inputProps,
          durationInFrames: Math.round(durationInSeconds * fps),
          fps,
          width,
          height,
        },
      });

      // ✅ 本機渲染（不需要 AWS / GCP）
      await renderMedia({
        composition,
        serveUrl,
        codec: 'h264',
        outputLocation: outputPath,
        imageFormat: 'jpeg',
        inputProps: {
          ...inputProps,
          durationInFrames: Math.round(durationInSeconds * fps),
          fps,
          width,
          height,
        },
        // ✅ Linux 多進程模式（大幅提升速度）
        chromiumOptions: {
          enableMultiProcessOnLinux: true,
        },
        onProgress: ({ progress }) => {
          const pct = Math.round(progress * 100);
          if (pct % 20 === 0) console.log(`  渲染進度: ${pct}%`);
        },
      });

      console.log(`✅ 渲染完成，上傳至 R2...`);

      // 上傳至 Cloudflare R2
      const videoBuffer = fs.readFileSync(outputPath);
      const r2Key = `videos/${filename}`;

      await r2.send(new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: r2Key,
        Body: videoBuffer,
        ContentType: 'video/mp4',
      }));

      // 清除暫存檔
      fs.unlinkSync(outputPath);

      const publicUrl = `${R2_PUBLIC_URL}/${r2Key}`;
      console.log(`☁️ 已上傳: ${publicUrl}`);

      return { publicUrl, filename };
    });

    const duration = Date.now() - startTime;
    console.log(`🎉 全程完成 (${Math.round(duration / 1000)}s)`);

    return res.json({
      success: true,
      video_url: result.publicUrl,
      filename: result.filename,
      render_duration_ms: duration,
    });

  } catch (err: any) {
    console.error('❌ 渲染失敗:', err.message);
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// ─── 預先 Bundle（背景執行，不阻塞啟動）──────────────────────
app.listen(PORT, () => {
  console.log(`
🚀 Remotion Render Server 啟動（本機渲染模式）
   Port     : ${PORT}
   Mode     : ✅ 本機渲染（無需 AWS / GCP）
   R2       : ${R2_ACCOUNT_ID ? '✅ 已設定' : '❗ 請設定 R2_ACCOUNT_ID'}
   API Auth : ${API_SECRET ? '✅ 已啟用' : '⚠️  未設定 API_SECRET_KEY'}
   Health   : http://localhost:${PORT}/health
  `);

  // 背景預先 Bundle，加快第一次渲染速度
  getBundle().catch((err) => {
    console.error('⚠️  Bundle 預載失敗（第一次渲染時會重試）:', err.message);
  });
});
