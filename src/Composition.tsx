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
  video_url: string;
  text_overlay?: string;
}

interface Subtitle {
  id: number;
  start: number;
  end: number;
  text: string;
}

interface MyCompositionProps {
  scenes?: Scene[];
  subtitles?: Subtitle[];
  audioSrc?: string;
  bgMusicUrl?: string;
  hook?: string;
  cta?: string;
  title?: string;
}

// 單一場景元件
const SceneClip: React.FC<{
  scene: Scene;
  fps: number;
}> = ({ scene, fps }) => {
  const frame = useCurrentFrame();
  const duration = (scene.end_sec - scene.start_sec) * fps;

  const opacity = interpolate(
    frame,
    [0, 15, duration - 15, duration],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill style={{ opacity }}>
      {scene.video_url ? (
        <Video
          src={scene.video_url}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <AbsoluteFill style={{ backgroundColor: "#1a1a2e" }} />
      )}
      {scene.text_overlay && (
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
              fontFamily: "Noto Sans TC, sans-serif",
            }}
          >
            {scene.text_overlay}
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

// 字幕元件
const SubtitleDisplay: React.FC<{
  subtitles: Subtitle[];
  fps: number;
}> = ({ subtitles, fps }) => {
  const frame = useCurrentFrame();
  const currentSub = subtitles.find(
    (s) => frame >= s.start * fps && frame < s.end * fps
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
          fontFamily: "Noto Sans TC, sans-serif",
          maxWidth: "90%",
          lineHeight: 1.4,
        }}
      >
        {currentSub.text}
      </div>
    </AbsoluteFill>
  );
};

// Hook 文字元件
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
          color:
