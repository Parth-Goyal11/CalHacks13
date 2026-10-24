# Your Sky capture and discovery checkpoint

Date: 2026-10-24. A mobile-web iteration in the existing Next.js repo.

## Delivered

- Capture entry with Take a photo, Choose a photo and a labeled sample.
- Full-screen browser camera with one shutter, close control, explicit permission request and native camera/library fallbacks. Camera tracks stop when closed.
- Review before upload, original preview and optional target hint. JPEG, PNG and HEIC input, with a 20 MB client limit and a fallback for unsupported browser previews.
- Real analysis through the existing multipart image and claimed_target contract. Cancellable status, two-minute timeout and recoverable errors preserve the photo.
- Result image, distinct object choices and short learning sheets. Model suggestions are distinguished from a matched star field.
- Sample mode demonstrates two gradually revealed interactive markers and show/hide highlights. It makes no analysis API request.
- General NASA-backed learning notes. Personalized Grok explanations and local sky predictions remain future integration work.

## Verification

- Final production build, TypeScript compilation, ESLint and git diff whitespace checks passed.
- Sample review, discovery, marker activation, explanation sheet, Escape, return focus and highlight toggle worked in the browser.
- Selected the bundled public photo with the real file chooser. Its original preview loaded and survived navigation to My Sky and back.
- A real request to the offline Sky Photo service showed a recoverable error and kept the original photo. Successful solver or paid AI output is not claimed.
- Entry and discovery had no horizontal overflow at 320x700, 390x844, 844x390 and 1440x1000. Main actions measured 48px high; sample and marker controls at least 44px.
- Physical camera permissions, low-light hardware capture, HEIC decoding, slow-request cancellation, successful live identification, screen readers and largest text settings remain unverified.

## Hero, dash and layout checks

Capture entry uses the title Capture your sky and seven-word support copy: A moment outside. Something new to notice. The primary camera action ended at about 494px on 320x700, 474px on 390x844, 306px in 844x390 landscape and 307px on 1440x1000, above fixed navigation.

Layout families: entry image/action split; review image/form split; analysis image/status split; discovery image/list split; full-screen camera; native learning sheet. Phone layouts stack. Repeated rows and navigation are functional collections.

New authored web source has zero literal U+2013/U+2014. Wider-checkout and generated-text limitations from TONIGHT-AUDIT.md still apply. This checkpoint does not claim a global dash pass or measured Core Web Vitals.

## Next integration tasks

### Backend teammate: interactive positions

AnnotationPoint in sky_photo/astrometry.py already contains solver pixel positions. The pipeline uses those to make the annotated JPEG. SkyPhotoRecord currently returns names and annotated_image_url, but not the positions.

Add optional image-frame metadata and annotations to the existing response. Include decoded width/height, orientation normalization, object ID/name/kind, normalized x/y in [0,1] and per-object provenance. Positions must refer to the exact displayed image. Do not invent coordinates for model-only guesses. Preserve the existing request and response fields. Test portrait, landscape and rotated EXIF images.

The UI can then use these trusted positions instead of the sample coordinates. Keep the JPEG and object-list fallback for responses without positions.

### AI teammate: personal explanations

Provide a selected-object explanation endpoint using result/object IDs and identification provenance. Supply verified capture location and time when available. Return one short explanation, one evidence-backed reason it matters for that night, and a source or uncertainty note. Missing context should produce general learning. Current browsing time/location must not be treated as the capture context of an imported photo.

### UI owner: next small iteration

1. Test the camera on a physical phone over HTTPS, including denial, orientation and a real night shot.
2. Connect trusted annotation coordinates to the existing tappable-marker interaction.
3. Connect the object sheet to Grok and verified capture context.
4. Save the original photo and result into My Sky.

Front/back capture, voice, social feed and leaderboards remain later work. The current sky-only flow and short learning sheet are reversible iteration defaults.

## Sources

