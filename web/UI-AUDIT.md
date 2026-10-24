# Your Sky baseline design audit

Date: 2026-10-24, America/Los_Angeles.

This reviews the existing checkpoint before the Sky Guide-inspired redesign. It is not a final design certification. App code is unchanged. Unknown or untested checks are Fail.

Pre-flight result: 40 Pass, 22 Fail, 62 total.

## Source and scope

Active skill SHA-256: 2298b5a24b44fc8e6aeed996a48c2beebe2f9b89f7c1eb924824b92b79341971.

Rule source: https://github.com/Leonxlnx/taste-skill-classics/blob/main/skills/taste-skill-v2-experimental/SKILL.md

The original Section 14 item numbering is preserved below. Rules are evaluated against the app brief, with user overrides and absent marketing features explicitly explained. The short labels are summaries; the linked skill is the full criterion.

## Dash audit

Fail: 44 literal U+2013/U+2014 occurrences on 44 lines in 18 first-party files. This scans git-tracked and non-ignored untracked UTF-8 text. It excludes dependencies, build output, Git internals and binary files. Dynamic API text is not verified.

- Fail: `.cursorrules:1` contains 1 banned code point(s).
- Fail: `.cursorrules:9` contains 1 banned code point(s).
- Fail: `.cursorrules:10` contains 1 banned code point(s).
- Fail: `.cursorrules:11` contains 1 banned code point(s).
- Fail: `.cursorrules:12` contains 1 banned code point(s).
- Fail: `.cursorrules:13` contains 1 banned code point(s).
- Fail: `.cursorrules:26` contains 1 banned code point(s).
- Fail: `.env.example:1` contains 1 banned code point(s).
- Fail: `.env.example:16` contains 1 banned code point(s).
- Fail: `README.md:1` contains 1 banned code point(s).
- Fail: `README.md:11` contains 1 banned code point(s).
- Fail: `README.md:52` contains 1 banned code point(s).
- Fail: `README.md:58` contains 1 banned code point(s).
- Fail: `README.md:63` contains 1 banned code point(s).
- Fail: `README.md:86` contains 1 banned code point(s).
- Fail: `README.md:87` contains 1 banned code point(s).
- Fail: `README.md:88` contains 1 banned code point(s).
- Fail: `ingest/src/fetch-events.ts:29` contains 1 banned code point(s).
- Fail: `ingest/src/fetch-events.ts:39` contains 1 banned code point(s).
- Fail: `ingest/src/fetch-events.ts:49` contains 1 banned code point(s).
- Fail: `lib/src/grok.ts:17` contains 1 banned code point(s).
- Fail: `pyproject.toml:4` contains 1 banned code point(s).
- Fail: `sky_photo/__init__.py:1` contains 1 banned code point(s).
- Fail: `sky_photo/astrometry.py:371` contains 1 banned code point(s).
- Fail: `sky_photo/metrics.py:175` contains 1 banned code point(s).
- Fail: `sky_photo/score.py:3` contains 1 banned code point(s).
- Fail: `sky_photo/score.py:15` contains 1 banned code point(s).
- Fail: `sky_photo/score.py:82` contains 1 banned code point(s).
- Fail: `sky_photo/vision.py:3` contains 1 banned code point(s).
- Fail: `sky_photo/vision.py:4` contains 1 banned code point(s).
- Fail: `sky_photo/vision.py:470` contains 1 banned code point(s).
- Fail: `spacetime/README.md:16` contains 1 banned code point(s).
- Fail: `tests/generate_fixtures.py:40` contains 1 banned code point(s).
- Fail: `tests/generate_fixtures.py:71` contains 1 banned code point(s).
- Fail: `tests/test_score.py:1` contains 1 banned code point(s).
- Fail: `web/AGENTS.md:5` contains 1 banned code point(s).
- Fail: `web/AGENTS.md:7` contains 1 banned code point(s).
- Fail: `web/src/app/layout.tsx:16` contains 1 banned code point(s).
- Fail: `web/src/app/my-sky/page.tsx:5` contains 1 banned code point(s).
- Fail: `web/src/app/my-sky/page.tsx:20` contains 1 banned code point(s).
- Fail: `web/src/app/upload/page.tsx:193` contains 1 banned code point(s).
- Fail: `web/src/app/upload/page.tsx:264` contains 1 banned code point(s).
- Fail: `web/src/app/upload/page.tsx:330` contains 1 banned code point(s).
- Fail: `web/src/app/upload/page.tsx:333` contains 1 banned code point(s).

## Hero discipline audit

Pass: Home has a two-line headline and 12 supporting words on two lines at all measured sizes. The primary label occupies one line and Capture is entirely inside the initial viewport.

