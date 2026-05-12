# Don't Git Lost

**Step through any file's history without leaving the editor.**

A focused, lightweight git-history tool for VS Code. Three small features that answer the question: *what happened to this file before now?*

> Screenshots and GIFs coming soon.

---

## What it does

- **Walk through commits** that touched the file you're looking at — without ever opening the terminal
- **See who wrote each line** with a subdued blame annotation that follows your cursor
- **Get the full story on hover** — author photo, full commit message, links to the commit and PR
- **Review what changed** in any past commit with a real green/red diff view

---

## Features

### Time-travel through your file's history

Five buttons in the editor toolbar let you step through every commit that touched the active file:

- ← previous version, with green/red gutter overlay showing what that commit changed
- ‹ previous version in a side-by-side diff editor
- › next version in a diff editor
- → next version with gutter overlay
- ⌂ return to the current working copy

Each navigation **updates the same tab in place** — no tab pile-up. The status bar shows which commit you're viewing.

### Inline blame for the current line

The line where your cursor sits is annotated at the end of the line:

```
Jane Doe, 11 years ago • First working version of cleaned-up production logs.
```

- Updates as you move the cursor (debounced)
- Hides on uncommitted lines
- Format is fully configurable

### Rich commit hover card

Hover the blame annotation to reveal a card with:

- Author photo (from GitHub, GitLab, or Bitbucket)
- Full multi-line commit message
- Short SHA, absolute date, and relative time
- **Copy SHA** to clipboard
- **Open commit** in your browser
- **Open PR** that introduced the change (when available)

Works out of the box with public repos. For private repos, sign in once via VS Code's GitHub account or paste a GitLab/Bitbucket token in settings.

---

## Why this exists

GitLens is great but heavy. **Don't Git Lost** focuses on the time-travel workflow: walking back through a file's history, understanding what changed, and getting back to work. That's it.

- Small bundle, fast activation
- No feature gating, no telemetry
- Open source

---

## Settings

| Setting | Default | What it does |
|---|---|---|
| `dontgitlost.blame.enabled` | `true` | Show the inline blame annotation |
| `dontgitlost.blame.format` | `${author}, ${ago} • ${message}` | Annotation template (`${author}`, `${ago}`, `${date}`, `${sha}`, `${message}`, `${pr}`) |
| `dontgitlost.blame.messageMaxLength` | `80` | Max characters of the commit message shown inline |
| `dontgitlost.timeTravel.enabled` | `true` | Show back/forward toolbar buttons |
| `dontgitlost.host.gitlabToken` | `""` | GitLab personal access token (scope: `read_api`) |
| `dontgitlost.host.bitbucketToken` | `""` | Bitbucket app password (`username:apppassword`) |
| `dontgitlost.host.selfHosted` | `{}` | Map of self-hosted hosts (GitHub Enterprise, self-hosted GitLab, etc.) |

---

## Free to use — supported by you

**Don't Git Lost is free.** It's MIT-licensed and fully functional out of the box, with no feature gating.

After a 14-day grace period, a polite popup appears about once a month asking you to support continued development with a **one-time license purchase**:

- One-time payment, lifetime use, unlimited devices
- One license stops the popup permanently
- Your license helps fund bug fixes, VS Code API updates, and new features

The cadence is intentional: this model **relies on long-term value building, not short-term annoyance**. If the extension is genuinely useful to you, you'll feel like supporting it. If it isn't, you've lost nothing — keep using it for free.

If you find Don't Git Lost useful in your daily work, please consider buying a license — it's the only way the project stays maintained.

---

## License

[MIT](LICENSE).
