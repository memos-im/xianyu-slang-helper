# Notes for Chrome Web Store Reviewer

This document explains design choices that may catch a reviewer's attention. Please read before reviewing.

## What this extension does (one sentence)
A slang-dictionary helper that highlights and decodes the coded jargon Chinese sellers commonly use on the Xianyu (Goofish) second-hand marketplace, and suggests those slang variants in the platform's search input.

## About the encrypted dictionary file (`data/dictionary.enc.json`)

The bundled dictionary is encrypted with **AES-256-GCM**. Please note:

1. **This is data, not code.** The encrypted blob is a static word list (Chinese slang ↔ plain Chinese). It is never executed; it is only used as a lookup table.

2. **The key is in plain sight.** Look at `data/crypto.js` — the very first non-comment line:
   ```js
   const PASSPHRASE = "xy-slang|@goofish|_v2_helper";
   ```
   We deliberately did **not** obfuscate the key. The encryption is only to deter casual web scrapers from `curl + grep`-ing the dictionary file. Anyone (including you) can read `crypto.js`, derive the AES key with the same `PBKDF2-SHA256, 100,000 rounds, salt 9f3a82b1e7c4d605a8f29b1c4d7e0a36` parameters, and decrypt the file.

3. **The plaintext is publicly available** in the project's public source repository at `tools/dictionary.source.json`. If you want to inspect the dictionary contents without decrypting, that file is the same source. (We exclude it from the published package only to keep the package small.)

4. **No remote loading.** The dictionary file is bundled in the extension package. There is no fetching, no auto-update via remote URL, no dynamic code execution. All updates ship as new versions of the extension itself, reviewed by Chrome Web Store.

## Verifying the decryption (optional)

To independently decrypt `data/dictionary.enc.json` outside the browser, run this Node.js script:

```js
import { readFileSync } from "node:fs";
import { pbkdf2Sync, createDecipheriv } from "node:crypto";

const PASSPHRASE = "xy-slang|@goofish|_v2_helper";
const SALT = Buffer.from("9f3a82b1e7c4d605a8f29b1c4d7e0a36", "hex");
const key = pbkdf2Sync(PASSPHRASE, SALT, 100000, 32, "sha256");

const enc = JSON.parse(readFileSync("data/dictionary.enc.json", "utf8"));
const iv = Buffer.from(enc.iv, "base64");
const combined = Buffer.from(enc.ct, "base64");
const ct = combined.slice(0, combined.length - 16);
const tag = combined.slice(combined.length - 16);

const dec = createDecipheriv("aes-256-gcm", key, iv);
dec.setAuthTag(tag);
const plain = Buffer.concat([dec.update(ct), dec.final()]).toString("utf8");
console.log(JSON.parse(plain));
```

Output: a `{ categories: [...] }` JSON object with 15 categories of ~159 slang entries.

## About Chrome Built-in AI (Prompt API)

The extension calls `LanguageModel.create()` and `LanguageModel.promptStreaming()` from the stable Chrome Built-in AI Prompt API (available since Chrome 148). This is:
- Strictly opt-in (the user must click a "Try AI" button in the popup; never automatic)
- Strictly on-device (uses Gemini Nano, no network)
- Only invoked from the extension popup (never from content scripts or background)

The AI is used as a fallback only when the bundled dictionary has no match for the user's query. The AI prompt includes a few sample entries from the dictionary as style context.

## Data collection

**Zero.** Verifiable:
- No `fetch()` to any external host (only `chrome.runtime.getURL(...)` for own files)
- No `XMLHttpRequest`, no WebSocket, no `sendBeacon`
- No `chrome.storage.sync` usage (only `chrome.storage.local`, which never leaves the device)
- No analytics SDK, no tracking pixel

The only stored items are:
- `decodeEnabled`: boolean (highlight on/off toggle)
- `customDict`: optional user-added slang entries (entered manually via popup UI)

## Permissions

| Permission | Justification |
|------------|---------------|
| `storage` | Persist `decodeEnabled` and user's custom dictionary locally |
| `activeTab` | Allow popup to read currently-focused tab when applying setting changes |
| Host: `*.goofish.com`, `*.xianyu.com`, `2.taobao.com` | The slang dictionary is exclusively useful on Xianyu. Extension is inert on any other site. |

No `<all_urls>`. No remote-host permissions. No `webRequest`, `tabs`, `cookies`, `history`.

## Source code

This extension is open source. Full source, including the plaintext dictionary, is at:
**https://github.com/memos-im/xianyu-slang-helper**

Tagged release `v1.6.0` matches the submitted package byte-for-byte (except for the encrypted dictionary which is regenerated at build time with a fresh random IV).

## Contact

Questions during review: **help@memos.im**
