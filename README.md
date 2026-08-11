> A community plugin for [Voiden](https://github.com/VoidenHQ) — the developer-first API client.

# Voiden JWT Faker Plugin

Generate, customize, sign, decode, and copy JSON Web Tokens (JWTs) directly within Voiden for API authentication testing.

[![Release Plugin](https://github.com/Exudev/voiden-plugin-jwt-faker/actions/workflows/release.yml/badge.svg)](https://github.com/Exudev/voiden-plugin-jwt-faker/actions/workflows/release.yml)
[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/Exudev/voiden-plugin-jwt-faker/releases)

---

## ✨ Features

- **HMAC SHA Signing Algorithms**:
  - `HS256` (HMAC SHA-256)
  - `HS384` (HMAC SHA-384)
  - `HS512` (HMAC SHA-512)
  - `none` (Unsigned tokens for edge-case & vulnerability testing)
- **Editors & Helpers**:
  - **Live Header Editor**: Edit headers (`alg`, `typ`, `kid`, etc.) with JSON validation.
  - **Live Payload Editor**: Configure arbitrary claims (`sub`, `name`, `roles`, `iss`, `aud`, etc.).
  - **Quick Claim Shortcuts**: Add or update timestamps with one click:
    - `+1h exp` / `+1d exp` (Expiration time)
    - `iat` (Issued at current time)
    - `nbf` (Not before current time)
- **Decoder & Inspector**:
  - Live preview of encoded and decoded JWT components (Header, Payload, Signature).
- **Template Manager**:
  - Save and reuse customized claim configurations across requests and workspaces.
- **One-Click Copy**:
  - Instantly copy generated token directly to clipboard.

---

## 📦 Installation

### In Voiden
1. Open **Voiden**.
2. Navigate to **Extensions / Plugins** in the sidebar.
3. Search for **JWT Faker** in the Community tab and click **Install**.

---

## 🛠️ Development & Building

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build plugin bundle
npm run build
```

The build output will be generated into `dist/jwt-faker.js` alongside `manifest.json` and `changelog.json`.

---

## 📄 License

MIT © [Exudev](https://github.com/Exudev)
