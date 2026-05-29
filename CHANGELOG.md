# Changelog

## [0.1.1] - 2026-05-28

### Fixed
- Publish workflow now builds the `@lucasprag/vscode-license` dependency after checkout so esbuild can resolve it.

## [0.1.0] - 2026-05-08

### Added
- File time-travel: ◀ ▶ ⌂ buttons in the editor toolbar to step through commit history of the active file.
- Inline current-line blame annotation, configurable via `dontgitlost.blame.format`.
- Hover card with author avatar, commit URL, and PR link for GitHub, GitLab, and Bitbucket repos.
- Self-hosted host support via `dontgitlost.host.selfHosted` setting.
