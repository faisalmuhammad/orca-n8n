# Usage and architecture

Detailed behavior for n8n in Orca. For installation and a quick start, see the [README](../README.md).

## Sidebar and workflow actions

New n8n workflow is available in the sidebar and Orca’s command palette. It opens /workflow/new on the configured instance. After the sidebar creation action opens the editor successfully, the workflow list refreshes immediately when API access is configured, even with automatic refresh turned off. A new workflow appears in the list once it is saved in n8n and the list refreshes. Orca’s current documented API cannot place browser commands in the + menu.

The fixed header places the logo on the left and a compact custom connection dropdown and settings on the right. A status dot sits to the left of the connection name; its tooltip and accessible label convey connection status without a second text row. The dropdown shows the current instance address, Local/Cloud icons and setup choices, and layout/setup shortcuts. Settings and refresh use Command Center’s outline icons. One connection is saved at a time. New Workflow and Open n8n sit in a fixed action bar directly below the header. Soft shadows distinguish cards and controls from the surface, with a stronger shadow for floating dropdown menus.

The Workflows heading has its own manual refresh action, followed by search and a custom status dropdown. Loaded workflows are sorted by actual update time, newest first; missing or invalid update times appear last. Rounded workflow cards scroll independently while the header, action bar, and filters stay visible. Settings and onboarding cards, form fields, and action buttons use the same restrained elevation treatment. Subtle theme-derived borders define inputs, dropdowns, secondary buttons, and cards alongside surface contrast and shadows. Focus outlines and selected-step indicators remain visible. Dropdowns support mouse, arrow keys, Enter, Escape, and focus restoration. Layout takes inspiration from Command Center and Theme Studio while retaining the n8n palette and approved spacing.

The panel background, text, and muted labels follow Orca’s current theme tokens. Raised surfaces and hover colors derive from that background, including in custom light and dark themes. Each workflow card has a faint dotted texture across its full surface, fading from top to bottom. n8n pink accents and official logo variants remain in use.

Workflow cards show a workflow icon, a publication-status dot immediately left of Open, available node count and update time. Hover or focus the dot to show a tooltip with Published, Draft, Archived, or Unavailable; Escape dismisses it. The status also has an accessible label. Published uses a pink dot, Draft an outlined dot, Archived a muted filled dot, and Unavailable a dotted outline. Click a card or its name to expand or collapse recent-run details; the name also supports Enter and Space. Cards start collapsed, and expansion survives filtering and refresh for workflows still loaded. Open launches your n8n instance separately. Recent-run statuses remain plain text. Failed runs use an icon and a subtle pink surface; missing execution evidence reads No recent run. Exact timestamps are available through tooltips and accessible labels. Long names wrap to two lines, and the status dot and Open stay together at narrow sidebar widths. The worker projects node counts without exposing node parameters. Orca’s sidebar activity icon uses the supported lightning symbol for automation. The footer uses smaller text inside a rounded elevated panel, with the manifest version on its right.

Expanded cards also show a small read-only workflow preview when the API supplies node structure. The thumbnail preserves node positions and branch connections; auxiliary connections use dashed lines. Hover a node for its name and type. Use − and + to zoom up to 8×, drag to pan while zoomed, and Fit to show the whole graph again. Ctrl/Command + scroll also zooms; ordinary scrolling continues through the workflow list. With the preview focused, +/− zoom, arrow keys pan, and 0 or Home fits the graph. Zoom and pan stay in panel memory across collapse, filtering, and refresh. It is created only on expansion, makes no additional API requests, and does not edit or execute workflows. The worker projects at most 100 nodes and 200 connections, excluding parameters, credentials, pinned data, and execution payloads. Partial or incomplete previews are labeled; missing structure leaves the existing workflow metadata available.

Locally bundled workflow illustrations distinguish loading, missing API access, an empty instance, no filter matches, and connection failures. Empty states offer the relevant next action: connect the list, create a workflow, clear filters, or retry. A pending or failed request is never presented as a successful empty list.

After onboarding, View setup guide and Change connection or layout enter a preview. Checking another address or opening a preview does not save connection settings. Back to workflows restores the saved configuration and API-key access. Save setup applies the selected address and layout explicitly.

