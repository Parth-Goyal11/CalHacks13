# Your Sky Tonight checkpoint audit

Date: 2026-10-24, America/Los_Angeles.

Capture has since changed. See CAPTURE-AUDIT.md for that newer flow and its verification limits. These totals describe the earlier Tonight checkpoint.

Section 14: 58 Pass, 4 Fail, 62 checked. This is a reviewable Tonight checkpoint, not a claim that the whole app passes the design gate.

## Delivered scope

Tonight, the shared Tonight/Capture/My Sky navigation, My Sky empty styling, native location/object dialogs, public city search and modeled current weather. Existing upload/API contracts remain. The camera, saved collections, photo discovery animation and local astronomy predictions are later pieces.

Default Berkeley is explicitly marked Preview location. Weather for that place is real model output. Selecting another city updates coordinates, timezone, conditions and viewing note. Device coordinates are rounded before the weather request; device permission behavior still needs a physical phone check.

## Dash audit

Pass for authored web/src text: zero literal U+2013/U+2014. Pass for the observed Tonight screen at all four widths: zero.

Fail for the wider first-party checkout: 37 occurrences in 15 files. Dependencies, Git internals, ignored build output and binary files were excluded. Existing backend-generated photo prose and arbitrary external/user text are not certified dash-free.

- Fail: `.cursorrules:1`, 1 occurrence(s).
- Fail: `.cursorrules:9`, 1 occurrence(s).
- Fail: `.cursorrules:10`, 1 occurrence(s).
- Fail: `.cursorrules:11`, 1 occurrence(s).
- Fail: `.cursorrules:12`, 1 occurrence(s).
- Fail: `.cursorrules:13`, 1 occurrence(s).
- Fail: `.cursorrules:26`, 1 occurrence(s).
- Fail: `.env.example:1`, 1 occurrence(s).
- Fail: `.env.example:16`, 1 occurrence(s).
- Fail: `README.md:1`, 1 occurrence(s).
- Fail: `README.md:11`, 1 occurrence(s).
- Fail: `README.md:52`, 1 occurrence(s).
- Fail: `README.md:58`, 1 occurrence(s).
- Fail: `README.md:63`, 1 occurrence(s).
- Fail: `README.md:86`, 1 occurrence(s).
- Fail: `README.md:87`, 1 occurrence(s).
- Fail: `README.md:88`, 1 occurrence(s).
- Fail: `ingest/src/fetch-events.ts:29`, 1 occurrence(s).
- Fail: `ingest/src/fetch-events.ts:39`, 1 occurrence(s).
- Fail: `ingest/src/fetch-events.ts:49`, 1 occurrence(s).
- Fail: `lib/src/grok.ts:17`, 1 occurrence(s).
- Fail: `pyproject.toml:4`, 1 occurrence(s).
- Fail: `sky_photo/__init__.py:1`, 1 occurrence(s).
- Fail: `sky_photo/astrometry.py:371`, 1 occurrence(s).
- Fail: `sky_photo/metrics.py:175`, 1 occurrence(s).
- Fail: `sky_photo/score.py:3`, 1 occurrence(s).
- Fail: `sky_photo/score.py:15`, 1 occurrence(s).
- Fail: `sky_photo/score.py:82`, 1 occurrence(s).
- Fail: `sky_photo/vision.py:3`, 1 occurrence(s).
- Fail: `sky_photo/vision.py:4`, 1 occurrence(s).
- Fail: `sky_photo/vision.py:470`, 1 occurrence(s).
- Fail: `spacetime/README.md:16`, 1 occurrence(s).
- Fail: `tests/generate_fixtures.py:40`, 1 occurrence(s).
- Fail: `tests/generate_fixtures.py:71`, 1 occurrence(s).
- Fail: `tests/test_score.py:1`, 1 occurrence(s).
- Fail: `web/AGENTS.md:5`, 1 occurrence(s).
- Fail: `web/AGENTS.md:7`, 1 occurrence(s).

## Hero discipline audit

