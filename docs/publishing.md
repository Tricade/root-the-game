# Publishing the clean repository to GitHub

The published repository is a clean snapshot with its own history. Personal saves, local session reports and the original development history are not included. Use a clone of this repository for the handoff, rather than pushing every branch from a private development archive.

## Before publishing

1. Update the clean `main` branch and confirm `git status --short` is empty.
2. Run `npm ci --ignore-scripts` and `npm run check`. Review new tracked files, commit metadata, asset notices and screenshots for private data or unrecorded third-party content.
3. Create an empty GitHub repository with the desired owner and visibility. Leave automatic README/license initialization off, because those files are already present.
4. Authenticate using your Git client or credential manager. Do not put a token in a remote URL, committed file or command example.

## Privacy and commit identity

Review the history as well as the current files. A clean working tree does not prove that earlier commits are free of personal data. The original publication commits use a neutral project identity; the private development archive remains separate.

For the Tricade maintainer checkout, use the public handle and GitHub-provided noreply address locally:

```sh
git config --local user.name Tricade
git config --local user.email 6281655+Tricade@users.noreply.github.com
git config --local user.useConfigOnly true
git var GIT_AUTHOR_IDENT
git var GIT_COMMITTER_IDENT
```

Other contributors should use their own chosen public identity and noreply address. Configuration applies to future commits; it does not change existing author or committer records. Author/committer configuration and environment variables can override the `user` settings, so inspect both identities before committing. See the [GitHub email privacy reference](https://docs.github.com/en/account-and-profile/reference/email-addresses-reference).

Before the hosting move, fetch the branches and tags intended for publication into a fresh clone. Inspect raw author/committer records and commit messages with `git log --all --format=fuller`, check historical files and asset metadata for local paths or private data, and run a local secret scan. Gitleaks **8.30.1** supports `gitleaks git --redact --no-banner .` to scan reachable history across local refs. Also scan a tracked-file export with `gitleaks dir --redact --no-banner EXPORT_DIRECTORY`; keep the export and reports outside the repository. The [matching Gitleaks documentation](https://github.com/gitleaks/gitleaks/tree/v8.30.1) describes the scanner and its limits. Automated scans supplement manual review and do not guarantee the absence of every possible secret.

Personal saves, generated logs and local tools must remain untracked. Keep third-party license notices intact. Do not upload a working directory or `.git` backup as an archive; publish reviewed branches through Git. A push from the separate private development archive has not passed this review.

## Add GitHub as a second remote

Replace the placeholder owner in this example:

```sh
git remote add github https://github.com/YOUR_ACCOUNT/root-network-os.git
git push --set-upstream github main
```

The existing `origin` can continue to point at Gitea. Select individual reviewed topic branches or release tags explicitly if they should also be published. Avoid an indiscriminate mirror of a separate private archive.

README and contribution links are relative and need no host rewrite. The Ko-fi support link and GitHub funding file are already included. `.github/workflows/ci.yml` is prepared for GitHub Actions; inspect its actual run after publishing. No remote CI result is implied by a local test run, and no Gitea Actions runner is configured here.

Do not create a release tag or upload personal save exports as part of a hosting move. Independently reviewed release/version changes can follow afterward.
