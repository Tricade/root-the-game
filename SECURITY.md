# Security and private data

ROOT is a local, single-user simulation. The server listens on `127.0.0.1`; it has no account system and is not intended to be exposed directly to the internet or a shared network. Keep the loopback binding when developing.

Saves, backups, custom names, browser view state and logs can contain private information. Do not attach real save exports, `.env` files, credentials or unredacted logs to public issues. Reproduce defects with a fresh, synthetic save whenever possible.

For a potential vulnerability, use a private advisory on the repository host if available, or contact a maintainer through that host's private reporting mechanism. Do not publish credentials or an exploitable private installation in a public issue. There is no separate support mailbox or hosted service.
