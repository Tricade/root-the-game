# Build temporary directories

This original, dependency-free Node 24 provider replaces `temp` only for the reviewed `electron-winstaller` 5.4.0 build dependency. That consumer calls `track()` and `promisify(mkdir)('si-')`. The replacement uses `fs.mkdtemp` and removes its own tracked directories at process exit. It does not implement the general `temp` package's file, stream or affix-object APIs.

`package.json` uses a top-level local `file:` override so npm 11.19.1 and 12.2.1 resolve the link from the repository root. The package keeps its own name, `@root-network-os/build-temp`; it is not published or presented as an upstream `temp` release. No install script rewrites third-party source files. It is a development dependency and is excluded from desktop runtime packages.

Creation accepts a literal filename prefix and rejects path separators or traversal. Cleanup checks that every tracked absolute path remains below the original temporary root, uses literal paths, and removes a substituted symlink itself. It never recursively follows a link to another directory. Explicit `cleanupSync()` is also available for verification.

[tests/build-temp.test.cjs](../../../tests/build-temp.test.cjs) exercises the real installer consumer, unique creation, callback errors, exit cleanup and preservation of a link destination. A lockfile guard rejects new consumers until their API has been reviewed. The rest of the migration is documented in [dependencies.md](../../../docs/dependencies.md).

The implementation follows the [Node 24.22.1 filesystem APIs](https://github.com/nodejs/node/blob/v24.22.1/doc/api/fs.md). The reviewed consumer is [electron-winstaller 5.4.0's temp-utils](https://github.com/electron/windows-installer/blob/v5.4.0/src/temp-utils.ts). The code is covered by the repository's [MIT license](../../../LICENSE).
