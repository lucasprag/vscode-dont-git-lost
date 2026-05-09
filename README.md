# Git Lost

Step through any file's history without leaving the editor. Subdued inline blame. Rich hover. Lightweight.

## Features

### File time-travel

Two arrow buttons (◀ ▶) appear in the editor toolbar. Click ◀ to load the file as it was at the previous commit that touched it; click ▶ to step forward. The home button (⌂) returns you to the working copy. Status bar shows which commit is being viewed.

If the file has unsaved edits, the historical view opens in a side editor group so the dirty tab is preserved.

### Inline current-line blame

The line under the cursor is annotated at the end of the line:

```
Lucas, 11 years ago • First working version of cleaned-up production logs.
```

The format is configurable via `gitlost.blame.format`.

### Hover card

Hover over the blame annotation to reveal a card with:

- Author avatar (from GitHub/GitLab/Bitbucket)
- Full commit message
- Short SHA, absolute date, relative time
- Copy SHA, Open commit, Open PR buttons

## Settings

| Setting | Default | Description |
|---|---|---|
| `gitlost.blame.enabled` | `true` | Show the inline blame annotation |
| `gitlost.blame.format` | `${author}, ${ago} • ${message}` | Annotation template (tokens: `${author}`, `${ago}`, `${date}`, `${sha}`, `${message}`, `${pr}`) |
| `gitlost.blame.messageMaxLength` | `80` | Max chars of the commit message shown inline |
| `gitlost.timeTravel.enabled` | `true` | Show back/forward toolbar buttons |
| `gitlost.host.gitlabToken` | `""` | Personal access token for GitLab (scope: `read_api`) |
| `gitlost.host.bitbucketToken` | `""` | App password for Bitbucket (`username:apppassword`) |
| `gitlost.host.selfHosted` | `{}` | Self-hosted host overrides |

## License

MIT.
