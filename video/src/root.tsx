import { Composition } from "remotion";
import { YonderIntro } from "./yonder-intro";

export const RemotionRoot = () => (
  <Composition
    id="YonderIntro"
    component={YonderIntro}
    durationInFrames={360}
    fps={30}
    width={1080}
    height={1920}
  />
);
