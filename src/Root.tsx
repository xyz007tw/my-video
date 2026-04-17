import React from "react";
import { Composition } from "remotion";
import { MyComposition } from "./Composition";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="MyComp"
        component={MyComposition}
        durationInFrames={1800}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          scenes: [],
          subtitles: [],
          audioSrc: "",
          bgMusicUrl: "",
          hook: "你準備好了嗎？",
          cta: "立即訂閱！",
          title: "測試影片",
        }}
      />
    </>
  );
};
