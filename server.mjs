import express from 'express';
import { renderMedia, selectComposition } from '@remotion/renderer';
import path from 'path';

const app = express();
app.use(express.json());

app.post('/render', async (req, res) => {
  const { inputProps, compositionId } = req.body;
  // 指向 Remotion 打包後的進入點
  const bundleLocation = path.resolve('./build/index.js'); 

  try {
    const composition = await selectComposition({
      bundleLocation,
      id: compositionId || "Main", // 這裡填入您 Remotion 組件的 ID
      inputProps,
    });

    const outputLocation = `out/${Date.now()}.mp4`;
    console.log('正在渲染視頻...');

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
  console.log(`✅ Remotion 渲染伺服器已啟動：端口 ${PORT}`);
});