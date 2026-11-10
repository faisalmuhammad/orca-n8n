# Changelog

## 0.2.0

- Use “n8n in Orca” consistently as the plugin name.
- Replace workflow publication badges with compact status dots. Tooltips appear on hover or keyboard focus, support Escape dismissal, and retain accessible status labels.
- Add a compact read-only workflow preview inside expanded cards, using stored node positions and connections. Parameters, credentials, and execution payloads remain excluded.
- Add preview zoom, drag-to-pan, keyboard navigation, and Fit controls, preserving the view across card collapse, filtering, and list refresh.

## 0.1.1

- Fix workflow navigation: different workflows open in separate tabs or splits, while reopening the same workflow focuses its existing tab without navigating away from unsaved changes.
- Match tabs by instance, base path, and workflow ID, preserving query parameters and execution views.
- Always open New Workflow in a fresh editor and keep API settings separate from workflow tabs.
- Add regression coverage for opening A, then B, then A again, instance isolation, and unsaved editors. Update the navigation documentation.

## 0.1.0

Initial release of n8n in Orca.

- Open your n8n instance in an Orca browser tab or split in the current workspace automatically. Reuse and focus an existing instance tab; no workspace selection is required.
- Guided local and n8n Cloud setup, optional API access, and safe connection removal.
- Browse workflows sorted by most recent update and filter publication states, with available node counts and update times.
- Expand a compact seven-day execution overview using n8n’s public insights API, with production counts, failures, failure rate, time saved, and average run time.
- Expand workflow cards to inspect available recent-run status and start time. Open is a separate action.
- Create workflows through the sidebar or command palette. Sidebar creation immediately refreshes the list after a successful editor launch.
- Manual refresh and configurable automatic refresh, including Off.
- Theme-aware surfaces, fading dotted cards, illustrated empty states, keyboard controls, and a compact version footer.
- Manifest-driven release automation creates version tags and GitHub releases after main passes validation; existing releases and tags are preserved.
- API keys stay in Orca’s OS-keyring-protected secrets storage. Only workflow and recent-run metadata reach the sidebar.

Requires Orca desktop 1.4.248+ and a separately running local n8n or supported n8n Cloud instance. One saved connection at a time. Workflow editing and execution remain in n8n; there is no custom workflow editor or + menu contribution.
