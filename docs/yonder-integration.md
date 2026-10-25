# Yonder: UI and photo-analysis handoff

## Current camera integration: Ben's sky reveal

Yonder's camera uses Ben (`beng0ng`)'s latest `sky-image-proc` implementation at commit `49415c3`, preserving his analysis prompt, expanded star catalog, geometry verification, location/FOV prediction, significant-feature ranking, coded scoring and response-recovery behavior. The current Figma Make design remains the visual source of truth: full-screen photograph, subtle object rings, bookmark and translucent object detail sheet. Ben's detections and explanations populate those elements; constellation motif/color, scored highlights, rubric, catalog and FOV summaries appear in the existing result detail UI. His separate dashboard-style capture/result flow is not used. Ask Grok for more remains available inside the object sheet.

Ben's upcoming celestial-events board is also available at `/events`, linked from Explore. It keeps the rarity-filtered event list and interactive globe, uses the same selected location as Yonder, and opens Yonder's camera from its capture actions. The five-action Figma navigation stays in place; Events is an Explore destination rather than a replacement tab.

- Flow: camera/gallery → photo review with location and capture time → Yonder's minimal loading screen → Ben's reveal → Save memory. The full original response and capture metadata are retained in IndexedDB. Existing Python-pipeline Memories still open with their original result view.
- API: `POST /api/analyze-sky` accepts Ben's `{ imageBase64, mimeType, meta }` JSON contract and returns `{ analysis, score, verification, prediction, fovCheck }`. The client uses Ben's unchanged 1280px JPEG conversion, keeps the original photo locally and adds a 105-second timeout plus stale-response/cancel guards. Cancel preserves the photo and metadata; it does not guarantee cancellation of a provider call already in progress.
- The original photo review stays full-screen; a compact Photo location & time control expands only when needed. Required metadata: photo latitude, longitude and capture time in the device's local time zone. Optional camera facing, elevation, FOV and notes match Ben's inputs. Current location is only requested on tap; imported older photos require the user to confirm where/when they were taken. Missing facing stays unknown; Ben's defaults remain elevation 40° and FOV 70°.
- `POST /api/figure-detail` preserves Ben's Ask Grok for more behavior. Request validation was added around the analysis boundary for malformed JSON, oversized requests, coordinate/date/angle ranges; provider internals are not sent to the browser.
- “Nothing verified” is Ben's internal placeholder, retained in the raw response but excluded from Yonder's discovered-object counts and overlays. Catalog-checked results remain labeled model estimates, never plate-solved.

### Run this integrated flow

1. From the repository root, `npm install`.
2. Copy `.env.example` to `.env`, add `XAI_API_KEY`, and optionally set `SKY_VISION_MODEL` to a vision model enabled for the account. `VISION_API_KEY` is for the older Python service and is not used by this flow.
3. Run `npm run dev`; open the printed URL, tap the center camera button, capture/select a JPEG or PNG, confirm photo location/time and Analyze sky. Browser HEIC decoding varies; unsupported photos return an actionable JPEG/PNG error.
4. No Python service or Astrometry key is required for Ben's flow. Keep the older `/api/sky-photo` service available only if testing that separate pipeline or opening its server-hosted annotated images.

Integration verification: workspace type checks, web lint and production build; Ben's 27 offline catalog/score checks; metadata/adapter/empty-result/legacy tests; real API malformed-request and missing-key paths; controlled synthetic-response browser checks for loading, Figma result markers and object sheets and saved-memory reload. Live Grok recognition and physical phone capture need credentials/hardware and are not claimed as tested.

The sections below document the older Python pipeline and broader shared-app work. The camera now uses the flow above.

The current Yonder Figma Make design replaces the former Your Sky UI on `feat/ui`. The app remains a phone-first Next.js web app. This change does not create a native iOS binary or a shared social backend.

Design source: https://www.figma.com/make/lK1XPXSmzeAS9AsI4RDzyu/Design-Your-Sky-Astronomy-App

## What is connected

- Home, Explore, camera, Memories, Profile and the Events destination use the imported Figma visual language, celestial icons and original photographs.
- Events combines the upcoming celestial-event catalog with location-aware distance/rarity sorting and a linked globe/list selection view. Event discovery is an observing guide, not a prediction that a specific event will be visible through clouds or local obstructions.
- The center camera button opens a real camera dialog, with shutter, rear/front selection when available, gallery picker, native phone-camera fallback, permission errors and cleanup when hidden or closed.
- A captured or selected photo opens an uncropped review. The former analysis adapter sends multipart `image` to the existing Next.js proxy and FastAPI pipeline; the current camera uses Ben's JSON endpoint above.
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