- Camera permissions and secure contexts: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
- Milky Way: https://science.nasa.gov/universe/galaxies/
- Skywatching: https://science.nasa.gov/skywatching/
- Moon: https://science.nasa.gov/moon/viewing-tips/
- Constellations: https://spaceplace.nasa.gov/constellations/en/
- Governing design rules: https://github.com/Leonxlnx/taste-skill-classics/blob/main/skills/taste-skill-v2-experimental/SKILL.md


## Section 14, all 62 pre-flight checks

57 Pass, 5 Fail. Unchanged Tonight-specific checks carry forward from the Tonight audit; unverified items remain Fail.

1. **Pass - Brief inference:** Design Read is declared for a calm, phone-first stargazing app for curious friends.
2. **Pass - Dial values:** Variance 5, motion 3, density 3 are explicit and match the compact information-first screen.
3. **Pass - Design system:** The custom web design is honestly labeled Sky Guide-inspired; no official Apple implementation is claimed.
4. **Pass - Redesign mode:** The original audit and screenshots are retained; the new visual direction and navigation are user-authorized.
5. **Fail - ZERO em-dashes (`-`) anywhere on the page.:** Authored web source and observed Tonight text contain zero banned dashes; the wider repository still contains 37 occurrences and generated photo-result text is unverified.
6. **Pass - Page Theme Lock:** New screens and sheets remain dark; no section inverts into a light theme.
7. **Pass - Color Consistency Lock:** All three routes share the same pale-blue primary actions and dark shell. Existing rarity and review colors are retained only as semantic analysis states, never competing navigation accents.
8. **Pass - Shape Consistency Lock:** Shared radii remain. Circular shutter and target rings serve camera and annotation controls.
9. **Pass - Button Contrast Check:** Capture actions and the selected Capture tab use #142034 on #B8D1F3 (10.46:1). Low-contrast upload labels were raised to zinc-300 and focus outlines use the shared accent.
10. **Pass - CTA Button Wrap:** Capture, location and city-search labels stay on one line in tested desktop layouts; icon-only search has an accessible name.
11. **Pass - Form Contrast Check:** Target input has a visible label, 16px text and shared high-contrast styles; visible photo-picker actions are 48px high.
12. **Pass - Serif discipline:** Rendered Tonight, My Sky and Upload typography is sans-serif; the old serif is no longer referenced by UI CSS.
13. **Pass - Premium-consumer palette check:** The palette is cool near-black, pale blue and neutral text, without beige/brass/oxblood defaults.
14. **Pass - Italic descender clearance:** No display text uses italic styling.
15. **Pass - Hero fits the viewport:** Capture title and seven-word subtitle are compact; the main camera action clears navigation at all four tested sizes.
16. **Pass - Hero top padding:** The page title starts near the top; photo content no longer floats deep inside a tall image.
17. **Pass - Hero stack discipline:** Entry image, framing guidance and distinct camera/library actions serve the photo task.
18. **Pass - EYEBROW COUNT (mechanical):** No uppercase tracked eyebrow appears above the new section headings.
19. **Pass - Split-Header Ban:** The right-hand desktop header content is an actionable location selector, not a floating explanatory paragraph.
20. **Pass - Zigzag Alternation Cap:** There is no sequence of repeating image/text zigzag sections.
21. **Pass - No Duplicate CTA Intent:** Camera, library and sample buttons start distinct inputs. Shared Capture navigation keeps its established label.
22. **Pass - Logo wall = logo only:** No customer logo wall exists.
23. **Pass - Bento Background Diversity:** No bento grid exists; artificial decorative cells were not added.
24. **Pass - "Used by / Trusted by" logo wall:** No trusted-by or customer-logo strip exists.
25. **Fail - Copy Self-Audit:** Static NASA learning notes were reviewed; arbitrary successful model-generated output is not verified.
26. **Pass - Motion motivated:** Interaction feedback acknowledges controls; no automatic decorative motion, parallax or particle loops were added.
27. **Pass - Marquee max-one-per-page:** There is no marquee.
28. **Pass - Navigation on ONE line:** The three navigation slots fit one horizontal row with one-line labels and a height below 80px.
29. **Pass - Section-Layout-Repetition:** Entry image/actions, review image/form, analysis image/status, discovery image/list and a native learning sheet are distinct task states.
30. **Pass - Bento has rhythm AND exact cell count:** There are no bento cells or blank layout slots.
31. **Fail - Long lists use the right UI component:** Display is capped at 12 objects and five improvement notes; worst-case payload and raw JSON rendering are not load-tested.
32. **Pass - Real images used:** The existing real night-sky photograph is used, credited and explicitly marked illustrative.
33. **Pass - No pills/labels overlaid on images:** Only functional discovery buttons and camera framing guidance overlay images.
34. **Pass - No photo-credit captions as decoration:** Attribution names the actual photographer and source, with no invented archival styling.
35. **Pass - No version footers:** There is no version/build footer.
36. **Pass - No micro-meta-sentences:** Preview-location and example-target notes explain data scope; no ornamental meta sentence is used under an eyebrow.
37. **Pass - No decoration text strip at hero bottom:** The PAUSE. LOOK UP. decorative strip was removed.
38. **Pass - No floating top-right sub-text:** No heading has an unaligned top-right explanatory text fragment.
39. **Pass - No scoring/progress bars with filled background tracks:** The new Tonight UI has no progress/comparison tracks; preserved quality rubric bars are functional app data, an explicit contextual adaptation.
40. **Pass - No locale / city-name / time / weather strips:** Location, approximate coordinates, date and weather directly serve this place/time-focused astronomy brief.
41. **Pass - No scroll cues:** There are no scroll cues.
42. **Pass - No version labels in hero:** The Early preview brand badge is removed; Preview location describes the actual default-place state, not a version.
43. **Pass - No section-numbering eyebrows:** There are no numbered section eyebrows.
44. **Pass - No decorative dots:** There are no decorative status dots; the small star is the brand mark and all other icons label functions.
45. **Pass - No `border-t` + `border-b` on every row:** New list rows use spacing without repeated top/bottom rules.
46. **Pass - Content density:** Photograph and object choices lead. Scores, critique and raw responses are behind disclosures.
47. **Pass - Quotes ≤ 3 lines:** There are no testimonial or quote blocks.
48. **Pass - Motion claimed = motion shown:** Two sample markers reveal with short staggered opacity fades. No live solver progress or measured frame rate is claimed.
49. **Pass - GSAP sticky-stack / horizontal-pan:** No GSAP stack, pinning or horizontal scroll hijack exists.
50. **Pass - No `window.addEventListener('scroll')`:** No window scroll listener or scroll-driven React state exists.
51. **Pass - Reduced motion:** CSS disables marker animation and shutter scaling while keeping markers visible.
52. **Pass - Dark mode:** Dark-only is a user-authorized override and all new dark surfaces were viewed in the browser.
53. **Pass - Mobile collapse:** Entry and sample discovery were checked at 320, 390, 844 landscape and 1440px without horizontal overflow.
54. **Pass - Viewport stability:** The new root/shell use 100dvh and the page does not use a fixed h-screen hero.
55. **Pass - useEffect animations:** Streams stop on cleanup, stale media stops its tracks, requests cancel, response IDs ignore superseded work, and local data-URL previews survive retained navigation state.
56. **Fail - Empty / loading / error:** States are implemented and offline recovery was tested, but physical camera and successful solver results remain unverified.
57. **Pass - Cards omitted:** Only the condition group and real photograph use content containers; discovery entries are open rows and decorative photo-stack cards are removed.
58. **Pass - Icons:** All authored UI icons come from Radix Icons; SkyIcon no longer draws custom SVG paths.
59. **Pass - Motion:** Interactive behavior stays in the client TonightView leaf; no motion library or server-side animation component is present.
60. **Pass - No AI Tells:** No purple glow, serif display, floating glass navigation, decorative micro-labels or three equal feature-card columns remain in the new screen.
61. **Fail - Core Web Vitals:** Lighthouse and measured LCP, INP and CLS have not been run; successful builds and small assets alone are insufficient evidence.
62. **Pass - One design system:** The existing Next.js/Tailwind application and scoped CSS modules remain; Radix supplies icons only, not a competing component system.
