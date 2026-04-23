import React from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  Video,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  spring,
} from "remotion";

interface Scene {
  id: number;
  start_sec: number;
  end_sec: number;
  description: string;
  videoUrl: string;        // 修正：改成 camelCase
  text_overlay?: string;
}

interface Subtitle {
  id: number;
  start: number;
  end: number;
  text: string;
}

interface MyCompositionProps {
  scenes?: Scene[] | string;
  subtitles?: Subtitle[] | string;
  audioSrc?: string;
  bgMusicUrl?: string;
  hook?: string;
  cta?: string;
  title?: string;
}

const SceneClip: React.FC<{ scene: Scene; fps: number }> = ({ scene, fps }) => {
  const frame = useCurrentFrame();
  const duration = ((scene.end_sec || 5) - (scene.start_sec || 0)) * fps;
  const safeDuration = Math.max(duration, fps);
  const opacity = interpolate(
    frame,
    [0, 10, safeDuration - 10, safeDuration],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  return (
    <AbsoluteFill style={{ opacity }}>
      {scene.videoUrl ? (
        <Video
          src={scene.videoUrl}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <AbsoluteFill style={{ backgroundColor: "#1a1a2e" }} />
      )}
      {scene.text_overlay ? (
        <AbsoluteFill
          style={{
            justifyContent: "center",
            alignItems: "center",
            padding: 40,
          }}
        >
          <div
            style={{
              color: "white",
              fontSize: 48,
              fontWeight: "bold",
              textAlign: "center",
              textShadow: "2px 2px 8px rgba(0,0,0,0.8)",
            }}
          >
            {scene.text_overlay}
          </div>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};

const SubtitleDisplay: React.FC<{
  subtitles: Subtitle[];
  fps: number;
}> = ({ subtitles, fps }) => {
  const frame = useCurrentFrame();
  const currentSub = subtitles.find(
    (s) => frame >= (s.start || 0) * fps && frame < (s.end || 0) * fps
  );
  if (!currentSub) return null;
  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: 120,
        paddingLeft: 40,
        paddingRight: 40,
      }}
    >
      <div
        style={{
          backgroundColor: "rgba(0,0,0,0.75)",
          color: "white",
          fontSize: 42,
          padding: "12px 24px",
          borderRadius: 8,
          textAlign: "center",
          maxWidth: "90%",
          lineHeight: 1.4,
        }}
      >
        {currentSub.text}
      </div>
    </AbsoluteFill>
  );
};

const HookText: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const translateY = spring({
    frame,
    fps,
    from: 100,
    to: 0,
    config: { damping: 12, stiffness: 100 },
  });
  const opacity = interpolate(frame, [0, 15, 75, 90], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: 60,
      }}
    >
      <div
        style={{
          transform: `translateY(${translateY}px)`,
          opacity,
          color: "white",
          fontSize: 56,
          fontWeight: "900",
          textAlign: "center",
          textShadow: "3px 3px 12px rgba(0,0,0,0.9)",
          lineHeight: 1.3,
          background: "rgba(0,0,0,0.4)",
          padding: "20px 30px",
          borderRadius: 16,
          border: "2px solid rgba(255,255,255,0.3)",
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

const CTADisplay: React.FC<{ text: string; totalFrames: number }> = ({
  text,
  totalFrames,
}) => {
  const frame = useCurrentFrame();
  const safeTotal = Math.max(totalFrames, 1);
  const opacity = interpolate(
    frame,
    [0, Math.min(30, safeTotal - 1), safeTotal],
    [0, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: 200,
        opacity,
      }}
    >
      <div
        style={{
          backgroundColor: "#FF4444",
          color: "white",
          fontSize: 44,
          fontWeight: "bold",
          padding: "16px 40px",
          borderRadius: 50,
          textAlign: "center",
          boxShadow: "0 4px 20px rgba(255,68,68,0.5)",
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

export const MyComposition: React.FC<MyCompositionProps> = ({
  scenes = [],
  subtitles = [],
  audioSrc = "",
  bgMusicUrl = "",
  hook = "",
  cta = "",
}) => {
  const { fps, durationInFrames } = useVideoConfig();

  const parsedScenes: Scene[] =
    typeof scenes === "string"
      ? (() => { try { return JSON.parse(scenes); } catch { return []; } })()
      : (scenes as Scene[]);

  const parsedSubtitles: Subtitle[] =
    typeof subtitles === "string"
      ? (() => { try { return JSON.parse(subtitles); } catch { return []; } })()
      : (subtitles as Subtitle[]);

  const ctaFrames = Math.round(3 * fps);
  const ctaFrom = Math.max(0, durationInFrames - ctaFrames);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {bgMusicUrl ? <Audio src={bgMusicUrl} volume={0.15} /> : null}
      {audioSrc ? <Audio src={audioSrc} volume={1} /> : null}

      {parsedScenes.map((scene, index) => {
        const startSec = typeof scene.start_sec === "number" ? scene.start_sec : index * 5;
        const endSec = typeof scene.end_sec === "number" ? scene.end_sec : startSec + 5;
        const startFrame = Math.round(startSec * fps);
        const duration = Math.max(Math.round((endSec - startSec) * fps), fps);
        if (!isFinite(startFrame) || !isFinite(duration)) return null;
        return (
          <Sequence
            key={scene.id || index}
            from={startFrame}
            durationInFrames={duration}
          >
            <SceneClip scene={scene} fps={fps} />
          </Sequence>
        );
      })}

      {hook ? (
        <Sequence from={0} durationInFrames={Math.round(3 * fps)}>
          <HookText text={hook} />
        </Sequence>
      ) : null}

      {parsedSubtitles.length > 0 ? (
        <SubtitleDisplay subtitles={parsedSubtitles} fps={fps} />
      ) : null}

      {cta && ctaFrom < durationInFrames ? (
        <Sequence from={ctaFrom} durationInFrames={ctaFrames}>
          <CTADisplay text={cta} totalFrames={ctaFrames} />
        </Sequence>
      ) : null}
    </AbsoluteFill>
  );
};