- Pass: 1440x1000, headline 2 lines, subtext 12 words/2 lines, Capture top 699.2px/bottom 755.2px, visible True.
- Pass: 768x1024, headline 2 lines, subtext 12 words/2 lines, Capture top 703.2px/bottom 759.2px, visible True.
- Pass: 390x844, headline 2 lines, subtext 12 words/2 lines, Capture top 567.2px/bottom 623.2px, visible True.

Home primary text/button contrast: 12.69:1 for #172434 on #D9E9FA. This verifies that color pair only, not every CTA state.

Fail: the complete hero still violates stack and copy discipline because of the desktop corner label and duplicate photo actions. Fitting the viewport is only one part of this audit.

## Section-layout-repetition audit

- Home header: compact wordmark/action row.
- Home main section: single immersive image with overlaid bottom-anchored text/actions.
- Home supporting caption: one horizontal text/attribution row.
- Home navigation: compact horizontal peer navigation.
- My Sky heading: vertical title/description stack.
- My Sky main section: centered journal empty state with decorative photo-stack illustration.
- My Sky navigation: the same shared navigation family, intentionally repeated across routes for a stable app shell.
- Upload heading: vertical back-link/title/description stack.
- Upload main section: single-column labeled form.
- Upload conditional result: stacked report with identity badges, rubric rows, two-column critique, technical metadata, image and raw-JSON disclosure. These result states were source-reviewed, not exercised against a live AI backend.

Pass: there are no consecutive repeated landing-page section families. Intentional app navigation repeats across routes. No extra marketing sections are proposed. The upcoming collection may repeat photo cells because it is a functional collection, not a feature-card section.

## Section 14 pre-flight