App adaptation: Tonight is an app title, not a marketing hero. The primary Capture action lives in fixed navigation and stays visible while the user reads weather or the photograph. No duplicate photo/upload actions appear on Tonight.

- Pass: 320x700; title 1 line, photo-section heading 1 line; support copy 9 words/2 line(s); Capture visible at y=636-688; photo 200px high; no horizontal overflow.
- Pass: 390x844; title 1 line, photo-section heading 1 line; support copy 9 words/1 line(s); Capture visible at y=780-832; photo 220px high; no horizontal overflow.
- Pass: 768x1024; title 1 line, photo-section heading 1 line; support copy 9 words/1 line(s); Capture visible at y=960-1012; photo 304px high; no horizontal overflow.
- Pass: 1440x1000; title 1 line, photo-section heading 1 line; support copy 9 words/1 line(s); Capture visible at y=936-988; photo 304px high; no horizontal overflow.

## Section-layout-repetition audit

- Brand header: compact single wordmark row.
- Tonight page header: title/date stack with a functional location selector; it becomes one column on a phone.
- Outside now: two-column metric summary, one viewing note and source/update metadata.
- Photograph section: compact real image followed by one heading and one short paragraph.
- Discovery section: three open interactive object rows, a functional list rather than repeated feature-card sections.
- Photo attribution: one small real-source credit.
- Main navigation: one stable three-slot action/navigation row, intentionally shared across routes.
- Location sheet: native modal with an explicit permission action, one labeled search field and up to five result rows.
- Object sheet: icon/title, short explanation, local-data limitation, NASA source and return action.
- My Sky: title stack and simple centered empty state; no decorative card stack.
- Existing Upload: preserved single-column form and conditional analysis report; now uses the shared shell, 48px controls, high-contrast labels and progressive disclosure for technical analysis.

Pass for section variety in the new screens. Functional list cells and shared navigation intentionally repeat. No marketing sections were added merely to meet a layout-count example.

## Contrast calculations

- Pass: Primary action, #142034 on #B8D1F3, 10.46:1. Text pairs exceed 4.5:1; border/focus pairs exceed 3:1.
- Pass: Body on panel, #F1F3F7 on #161B24, 15.54:1. Text pairs exceed 4.5:1; border/focus pairs exceed 3:1.
- Pass: Muted text on panel, #ADB7C8 on #161B24, 8.54:1. Text pairs exceed 4.5:1; border/focus pairs exceed 3:1.
- Pass: Placeholder on input, #ADB7C8 on #0B0D12, 9.61:1. Text pairs exceed 4.5:1; border/focus pairs exceed 3:1.
- Pass: Focus ring on panel, #B8D1F3 on #161B24, 11.06:1. Text pairs exceed 4.5:1; border/focus pairs exceed 3:1.
- Pass: Input border on input, #71829A on #0B0D12, 4.96:1. Text pairs exceed 4.5:1; border/focus pairs exceed 3:1.

All observed new interactive targets are at least 44px high; city inputs use 16px text. Capture form, focus and empty-submit recovery were also reviewed. Successful backend result states remain unverified at runtime.

## Section 14 pre-flight

