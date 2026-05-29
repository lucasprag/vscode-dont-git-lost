# Changelog

## [0.1.5] - 2026-05-28

### Fixed
- Use live Polar credentials in production and sandbox credentials in development (automatic switching based on extension mode)

## [0.1.4] - 2026-05-28

### Changed
- Test release to verify the publish workflow works end-to-end with the public vscode-license repo.

## [0.1.3] - 2026-05-28

### Fixed
- Publish workflow clones vscode-license without a token since the repo is public, removing the authentication failure.

## [0.1.2] - 2026-05-28

### Fixed
- Publish workflow now uses `git clone` instead of `actions/checkout` for the vscode-license dependency to avoid the path-outside-workspace restriction.

## [0.1.1] - 2026-05-28

### Fixed
- Publish workflow now builds the `@lucasprag/vscode-license` dependency after checkout so esbuild can resolve it.

## [0.1.0] - 2026-05-08

### Added
- File time-travel: ◀ ▶ ⌂ buttons in the editor toolbar to step through commit history of the active file.
- Inline current-line blame annotation, configurable via `dontgitlost.blame.format`.
- Hover card with author avatar, commit URL, and PR link for GitHub, GitLab, and Bitbucket repos.
- Self-hosted host support via `dontgitlost.host.selfHosted` setting.
