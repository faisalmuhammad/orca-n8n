# Releasing n8n for Orca

Prepared version: **0.1.0**, tag **v0.1.0**.

## Repository content

Commit the manifest, compiled panel/, worker/, ui/, assets/, source, tests, build and release tooling, package files, documentation, licenses, and .github/ workflow. Orca installs the compiled files from the Git tag; users do not need npm. Publisher is derived from the repository owner.

Dependencies, runtime state, caches, browser reports, environment files, logs, and dist/ are ignored. **assets/social.png** is included for GitHub’s Social preview setting. GitHub releases use the tagged repository without attached archives.

## Verify

Use Node.js 22+, a compatible Chromium, and Orca desktop. From the plugin folder:

```sh
npm ci
orca plugin types . --json
npm run typecheck
npm run build
npm test
npm run test:browser
npm run release:check
orca plugin validate . --json
orca plugin check . --json
```

Set ORCA_CLI_COMMAND and N8N_BROWSER_EXECUTABLE when needed. Artwork is committed in assets/ and uses official logo assets and n8n’s v5 graphic-mode colors and typography. Brand fonts are not distributed. See [artwork provenance](assets/SCREENSHOTS.md) and [third-party notices](THIRD_PARTY_NOTICES.md).

The release-file check validates versions, required files, image dimensions and sizes, entry and package budgets, symlinks, accidental tracked dependencies, and sensitive local text. Browser tests use sample metadata and an Orca bridge fixture. See [compatibility](COMPATIBILITY.md) for supported connections and testing limits.

## GitHub setup

Enable Actions, add the **orca-plugin** topic, and select **assets/social.png** in Settings → General → Social preview.

The included workflow validates main, pull requests, and tags. After a successful push to main, it reads the version from **orca-plugin.json**, creates **v<version>** on the exact checked commit, and publishes a GitHub release with that version’s changelog notes. No archives are attached. Only the release job has **contents: write** access, using GitHub’s built-in token; a separate personal access token is unnecessary.

Pull requests and manual workflow runs only validate. Ordinary main pushes with an existing release leave it unchanged. Manual tag pushes remain supported, provided the version matches the manifest/package/lockfile/changelog and the commit is in main. Publication is serialized, existing tags are never moved, and rerunning a failed publication can reuse its matching tag. Authentication and network errors stop publication instead of being treated as a missing release.

For each release:

1. Set the new stable major.minor.patch version in **orca-plugin.json**.
2. Add a matching **## <version>** entry to **CHANGELOG.md**.
3. Prepare, build, and validate the release, then commit the resulting files and push or merge to main:

```sh
npm run release:prepare
npm run check
# Commit the prepared source, package metadata, docs, and runtime bundles.
git push origin main
```

**release:prepare** takes the version from the manifest and synchronizes package.json, both lockfile version fields, and the README/release installation references. It does not increment the version, invent release notes, push commits, or publish. The GitHub workflow performs publication after validation. Protected tag rules must allow the release token to create version tags.

The versioned install reference is:

```text
https://github.com/faisalmuhammad/orca-n8n#v0.1.0
```

After publication, generate an Orca catalog entry from the published commit with `orca plugin release-entry . --json`. Catalog submission is separate from GitHub release automation. Published tags must remain unchanged.
