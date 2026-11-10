# Compatibility

Validated November 10, 2026 with Orca desktop and n8n 2.47.3.

Orca host API 1.x supplies worker requests, storage, and secrets. With no browser-tab-open plugin API, the worker uses the documented CLI: worktree ps --json and tab create --url ... --environment local --worktree ... --json, optionally --split right or --split down. The CLI must be installed and reachable. The manifest minimum is Orca 1.4.248; earlier hosts have not been separately certified.

Orca’s + menu newFiles contribution creates untitled source files; it has no browser-command contribution. New n8n workflow is a palette command and sidebar action.

Only local desktop worker destinations are supported. Local n8n accepts loopback URLs; n8n Cloud accepts HTTPS n8n.cloud subdomains. Remote self-hosted URLs, multiple saved profiles, SSH/server/WSL workers, and Cloud custom domains are outside this version. HTTPS certificates must validate normally.

Browser use needs no API key. Local readiness uses healthz. Cloud without a key is configured, not verified; with a key the worker tests the public API. Sidebar discovery requires public API availability and workflow:list access. Overview requires insights:read and the public insights summary endpoint. Optional recent-run metadata requires execution:list and retained executions. Cloud API access is unavailable during the free trial. Plans, permissions, and installed versions can limit metadata.

The n8n 2.47.3 public API schema documents workflow listing, cursor pagination, publication/archive metadata, and execution listing with includeData=false. It contains no general manual workflow-run endpoint. The sidebar exposes Open; execution remains in your n8n instance. The plugin does not use private frontend endpoints or substitute evaluation/retry endpoints for general runs.

There is no workspace picker. The sidebar and palette use the current local workspace automatically, and legacy saved workspace selections are ignored. A missing or ambiguous active local workspace produces a recoverable error before creating a tab.

The documented GET /api/v1/insights/summary returns total, failed, failureRate, timeSaved (minutes), and averageRunTime (milliseconds), with ISO startDate/endDate filters. The sidebar requests a seven-day range and preserves API units. Availability depends on instance version, plan, and insights:read scope; errors do not hide workflows or display invented zero aggregates.

State adapters accept activeVersionId, legacy active flags, and isArchived. Missing state yields Unavailable. Recent run is bounded to the latest retained execution page, not a guaranteed last run per workflow, and appears inside an expanded card. Automatic refresh defaults to 30 seconds and is configurable or disabled. It reloads the first page and pauses while hidden, typing, or configuring settings.

Workflow previews require node structure in the workflow-list response. The worker projects at most 100 nodes and 200 connections, excluding parameters, credentials, pinned data, and execution payloads. Unsupported types use generic icons; incomplete previews are labeled Partial. Missing structure leaves the workflow metadata available. Zoom and pan are local viewing controls and do not edit workflows or make extra API requests.

Workflow actions resolve the current local workspace at click time and list tabs in that exact destination. Tabs match by instance, base path, and workflow ID; reopening a workflow focuses its matching tab with tab switch --page ... --focus, preserving query parameters and execution views. A different workflow opens in a separate tab/split. New Workflow always creates a fresh editor, and API settings reuse only their own route. Open n8n can focus an existing instance tab without navigating it. CLI launches are not automatically retried.

API keys require Orca OS-keyring protection; unavailable secure storage fails closed. Local API access was verified for workflow and execution metadata. Cloud transport and metadata are tested with controlled fixtures; a real Cloud account has not been used for live validation.

The plugin does not redistribute n8n’s editor, synchronize source JSON, launch n8n processes, run expressions, deploy or activate workflows, or start agents. Official logos remain unchanged; proprietary fonts are not bundled.