1. **Pass - Brief inference:** Design Read is declared for a calm, phone-first stargazing app for curious friends.
2. **Pass - Dial values:** Variance 5, motion 3, density 3 are explicit and match the compact information-first screen.
3. **Pass - Design system:** The custom web design is honestly labeled Sky Guide-inspired; no official Apple implementation is claimed.
4. **Pass - Redesign mode:** The original audit and screenshots are retained; the new visual direction and navigation are user-authorized.
5. **Fail - ZERO em-dashes (`-`) anywhere on the page.:** Authored web source and observed Tonight text contain zero banned dashes; the wider repository still contains 37 occurrences and generated photo-result text is unverified.
6. **Pass - Page Theme Lock:** New screens and sheets remain dark; no section inverts into a light theme.
7. **Pass - Color Consistency Lock:** All three routes share the same pale-blue primary actions and dark shell. Existing rarity and review colors are retained only as semantic analysis states, never competing navigation accents.
8. **Pass - Shape Consistency Lock:** Capture now uses the same 12px controls and 20px result container; compact 4px result badges and 8px file buttons are documented subordinate roles.
9. **Pass - Button Contrast Check:** Capture actions and the selected Capture tab use #142034 on #B8D1F3 (10.46:1). Low-contrast upload labels were raised to zinc-300 and focus outlines use the shared accent.
10. **Pass - CTA Button Wrap:** Capture, location and city-search labels stay on one line in tested desktop layouts; icon-only search has an accessible name.
11. **Pass - Form Contrast Check:** City and photo inputs have high-contrast boundaries, readable placeholders and visible focus. Capture inputs render at 16px, at least 48px high, with labeled invalid-state recovery.
12. **Pass - Serif discipline:** Rendered Tonight, My Sky and Upload typography is sans-serif; the old serif is no longer referenced by UI CSS.
13. **Pass - Premium-consumer palette check:** The palette is cool near-black, pale blue and neutral text, without beige/brass/oxblood defaults.
14. **Pass - Italic descender clearance:** No display text uses italic styling.
15. **Pass - Hero fits the viewport:** Tonight and the feature heading each fit one line; support copy is nine words, with Capture fully visible in fixed navigation at all four tested widths.
16. **Pass - Hero top padding:** The page title starts near the top; photo content no longer floats deep inside a tall image.
17. **Pass - Hero stack discipline:** The photo section contains only its real image, one heading and one short paragraph; Capture is shared navigation.
18. **Pass - EYEBROW COUNT (mechanical):** No uppercase tracked eyebrow appears above the new section headings.
19. **Pass - Split-Header Ban:** The right-hand desktop header content is an actionable location selector, not a floating explanatory paragraph.
20. **Pass - Zigzag Alternation Cap:** There is no sequence of repeating image/text zigzag sections.
21. **Pass - No Duplicate CTA Intent:** Tonight has one Capture action; My Sky reuses the identical Capture label for the same destination in its empty state and shared navigation.
22. **Pass - Logo wall = logo only:** No customer logo wall exists.
23. **Pass - Bento Background Diversity:** No bento grid exists; artificial decorative cells were not added.
24. **Pass - "Used by / Trusted by" logo wall:** No trusted-by or customer-logo strip exists.
25. **Fail - Copy Self-Audit:** All new static copy was reread and learning facts checked against NASA; existing AI photo-result copy still needs a full audit.
26. **Pass - Motion motivated:** Interaction feedback acknowledges controls; no automatic decorative motion, parallax or particle loops were added.
27. **Pass - Marquee max-one-per-page:** There is no marquee.
28. **Pass - Navigation on ONE line:** The three navigation slots fit one horizontal row with one-line labels and a height below 80px.
29. **Pass - Section-Layout-Repetition:** Current sections use a utility header, metric summary, image feature and interactive object list; repeated app rows/navigation are functional collections.
30. **Pass - Bento has rhythm AND exact cell count:** There are no bento cells or blank layout slots.
31. **Fail - Long lists use the right UI component:** New lists are bounded to three examples or five city results; model-generated lists are now contained in a scrollable disclosure, but their maximum size and large-result performance are not verified.
32. **Pass - Real images used:** The existing real night-sky photograph is used, credited and explicitly marked illustrative.
33. **Pass - No pills/labels overlaid on images:** No decorative tag or pill is placed over the new photograph; future functional sky annotations remain separately authorized.
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
46. **Pass - Content density:** Photo quality and critique details now sit behind a Photo details disclosure; raw data remains inside Technical details. Tonight stays compact and bounded.
47. **Pass - Quotes ≤ 3 lines:** There are no testimonial or quote blocks.
48. **Pass - Motion claimed = motion shown:** Motion is set to 3 and only short control feedback is claimed; no measured native frame rate is claimed.
49. **Pass - GSAP sticky-stack / horizontal-pan:** No GSAP stack, pinning or horizontal scroll hijack exists.
50. **Pass - No `window.addEventListener('scroll')`:** No window scroll listener or scroll-driven React state exists.
51. **Pass - Reduced motion:** Press scaling is removed under reduced motion and there are no spatial entrance or looping animations.
52. **Pass - Dark mode:** Dark-only is a user-authorized override and all new dark surfaces were viewed in the browser.
53. **Pass - Mobile collapse:** Explicit mobile CSS and browser checks at 320, 390, 768 and 1440px show no horizontal overflow.
54. **Pass - Viewport stability:** The new root/shell use 100dvh and the page does not use a fixed h-screen hero.
55. **Pass - `useEffect` animations:** Clock and refresh timers clean up, network requests abort, modal scroll state restores, and stale GPS callbacks are ignored.
56. **Pass - Empty / loading / error:** Weather loading/retry, city validation/loading/empty/error, permission-error handling and the collection empty state are implemented; native GPS is not yet physically verified.
57. **Pass - Cards omitted:** Only the condition group and real photograph use content containers; discovery entries are open rows and decorative photo-stack cards are removed.
58. **Pass - Icons:** All authored UI icons come from Radix Icons; SkyIcon no longer draws custom SVG paths.
59. **Pass - Motion:** Interactive behavior stays in the client TonightView leaf; no motion library or server-side animation component is present.
60. **Pass - No AI Tells:** No purple glow, serif display, floating glass navigation, decorative micro-labels or three equal feature-card columns remain in the new screen.
61. **Fail - Core Web Vitals:** Lighthouse and measured LCP, INP and CLS have not been run; successful builds and small assets alone are insufficient evidence.
62. **Pass - One design system:** The existing Next.js/Tailwind application and scoped CSS modules remain; Radix supplies icons only, not a competing component system.

