# Third-party notices

The n8n logo files in panel/assets are unmodified official assets downloaded from https://guidelines.n8n.design/downloads/logo/lockup/ on November 10, 2026. The cover also uses the unmodified black symbol from https://guidelines.n8n.design/downloads/logo/symbol/n8n-symbol-black.svg. n8n and its logo remain the property of n8n GmbH. Their inclusion identifies the integration; it does not imply endorsement. This plugin does not redistribute n8n software or its editor.

Brand specification: https://guidelines.n8n.design/downloads/n8ndesign.md (v5, October 19, 2026). Pink accents and logo variants follow this user-requested specification; neutral surfaces and text follow Orca’s current theme. Custom n8n Baumer font files are not redistributed; the UI uses the installed family if available, with Orca's system font as fallback.

Runtime UI has no third-party JavaScript dependencies. Build and test dependencies are development-only and are excluded from the installable package.

Release PNGs use the official n8n Baumer variable fonts served by the brand portal, fetched into a temporary rendering cache. Font binaries, embedded-font HTML, and rasterizer dependencies are not redistributed in the plugin. The icon is an original automation lightning glyph; it does not approximate or replace an n8n logo. Listing screenshots use controlled sample workflows, as documented in assets/SCREENSHOTS.md.

Public API references: https://docs.n8n.io/connect/n8n-api/ and https://docs.n8n.io/connect/n8n-api/authentication/. Endpoints were verified against the temporary n8n 2.47.3 instance’s OpenAPI document. Licensing, Cloud entitlements, and API permissions remain governed by n8n. The Docker image runs separately and is excluded from this package.
