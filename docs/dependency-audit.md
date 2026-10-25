# Dependency audit

The October 25, 2026 audit reports eight high-severity package entries in the existing AI SDK 4 dependency tree. Several entries propagate the same underlying advisories. This is not a clean dependency audit.

- The application does not use `ai/rsc`, jsondiffpatch HTML formatters, or its patch APIs. No application path to the reported HTML XSS or prototype pollution was identified.
- Sky schemas validate model output with a 6,000-token generation limit. Public request bodies do not directly reach those collection schemas.
- API request streams now have byte limits. Sky uploads accept validated JPEG/PNG bytes, not caller-selected URLs. Object-detail inputs are bounded and validated; provider errors are not returned verbatim.
- AI SDK provider response handlers still lack a shared response-byte limit. The application uses the fixed xAI endpoint; this remains an upstream resource-consumption risk.

Resolving the remaining advisories requires a separately tested SDK/Zod migration. Do not force incompatible transitive versions through package overrides.

References: [provider response limits](https://github.com/advisories/GHSA-866g-f22w-33x8), [file-type handling](https://github.com/advisories/GHSA-rwvc-j5jr-mgvh), [Zod collections](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5), [prototype pollution](https://github.com/advisories/GHSA-j4fx-xxwh-2485), [HTML formatter](https://github.com/advisories/GHSA-33vc-wfww-vjfv).