## Verification

- Production build: passed on the final source.
- Type checking: web build TypeScript passed on final source; root workspace typecheck passed during this checkpoint.
- Web ESLint: passed on final source.
- HTTP validation: missing/invalid/out-of-range coordinates and too-short city queries return 400; valid weather/city requests return 200; an unknown city returns an empty list.
- Manual city UI: London selection changed coordinates, weather, daylight/night note and local update time. Berkeley search/selection also passed.
- Dialogs: city no-results messaging, focus retention while searching, Escape close, body scroll lock/restoration, return focus, Moon detail and NASA link were verified.
- Navigation: Tonight, My Sky, Capture to the existing upload form, and browser back were verified.
- Responsive: 320, 390, 768 and 1440px measured; final desktop and mobile screenshots inspected.
- Browser console: no warnings or errors observed.
- Limits: native phone GPS permissions, simulated network-outage UI, paid photo analysis, saving, local ephemerides and Lighthouse/Web Vitals remain unverified.

## Sources

- Weather fields and timestamps: https://open-meteo.com/en/docs
- City search: https://open-meteo.com/en/docs/geocoding-api
- Moon learning example: https://science.nasa.gov/moon/viewing-tips/
- Planet learning example: https://science.nasa.gov/skywatching/
- Constellation learning example: https://spaceplace.nasa.gov/constellations/en/
- Original 62-item rule source: https://github.com/Leonxlnx/taste-skill-classics/blob/main/skills/taste-skill-v2-experimental/SKILL.md

## Cross-reference verification update

This review uses Taste v2 as the governing design source, respecting the user brief wherever references disagree. It is an active-development code review, not a native-app or full accessibility certification.

### Sources and coverage

