# Publishing the clean repository to GitHub

The published repository is a clean snapshot with its own history. Personal saves, local session reports and the original development history are not included. Use a clone of this repository for the handoff, rather than pushing every branch from a private development archive.

## Before publishing

1. Update the clean `main` branch and confirm `git status --short` is empty.
2. Run `npm ci --ignore-scripts` and `npm run check`. Review new tracked files, commit metadata, asset notices and screenshots for private data or unrecorded third-party content.
3. Create an empty GitHub repository with the desired owner and visibility. Leave automatic README/license initialization off, because those files are already present.
4. Authenticate using your Git client or credential manager. Do not put a token in a remote URL, committed file or command example.

## Add GitHub as a second remote

Replace the placeholder owner in this example:

```sh
git remote add github https://github.com/YOUR_ACCOUNT/root.git
git push --set-upstream github main
```

The existing `origin` can continue to point at Gitea. Select individual reviewed topic branches or release tags explicitly if they should also be published. Avoid an indiscriminate mirror of a separate private archive.

README and contribution links are relative and need no host rewrite. The Ko-fi support link and GitHub funding file are already included. `.github/workflows/ci.yml` is prepared for GitHub Actions; inspect its actual run after publishing. No remote CI result is implied by a local test run, and no Gitea Actions runner is configured here.

Do not create a release tag or upload personal save exports as part of a hosting move. Independently reviewed release/version changes can follow afterward.
