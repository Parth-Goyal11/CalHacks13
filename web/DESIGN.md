# Yonder design contract

The user's current Yonder Figma Make is the design source for this branch:
https://www.figma.com/make/lK1XPXSmzeAS9AsI4RDzyu/Design-Your-Sky-Astronomy-App

This request supersedes the former Tonight/Capture/My Sky interface and its previous styling direction. UI-AUDIT.md, TONIGHT-AUDIT.md and CAPTURE-AUDIT.md describe historical checkpoints.

## Current visual direction

- Phone-first Next.js web app, usable within a centered portrait frame on a laptop.
- Five-action navigation: Home, Explore, white unlabeled camera, Memories, Profile.
- Centered Yonder wordmark, familiar system sans-serif, dark surfaces, restrained violet/champagne celestial details, translucent floating navigation.
- Photo-led Home with large personal/friend photo slots and short supporting text.
- Imported Figma celestial icon geometry and original photography, with local static assets under public/yonder.
- Native iOS safe-area insets, readable metadata, at least 44px control hit areas, visible keyboard focus and reduced motion.

## Functional boundaries

- Camera opens the actual capture/review task, not a seeded result.
- Preserve multipart POST /api/sky-photo with image and existing optional fields. Keep scoring and judgment logic in the backend.
- Loading reflects the real request. No invented progress percentage or automatic fake successful result.
- Plate-solved and model-estimate identities must be distinguishable. Missing keys/vision review, no named detections, service failures and rejected daytime photos must be understandable.
- Only solver coordinates may produce markers on a real user photo. Normalize them against the EXIF-oriented image and account for object-fit letterboxing. Do not use screenshot positions or sample stars as detections.
- Keep originals uncropped in photo review and real discovery. Annotated JPEGs must retain their correct geometry.
- Memories and profile editing currently use on-device storage. The demo presents a seeded Jason Liu profile (34 skies, 87 discoveries, 6 places) and a static photo feed without sample labels, per the user brief. Do not imply a connected social network, cloud sync or authentication. User-supplied sky photos omit location labels; curated highlights describe visible features without claiming solved catalog identities.
- Existing /upload and /my-sky entry points remain usable. /loading previews the minimal analysis loading design.

## Implementation and verification

UI and integration components live in web/src/components/yonder. The former your-sky UI has been removed; shared API/data types were moved into the new directory.

Use docs/yonder-integration.md for environment setup, the live-provider requirements, validation evidence and remaining shared-app work. Recheck the affected user flow in a browser when changing camera, analysis, annotations or persistence. Paid provider calls and physical phone behavior need separate evidence; a successful build does not verify them.
