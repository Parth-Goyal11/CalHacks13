# Yonder video demo

This is a 12-second portrait promo built with [Remotion](https://github.com/remotion-dev/remotion). It uses the same sky and user-supplied sample portraits as the web app. The clip is silent and contains no real account or location data.

From the repository root:

```sh
npm ci
npm --prefix video ci
npm run video:studio
npm run video:render
```

The render goes to `video-output/yonder-intro.mp4`. Remotion reads images directly from `web/public` through `video/remotion.config.ts`; no assets are duplicated. The video package is intentionally separate so Remotion's Zod 4 does not replace the app's Zod 3.
