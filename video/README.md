# Yonder video demo

This is a 12-second portrait promo built with [Remotion](https://github.com/remotion-dev/remotion). It uses sky imagery and user-supplied portraits from the web app's public assets. The clip is silent, uses demo display names, and does not access account services or location data. It is a standalone promo rather than a recording of the current app.

From the repository root:

```sh
npm ci
npm --prefix video ci
npm run video:studio
npm run video:render
```

The render goes to `video-output/yonder-intro.mp4`. Remotion reads images directly from `web/public` through `video/remotion.config.ts`; no assets are duplicated. The video package is intentionally separate so Remotion's Zod 4 does not replace the app's Zod 3.