- [Taste v2 experimental](https://github.com/Leonxlnx/taste-skill-classics/blob/main/skills/taste-skill-v2-experimental/SKILL.md): all 62 Section 14 checks above, plus hero, dash and section-family audits.
- [Emil design engineering](https://github.com/emilkowalski/skills): focus, feedback, reduced motion, CSS animation cost and interaction cohesion; installed emil-design-eng instructions were reviewed.
- [Appllama](https://github.com/Appllama/appllama-skills): mobile navigation, touch sizes, sheets, safe areas and real-app reference conventions. Adapted to the existing phone-browser application; no native simulator certification is claimed.
- [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill): priority checks and pro-rules reference were reviewed for contrast, target sizes, labels, responsive layout and progressive disclosure. Its search database was not installed or executed.
- [Impeccable](https://github.com/pbakaus/impeccable): reviewed its skill and craft-floor reference for operative app simplicity, hierarchy, states and readable copy. Its binary detector and hooks were not installed or executed.
- [Awesome DESIGN.md](https://github.com/VoltAgent/awesome-design-md): checked the documented categories against the app design contract: theme, semantic palette, type, components, spacing, depth, guardrails and responsiveness. No unrelated brand template was imported.
- [Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines/blob/main/command.md): freshly fetched and checked against current source, with React best-practice review of the edited components.

### Resolved findings

| Before | After | Why |
| --- | --- | --- |
| upload/page.tsx: small form controls, zinc-500 labels, weak input focus | Shared 48px controls, 16px input text, brighter labels and explicit focus | Improves touch use and keyboard readability |
| upload/page.tsx: separate screen shell and button style | Shared Tonight / Capture / My Sky shell and action styling | Maintains a predictable app structure |
| YourSkyShell.tsx: Capture route lacked selected state | Explicit aria-current and selected Capture color rule | Announces the current destination and keeps icon/text contrast |
| upload/page.tsx: submit disabled before choosing a photo | Action validates, focuses image input and announces the error | Explains how to proceed instead of leaving an unexplained inactive action |
| upload/page.tsx: rubric and metrics exposed at once | Photo details and Technical details disclosures | Keeps the primary photo task simple |
| upload/page.tsx: animated rubric width | Static data bars | Avoids layout animation and unnecessary motion |
| TonightView.tsx: missing city field name and three-dot loading copy | Named input and consistent ellipsis | Improves form semantics and copy consistency |
| YourSky.module.css: 10px or 11px metadata | 12px metadata | Makes location, credits and navigation easier to read |
| layout.tsx: native browser surfaces could remain light | Dark color scheme, stable scrollbar gutter and fixed-nav scroll clearance | Aligns native inputs/scrollbars and helps focus stay clear of navigation |

### Fresh verification

- Final production build, TypeScript compilation, ESLint and git diff whitespace check passed after the fixes.
- Tonight had no horizontal overflow at 320x700, 390x844, 768x1024, 844x390 landscape and 1440x1000. Capture was checked at 320x700, 390x844, 844x390 and 1440x1000.
- Final hero measurements remain one line for both title and photo heading, nine words of support copy, and visible Capture navigation at every measured size.
- Capture file input measured about 70px high; text input about 48px; submit 48px; both inputs use 16px text.
- Empty submission focuses the image input and announces a recoverable error. Existing multipart image and optional claimed_target API fields are preserved.
- Native location and object dialogs, Escape close, return focus and body scroll restoration were checked. A native dialog can also allow focus to browser chrome; full screen-reader testing remains outstanding.
- Reduced-motion preference was emulated during responsive rendering; computed primary transform was none. The override was reset afterward. This does not certify animation frame rate or physical-phone accessibility settings.
- Tonight, Capture and My Sky navigation worked. Capture has its own browser title. No browser warnings or errors were observed.
- New source remains free of literal U+2013 and U+2014. Four strict pre-flight items remain Fail: wider-checkout/dynamic-text dash certification, generated copy review, unbounded backend-result lists and measured Core Web Vitals.

### Remaining limits

Physical phone camera/GPS permission behavior, 200% browser zoom/largest system text, screen-reader walkthrough, successful AI photo analysis and arbitrary long backend content remain unverified. No Lighthouse score or Core Web Vitals certification is claimed. My Sky saving, front/back capture, photo highlighting and local astronomical predictions are still upcoming work.

All code changes remain local on feat/ui. Nothing was committed, pushed or deployed by this review.
