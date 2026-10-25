# Yonder: UI and photo-analysis handoff

The current Yonder Figma Make design replaces the former Your Sky UI on `feat/ui`. The app remains a phone-first Next.js web app. This change does not create a native iOS binary or a shared social backend.

Design source: https://www.figma.com/make/lK1XPXSmzeAS9AsI4RDzyu/Design-Your-Sky-Astronomy-App

## What is connected

- Home, Explore, camera, Memories and Profile use the imported Figma visual language, celestial icons and original photographs.
- The center camera button opens a real camera dialog, with shutter, rear/front selection when available, gallery picker, native phone-camera fallback, permission errors and cleanup when hidden or closed.
- A captured or selected photo opens an uncropped review. Analyze sky sends its original file as multipart `image` to the existing Next.js proxy and FastAPI pipeline.
- The minimal loading screen stays visible for the real request. Cancel returns to review and retains the photo. There are no simulated percentages or artificial processing delays.
- Results distinguish plate-solved identities, model estimates and incomplete reviews. Solver diagnostics are filtered out of object names. Zero named objects and non-sky photos have separate states.
- The API now includes optional `annotations` with solver-verified normalized coordinates. Rings use the rendered image's contained bounds, including its letterboxing. Model estimates never receive invented positions. The existing annotated JPEG remains available.
- Memories store the photo Blob and analysis in IndexedDB on the current device and origin. Saving, reopening, removing and reloading are connected. Profile fields and notes can be edited locally; profile counts and streaks derive from real saved photos.
- Location selection and approximate device location connect to the existing city search and Open-Meteo endpoints. Weather refreshes every five minutes. Berkeley is the initial default.
- `/loading` is a standalone visual preview; `app/loading.tsx` also supplies the route-loading fallback.

Friends/Nearby posts remain explicitly labeled samples. Explore offers current weather and photographic inspiration; its photographs are not a live visibility prediction. The Figma Make file remains a demo prototype; the repo contains the actual API integration.

## What you need to do for live image identification

1. Create `.env` in the repository root from `.env.example` if it does not exist. Keep your keys there, never in frontend code or `NEXT_PUBLIC_*` variables.
2. Set `ASTROMETRY_API_KEY` for plate solving and verified star positions. Set `VISION_API_KEY` or `XAI_API_KEY` for Grok vision. Keep `VISION_PROVIDER=grok`. Set `VISION_MODEL` to a vision-capable model currently enabled for your xAI account; the repository's older default is not a verified live-model choice.
3. Restart the Python service after editing `.env`. The `npm run sky-photo` command now loads `.env` using python-dotenv. It requires the Python environment to be active; the direct command below does not.
4. Test an actual night-sky JPEG on a physical iPhone over HTTPS. Check camera permission granted and denied, shutter, gallery, retake, loading cancel, analysis, object details and saved Memories after reload. HEIC decoding is supported by the backend, but browser preview support still varies.

From `C:\Users\jason\Documents\Codex\CalHacks13`, use two terminals:

```powershell
# Terminal A: backend. Create the environment only if needed.
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-sky-photo.txt
# Create/edit .env before running this command.
.\.venv\Scripts\python.exe -m uvicorn sky_photo.main:app --reload --env-file .env --host 127.0.0.1 --port 8000
```

```powershell
# Terminal B: frontend. Choose an unused port.
npm install
npm run dev -w web -- --hostname 127.0.0.1 --port 3003
```

Open http://127.0.0.1:3003. Backend health is http://127.0.0.1:8000/health. The verification backend started during this task intentionally has no provider keys, so stop that process before starting the configured command above. Without credentials, image metrics still work and the UI reports Needs review instead of inventing names or a score.

## What remains for the full shared app

- **Accounts and ownership:** sign-in, user IDs, profile records and authorization for every private photo/result.
- **Durable storage:** store originals, previews/annotated JPEGs and result metadata on a deployed backend. Current Memories are device-local; current server annotations live in `data/photos`. Browser storage can be cleared, and transient server disks are not a cloud photo library.
- **The social layer:** real friends/follows, posts, Friends/Nearby queries, reactions and notifications. The existing SpacetimeDB directory is a starting point, not a completed implementation.
- **Live astronomy in Explore:** location/time-based ephemerides and visibility calculations before displaying real rise/set times, direction or a Visible now claim. Cloud cover is current weather, not a complete astronomical visibility score.
- **Deployment:** deploy the Python service and web app, set server-side `SKY_PHOTO_URL` for the web deployment, and use HTTPS for the phone camera. In local development with the backend on port 8000, the proxy default already works. For a custom local backend URL, set it in `web/.env.local`; Next.js runs from the `web` workspace.
- **Native iOS distribution, if wanted:** package or port the web experience, add the required camera/photo permission descriptions, and test native lifecycle and storage. Matching an iOS visual design alone does not create an App Store app.

Do not combine the entire Vite scaffold from a new Figma export with the Next.js project. Port visual changes into `web/src/components/yonder`, retaining the API adapter, local storage, camera lifecycle and verified-coordinate handling.

## Validation completed

- Production build, workspace TypeScript checks and web ESLint passed.
- 56 Python tests passed, including normalized marker positions, bounds validation, deduplication and the rule that an unsolved image has no markers.
- Runtime adapter checks passed for multipart compatibility, partial HTTP 504 results, non-sky/service errors, diagnostic filtering, deduplication, annotation paths and model-estimate isolation.
- Browser upload of the repository's synthetic night-sky fixture passed through Next.js and the real FastAPI metrics pipeline, rendered Needs review without fake celestial names, saved to IndexedDB and survived reload. The agent-created test Memory was removed through the UI afterward.
- A daytime fixture returned to the chosen photo with an explanation and retry. City selection updated weather/coordinates. Profile edits survived reload.
- Layout checks at 320, 390, 768 and 1440px showed no horizontal page/screen overflow; all five navigation controls remained at least 44px in both dimensions.
- Figma camera/loading changes built successfully, and the dedicated loading page and camera error/cancel states were inspected.

Live Astrometry/Grok identification, a hardware camera capture on a physical phone, a paid-provider failure during processing, and production deployment remain unverified. The current test upload demonstrates integration and metrics, not live celestial recognition.