To remove a saved local or Cloud connection, open Connection settings → Delete connection. Review the instance address, then confirm or choose Keep connection. Deletion removes the stored connection, API key, and sidebar setup, clears loaded workflow metadata, stops polling, and returns to onboarding. It makes no n8n API requests and leaves the running instance and workflows available. A changed connection or a secure-storage failure prevents deletion and allows recovery.

Workflow lists refresh automatically every 30 seconds by default. Connection settings offers Off, 15/30 seconds, or 1/2/5 minutes. Refresh pauses while the panel is hidden, settings are open, or an input has focus. Manual refresh is available beside the Workflows heading. Refresh reloads the first workflow page; use Load more again for additional pages.

Open matches tabs by the configured instance, base path, and workflow ID in the current workspace. Reopening a workflow focuses its matching tab without navigating it, preserving unsaved changes and the current view. Different workflows open in separate tabs or splits. New Workflow always starts a fresh editor, while API settings reuse only their own settings tab. Open n8n can focus an existing instance tab without replacing its current view.

## Architecture and data

The sandboxed HTML sidebar sends typed requests to a trusted Node worker. The worker resolves the current local Orca workspace on every Open, New Workflow, and API settings action, then uses its exact identity for tab reuse and navigation. There is no workspace picker or saved workspace selection; legacy saved destinations are ignored. Editing, credential management, browser authentication, and manual execution remain in n8n’s official UI. JSON files use Orca’s existing source editor; this plugin does not synchronize them with n8n.

The worker reads documented GET /api/v1/workflows and GET /api/v1/executions endpoints with cursor pagination. It projects responses into workflow names, IDs, publication state, bounded preview topology, and recent run ID/status/time before returning data to the panel. Node parameters, credentials, pinned data, and execution payloads are excluded from the UI. Workflow responses may contain full node definitions in worker memory; projection retains only names, types, positions, and connection references for the preview. Sidebar metadata is held in memory, capped at 500 workflows, and cleared when changing connections.

Recent run means the newest available match in the latest 100 retained executions, not a guaranteed last execution. Execution permission failures do not hide workflows. Search and filtering apply to loaded pages; load more for additional results.

There is no custom workflow editor, editor iframe, local expression execution, separate agent runtime, deployment, or private n8n endpoint.

## Connection security

Local URLs accept HTTP/HTTPS on localhost, 127.0.0.1, or [::1]. Cloud URLs require HTTPS on an n8n.cloud subdomain and the default port. Credentials, query strings, and fragments in URLs are rejected; base paths are supported. Local requests pin loopback. Cloud requests validate DNS results and pin a public address while preserving TLS hostname verification. Authenticated redirects are refused; responses are bounded to 4 MiB and requests have a ten-second deadline including DNS.

API keys are bound to the normalized instance URL and stored through Orca’s secrets API only with OS-keyring protection. Changing connections removes the old key unless a replacement is supplied. Keys pass through the password input once on save; the worker never returns them or writes them to ordinary preferences or logs. Browser authentication stays in Orca’s native browser session.


## Appearance and compatibility

Official logo assets follow the [n8n brand guidelines](https://guidelines.n8n.design/). Neutral surfaces follow Orca’s active theme. Proprietary fonts are not distributed. See [third-party notices](../THIRD_PARTY_NOTICES.md) and [compatibility](../COMPATIBILITY.md) for supported connections and testing limits.

## Execution overview

Overview is collapsed by default. Expanding it loads five aggregate metrics directly from GET /api/v1/insights/summary for the last seven days: production executions, failures, failure rate, time saved, and average run time. It uses a compact responsive grid and a refresh icon in the header. Date boundaries and n8n provenance are available in the header tooltip. Automatic list refresh also refreshes an expanded overview. Collapsing it stops overview requests.

The endpoint requires insights:read and a supporting n8n version and plan. The worker validates count, ratio, minute, and millisecond units before returning numeric aggregates. Missing permissions or unavailable API support produce an unavailable state, never zero metrics. Connection changes and removal discard overview state. These are n8n-reported aggregates rather than estimates from the latest execution page.
