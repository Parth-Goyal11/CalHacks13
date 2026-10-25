import {
  AbsoluteFill,
  Easing,
  Img,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";

const ivory = "#f4f0e9";
const champagne = "#dfcba6";
const sans = "Arial, Helvetica, sans-serif";

const fade = (frame: number, appear: number, disappear: number, end: number) =>
  interpolate(frame, [0, appear, disappear, end], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

const Sky = () => {
  const frame = useCurrentFrame();
  const zoom = interpolate(frame, [0, 360], [1.04, 1.18], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  return (
    <AbsoluteFill style={{ background: "#080b16" }}>
      <Img
        src={staticFile("yonder/photo-1.jpg")}
        style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${zoom})` }}
      />
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(5,7,17,.72), rgba(5,7,17,.48) 46%, rgba(5,7,17,.9))",
        }}
      />
    </AbsoluteFill>
  );
};

const Opening = () => {
  const frame = useCurrentFrame();
  const opacity = fade(frame, 18, 82, 110);
  const lift = interpolate(frame, [0, 90], [48, 0], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: 90,
        color: ivory,
        textAlign: "center",
        fontFamily: sans,
        opacity,
        transform: `translateY(${lift}px)`,
      }}
    >
      <div style={{ fontSize: 148, fontWeight: 650, letterSpacing: -9 }}>Yonder</div>
      <div style={{ width: 100, height: 3, margin: "38px 0 48px", background: champagne }} />
      <div style={{ maxWidth: 850, fontSize: 72, lineHeight: 1.15, fontWeight: 500 }}>
        A little of tonight, kept forever.
      </div>
    </AbsoluteFill>
  );
};

const people = [
  { src: "noah-demo.jpg", label: "Noah" },
  { src: "sofia-demo.jpg", label: "Sofia" },
  { src: "eli-demo.jpg", label: "Eli" },
  { src: "friends-duo.jpg", label: "Mina & Kai" },
];

const People = () => {
  const frame = useCurrentFrame();
  const opacity = fade(frame, 22, 132, 165);
  return (
    <AbsoluteFill
      style={{
        padding: "210px 68px 160px",
        color: ivory,
        fontFamily: sans,
        opacity,
      }}
    >
      <div style={{ fontSize: 75, fontWeight: 600, lineHeight: 1.08, letterSpacing: -2 }}>
        See the sky together.
      </div>
      <div style={{ color: champagne, fontSize: 30, marginTop: 24 }}>Sample skies from the Yonder feed</div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 24,
          marginTop: 90,
        }}
      >
        {people.map((person, index) => {
          const entrance = interpolate(frame, [index * 9, index * 9 + 27], [70, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.out(Easing.cubic),
          });
          return (
            <div
              key={person.src}
              style={{
                height: 535,
                position: "relative",
                overflow: "hidden",
                borderRadius: 26,
                border: "1px solid rgba(223,203,166,.3)",
                transform: `translateY(${entrance}px)`,
              }}
            >
              <Img
                src={staticFile(`yonder/people/${person.src}`)}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "linear-gradient(transparent 60%, rgba(5,7,17,.8))",
                }}
              />
              <div style={{ position: "absolute", bottom: 28, left: 28, fontSize: 34, fontWeight: 600 }}>
                {person.label}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const Ending = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 25], [0, 1], {
    extrapolateRight: "clamp",
  });
  const scale = interpolate(frame, [0, 90], [0.94, 1], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: 85,
        background: "rgba(5,7,17,.58)",
        color: ivory,
        fontFamily: sans,
        textAlign: "center",
        opacity,
        transform: `scale(${scale})`,
      }}
    >
      <div style={{ fontSize: 150, fontWeight: 650, letterSpacing: -9 }}>Yonder</div>
      <div style={{ marginTop: 42, fontSize: 70, fontWeight: 500, lineHeight: 1.14 }}>
        Capture your sky.
      </div>
      <div style={{ marginTop: 75, width: 300, height: 3, background: champagne }} />
    </AbsoluteFill>
  );
};

export const YonderIntro = () => (
  <AbsoluteFill>
    <Sky />
    <Sequence from={0} durationInFrames={115}>
      <Opening />
    </Sequence>
    <Sequence from={95} durationInFrames={170}>
      <People />
    </Sequence>
    <Sequence from={245} durationInFrames={115}>
      <Ending />
    </Sequence>
  </AbsoluteFill>
);
