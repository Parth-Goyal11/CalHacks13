# Your Sky design contract

## Active design rule source
Use only design-taste-frontend-v2-experimental for design rules in this project.
Source: https://github.com/Leonxlnx/taste-skill-classics/tree/main/skills/taste-skill-v2-experimental
Emil design engineering is installed for optional future use but is not an active design rule source. Appllama and the other previously reviewed design skills are superseded for this redesign.

## Design Read
Reading this as: a phone-first stargazing app for curious friends, with a calm Sky Guide-inspired visual language, bold sans-serif type, dark surfaces, and restrained motion.

## Dials
- DESIGN_VARIANCE: 5. Controlled composition, familiar navigation and a single-column phone layout.
- MOTION_INTENSITY: 3. Immediate controls and short state feedback; no parallax, scroll pinning, particle backgrounds or decorative loops. Discovery reveal motion remains a flow decision.
- VISUAL_DENSITY: 3. One primary sky feature and up to three things to spot.

## Confirmed product choices
- Keep the temporary product name Your Sky. Sky Guide is the visual reference, not a requested rename.
- Phone browser first, with a usable laptop layout. Keep the existing Next.js stack.
- Primary navigation: Tonight, Capture, My Sky. Capture opens a focused photo task and Close returns to the originating screen.
- Tonight opens first: one main sky feature, one Capture action and up to three things to spot.
- Bold sans-serif typography, near-black surfaces, sky imagery and rounded detail sheets.
- Dark-only is explicitly selected. Maintain readable contrast; no automatic light-theme work.
- Location: ask permission on Use my location, with manual city search. Send coordinates rounded to two decimals.
- Conditions: temperature, cloud cover and a short viewing note.
- Sky image: a compact supporting photograph, around one-third of the first screen rather than a full-screen background.
- Defer Explore, friends feed, leaderboards, voice, image enhancement, search and the event calendar.

## Pending flow decisions
These were asked previously and remain unanswered. Do not silently treat the suggested defaults as approved.
- Sky photo only, optional selfie, or mandatory front/back pair.
- Gradual highlights, immediate highlights, or a whole-photo story.
- Short learning sheet, suggested follow-ups, or open-ended chat.
- Photo grid, chronological feed, or calendar for saved memories.

## App-specific adaptation
The experimental skill primarily targets websites and explicitly excludes native mobile. This project is a mobile web app, and the user explicitly requested adaptation. Keep the app's short screens, functional repetition in navigation/collections, photo task, and object sheets. Do not manufacture eight marketing sections or install a new design system to satisfy an unrelated example. For absent marketing devices, record Pass with an absence explanation. Keep all 62 pre-flight entries and mark unverified checks Fail.
Functional sky annotations are explicitly requested controls, not decorative image badges. Location/date/time are astronomy inputs, not ornamental metadata. No generated asset or model description proves an object was present in a user's photo. Preserve the original capture and distinguish expected visibility from image-confirmed detections.

## Redesign boundaries
This is a visual overhaul of the existing UI, not a framework migration. The confirmed Tonight/Capture/My Sky navigation change is authorized. Keep existing upload/API routes and the multipart request contract. Do not rewrite backend scoring, ingest or shared model code for visual cleanup. Keep the existing focus/skip-link behavior and browser-back access.

## Required review bundle
- Dash audit: zero literal U+2014 or U+2013 in rendered UI, metadata, accessibility labels, fixtures and authored UI copy. Scan the entire first-party repository too, report every hit, and never claim a global pass while legacy hits remain. Exclude dependencies, Git data, build output and binary assets. Do not silently rewrite teammates' backend files or third-party licenses.
- Section 14 pre-flight: all 62 entries, each marked Pass or Fail with one line of evidence. Explain absent or app-adapted criteria; unverified is Fail.
- Section-layout audit: list each real screen section's layout family and explain functional collection repetition.
- Hero audit: report headline lines, supporting-copy word/line counts and primary-action visibility at 390, 768 and 1440px. Include a small-screen check when implementing.
- Re-check the final UI in the browser. Report failures openly instead of calling an unverified design complete.

## Implemented Tonight checkpoint
- The Tonight screen, My Sky empty state and location/object sheets now share Geist sans-serif typography and Radix Icons.
- Tokens: Night #0B0D12, Surface #161B24, Raised #202734, Text #F1F3F7, Muted #ADB7C8, Accent #B8D1F3, Action text #142034.
- Radius roles: 8px loading placeholders, 12px controls/icons, 20px photo/conditions surfaces, 24px sheets.
- Layer roles: 10 navigation, 20 dialog (native top layer), 30 skip link.
- Capture is the primary fixed navigation action and opens the existing /upload workflow. The full-screen camera remains a later checkpoint.
- Initial place is Berkeley, explicitly labeled Preview location. Weather for that place is current Open-Meteo model data, not sample weather. No browser location request occurs until the user chooses Use my location.
- /api/locations proxies public city search. /api/tonight validates and rounds coordinates, requests current temperature/cloud cover/daylight state, validates the response and supplies timezone/model time. Upstream requests time out after eight seconds.
- Weather refreshes every five minutes and can be retried after failure. Date/time are formatted in the selected location timezone after it resolves.
- Object entries are general learning examples, labeled as such, with NASA references. They are not current local visibility predictions, image detections or generated Grok explanations.
- Modal focus, Escape, scroll lock, no-results messaging and stale-request cancellation are included. Physical phone GPS permissions are still unverified.
- Web source contains zero literal U+2013/U+2014. Backend text and agent-generated prose still need a broader punctuation review.
- New verification results: TONIGHT-AUDIT.md.

## Original checkpoint baseline (historical)
The older checkpoint still uses Night #090F16, Surface #121D28, Mist #A8B9CA, Starlight #D9E9FA and Text #F1F4F7, with Geist body text, DM Serif Display titles and 12/16/24px radii. These describe the current implementation, not approval to retain the serif direction.
Current routes: / (Home), /my-sky (empty collection), /upload (existing photo workflow), and the existing /api/sky-photo proxy routes. CSS Modules scope the new screens; the Tailwind loader excludes .module.css. The skill setup itself added no runtime dependency. This UI checkpoint adds @radix-ui/react-icons.
The original redesign baseline is preserved in UI-AUDIT.md. The Tonight checkpoint now applies the new visual direction; the existing upload result UI has not received a full visual redesign.


## Verification refinements, 2026-10-24

Capture shares the application shell and pale-blue action styling. Form controls use 12px radii and at least 48px height; file and target text use 16px. Result containers use 20px radii, small semantic result badges use 4px and the file-selector button uses 8px. Rarity/review colors are semantic data states, separate from the single navigation accent. Small metadata is at least 12px. Photo metrics and critique are progressively disclosed. See TONIGHT-AUDIT.md for the full reference cross-check and outstanding verification.


## Capture and discovery iteration

The /upload route now hosts CaptureExperience: entry, review, analysis and discovery. Sky-only capture, short learning sheets and gradual sample markers are reversible defaults. Real results use existing solver JPEGs and object names; no positions are invented. Demo mode stays labeled. Camera permission is requested only on Take a photo. Original previews stay local until Analyze photo. Physical camera, successful solver output, Grok night context and saving remain pending. See CAPTURE-AUDIT.md for current evidence and the additive backend handoff.
