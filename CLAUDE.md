# LifeOS — working agreements

## Commits

**Never add a `Co-Authored-By:` trailer.** No agent/pair attribution lines of any kind
in commit messages. Every commit in this repo is authored and committed by
`kevinpatildxd`.

This is enforced — `.githooks/commit-msg` rejects any commit that carries a co-author
trailer or a different author/committer name. Enabled by `core.hooksPath=.githooks`,
which `npm install` sets up via the `prepare` script (`scripts/setup-hooks.mjs`).

## Platforms

Android and iOS are equal targets — neither is "first", and a feature is not done until it
works on both. Android is built and tested before iOS only because there's no iOS device on
hand right now; that's sequencing, not priority. Developed on Windows.

[ROADMAP.md](./ROADMAP.md) is the source of truth for what ships next — keep it current. See
[README.md](./README.md) for the build commands and [RELEASE.md](./RELEASE.md) for the
ship/OTA flow.

- No macOS-only tooling. Dev scripts live in `scripts/` and are plain Node ESM.
- iOS cannot be built locally on Windows — use `npm run build:preview` (EAS cloud).
- Anything platform-bound (deep links, notification channels, exact alarms) needs a
  `Platform.OS` branch and has to work on both.
- `npm run doctor` checks the local toolchain.
