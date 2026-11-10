# Listing artwork provenance

The icon is an original automation lightning glyph, distinct from Orca’s Git branch icon. It is not an n8n logo approximation.

The cover uses a bold title, a tilted tile, a restrained glow, orbital rings, and a compact footer. It uses n8n’s official white-accent lockup and black symbol without modification, signature pink and Dark mode grays, Baumer display/mono type scales, a Local / Cloud capsule, and an 8px layout grid. The symbol comes from https://guidelines.n8n.design/downloads/logo/symbol/n8n-symbol-black.svg. Light listing artwork uses the official black-accent lockup and Light mode.

The cover title is “n8n in Orca” on one line, with “n8n” in signature pink and “in Orca” in white. The supporting copy describes opening your n8n instance beside your code. There are no Browser Tab or Integration labels. The Local / Cloud capsule describes connection options; the footer identifies an unofficial plugin. Listing screenshots describe sidebar status browsing.

The cover and four screenshots are 1600 × 1000 PNGs. Workflow and insights views each have light/dark variants. The icon is 512 × 512. The GitHub social preview is a separately composed 1280 × 640 PNG at assets/social.png. It uses the same single-line headline, pink type, and tile artwork. Its layout is rendered directly for the wide aspect ratio.

Screenshots use the compiled sidebar with the controlled Orca bridge in tests/browser/onboarding.spec.ts. Customer Onboarding and Daily Analytics, their workflow counts, publication states, and execution evidence are sample fixtures. The first card is expanded and the second collapsed. No live connection, API key, workflow parameters, or execution payload is used. Surrounding artwork is a presentation frame, not additional plugin UI or a custom workflow editor.

Browser tests generate controlled captures with npm run test:browser. Committed listing images were composed using Chromium and temporary official brand fonts. Fonts and temporary HTML are not distributed. Native Orca integration is validated separately; these captures do not claim a real Cloud account test.

Brand source: https://guidelines.n8n.design/downloads/n8ndesign.md (v5). Logo files are in src/panel/assets and retain their original SVG content. See THIRD_PARTY_NOTICES.md for ownership and font handling.

The insights previews use the fixture’s sample aggregate values: 12 production runs, 3 failures, 25% failure rate, 90 minutes saved, and 1.5 seconds average run time. They show the compact expanded overview; workflow previews keep it collapsed. No live instance metrics are used in listing artwork. The workspace picker has been removed; browser actions resolve the current workspace automatically.