1. **Pass - Brief inference:** Design Read is declared for a phone-first stargazing app for curious friends.
2. **Pass - Dial values:** DESIGN_VARIANCE 5, MOTION_INTENSITY 3, VISUAL_DENSITY 3 reflect the calm, simple brief.
3. **Pass - Design system:** Sky Guide-inspired web styling is labeled as inspiration, with no claim of official Apple components.
4. **Pass - Redesign mode:** Visual overhaul is authorized; current tokens, routes, source and browser measurements are recorded below.
5. **Fail - ZERO em-dashes (`-`) anywhere on the page.:** Static UI and repository text contain banned dash code points; dynamic model output is also unverified.
6. **Pass - Page Theme Lock:** Home, My Sky and Upload all use dark surfaces; dark-only is an explicit user choice.
7. **Fail - Color Consistency Lock:** Home and Upload use different primary action colors and have no shared action token.
8. **Fail - Shape Consistency Lock:** Home uses a documented 12/16/24px scale while Upload has a separate 6px radius system.
9. **Fail - Button Contrast Check:** Home primary text contrast is calculated below; photo secondary actions and all Upload states have not been fully measured.
10. **Pass - CTA Button Wrap:** The Home primary label stays on one line at 390, 768 and 1440px.
11. **Fail - Form Contrast Check:** Base form colors were inspected, but focus, validation and error contrast have not all been measured.
12. **Fail - Serif discipline:** The existing DM Serif display titles conflict with the newly selected bold sans-serif direction.
13. **Pass - Premium-consumer palette check:** There is no beige, brass, clay or oxblood palette.
14. **Pass - Italic descender clearance:** There are no italic display words to clip.
15. **Pass - Hero fits the viewport:** At all three measured widths the headline is two lines, subtext is 12 words/two lines, and Capture is visible.
16. **Fail - Hero top padding:** Bottom-anchored hero content sits deep in the image on tall desktop screens; the new Tonight layout must address this.
17. **Fail - Hero stack discipline:** The desktop hero includes a separate PAUSE. LOOK UP. label beyond the eyebrow, headline, body and actions.
18. **Pass - EYEBROW COUNT (mechanical):** Home and My Sky each have one eyebrow within a one-section screen, within the stated count cap.
19. **Pass - Split-Header Ban:** There is no large-left-title/small-right-explainer section header.
20. **Pass - Zigzag Alternation Cap:** There is no sequence of image/text zigzag sections.
21. **Fail - No Duplicate CTA Intent:** Capture your sky and Or upload a photo both navigate to /upload and currently have the same effect.
22. **Pass - Logo wall = logo only:** No logo wall exists.
23. **Pass - Bento Background Diversity:** No bento grid exists, so no cells require artificial variation.
24. **Pass - "Used by / Trusted by" logo wall:** No trust-logo strip exists inside or outside the hero.
25. **Fail - Copy Self-Audit:** Upload exposes service-startup jargon; Capture promises a camera destination that is not implemented yet.
26. **Pass - Motion motivated:** Existing press scaling and color feedback acknowledge interactions; there are no decorative animation loops.
27. **Pass - Marquee max-one-per-page:** There are no marquees.
28. **Pass - Navigation on ONE line:** Header height is 44px; desktop bottom navigation is about 65px and remains on one line.
29. **Pass - Section-Layout-Repetition:** Home media hero, My Sky journal empty state, and Upload form use different layout families; no landing-page section stack is present.
30. **Pass - Bento has rhythm AND exact cell count:** No bento cells or empty layout slots exist.
31. **Fail - Long lists use the right UI component:** Backend-generated lists can exceed five items and have no compact or expanded presentation contract.
32. **Pass - Real images used:** Home uses a real bundled night-sky photograph with photographer and license/source attribution.
33. **Fail - No pills/labels overlaid on images:** The hero photograph has a decorative topline and desktop corner label overlaid on it.
34. **Pass - No photo-credit captions as decoration:** The photograph credit identifies the real photographer and source; it is not an invented editorial caption.
35. **Pass - No version footers:** There is no version/build footer.
36. **Pass - No micro-meta-sentences:** There is no extra meta sentence beneath an eyebrow.
37. **Fail - No decoration text strip at hero bottom:** The PAUSE. LOOK UP. corner label is decorative text at the bottom of the hero.
38. **Pass - No floating top-right sub-text:** No section heading has an unaligned floating top-right paragraph.
39. **Pass - No scoring/progress bars with filled background tracks:** App adaptation: existing rubric bars represent actual quality data, not decorative marketing comparisons; this does not add gamification to the new scope.
40. **Pass - No locale / city-name / time / weather strips:** Location, date and time are functional astronomy inputs in this brief; no decorative locale strip is implemented.
41. **Pass - No scroll cues:** There is no scroll instruction or animated mouse indicator.
42. **Fail - No version labels in hero:** Early preview is first-screen chrome and should be removed from the redesigned product surface.
43. **Pass - No section-numbering eyebrows:** There are no numbered section eyebrows.
44. **Fail - No decorative dots:** The Early preview indicator is a static decorative dot rather than a live system state.
45. **Pass - No `border-t` + `border-b` on every row:** No long specification list uses both top and bottom borders on every row.
46. **Fail - Content density:** Result UI exposes scores, technical metrics and raw JSON beyond the requested simple discovery flow.
47. **Pass - Quotes ≤ 3 lines:** No testimonial or quotation block exists.
48. **Pass - Motion claimed = motion shown:** Motion is set to 3 and only interaction feedback is claimed; no cinematic movement is promised.
49. **Pass - GSAP sticky-stack / horizontal-pan:** No GSAP pinning or horizontal scroll-hijack exists.
50. **Pass - No `window.addEventListener('scroll')`:** No window scroll event handler exists in the UI source.
51. **Pass - Reduced motion:** The current CSS removes transitions and press scaling under prefers-reduced-motion.
52. **Pass - Dark mode:** User override: dark-only was explicitly chosen; the current dark screens are browser-verified, with no light-theme claim.
53. **Pass - Mobile collapse:** Explicit mobile rules exist and prior 320/390/768/1440px checks found no horizontal overflow.
54. **Fail - Viewport stability:** Current min-height uses 100svh, so it does not literally pass the skill requirement for 100dvh; browser chrome behavior needs a new check.
55. **Pass - `useEffect` animations:** There are no useEffect-driven UI animations requiring teardown.
56. **Fail - Empty / loading / error:** My Sky has an empty state and Upload has basic loading/error text, but permission, no-detection, retry and saved states are not fully designed.
57. **Fail - Cards omitted:** The decorative stacked-photo empty-state container adds an ornamental card without content.
58. **Fail - Icons:** SkyIcon contains hand-drawn SVG paths rather than an allowed icon library.
59. **Pass - Motion:** No Motion library or motion client component is present; static screens remain server components.
60. **Fail - No AI Tells:** Serif display, decorative preview chrome, corner text and duplicate photo actions remain in the old UI.
61. **Fail - Core Web Vitals:** Lighthouse and measured LCP, INP and CLS have not been run; source choices alone cannot establish a pass.
62. **Pass - One design system:** One existing Next.js/Tailwind application is retained; no competing component design systems were added.

## Highest-impact next changes

- Replace the serif hero and decorative preview chrome with the confirmed Tonight screen, a bold sans-serif title, one sky feature and a single Capture intent.
- Unify the photo workflow with the same tokens, icon family and short object-learning sheets after the pending flow decisions are answered.
- Remove banned dash characters from UI-authored strings, validate generated copy, design missing states, then rerun all 62 checks and measure performance.

## Verification limits

This audit reused and extended the actual repository preview at http://127.0.0.1:3001. Hero measurements were read from the live DOM at the stated sizes. Prior build/type/lint success does not establish design compliance. No Lighthouse run, native device test, authenticated save flow or paid AI analysis was performed for this audit.
