import express from 'express';
import { renderMedia, selectComposition } from '@remotion/renderer';
import path from 'path';

const app = express();
app.use(express.json());

app.post('/render', async (req, res) => {
  const { inputProps, compositionId } = req.body;
  const bundleLocation = path.resolve('./build/index.js'); 

  try {
    const composition = await selectComposition({
      bundleLocation,
      id: compositionId || "Main", 
      inputProps,
    });

    const outputLocation = `out/${Date.now()}.mp4`;
    console.log('正在為您渲染 1 分鐘 AI 影片...');

    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      outputLocation,
      inputProps,
      codec: 'h264',
    });

    res.json({ success: true, url: outputLocation });
  } catch (err) {
    console.error('渲染失敗:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Remotion 渲染伺服器已啟動，正在 BDAI-1 待命：端口 ${PORT}`);
});
