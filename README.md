# PR #2725 visual evidence

These screenshots compare production with the exact-head Vercel preview for
`peanut-ui` PR #2725 at commit `4f531377a9ebde4733dec5696fbda4fad3e4bb4a`.

- Viewport: 375 x 667 pixels.
- Capture date: 2026-08-18.
- `prod-*`: production before the hotfix.
- `preview-*`: exact-head preview after the hotfix.
- Safety: all routes are public. The files contain no authenticated state,
  customer data, credentials, or secrets. The visible `0x000...0dEaD` value is
  the standard public dead address.

| Check | Before | After |
| --- | --- | --- |
| Australia receive page, English | `prod-receive-australia-en-375x667.png` | `preview-receive-australia-en-375x667.png` |
| Australia receive page, Spanish (Latin America) | `prod-receive-australia-es419-375x667.png` | `preview-receive-australia-es419-375x667.png` |
| Australia receive page, Portuguese (Brazil) | `prod-receive-australia-ptbr-375x667.png` | `preview-receive-australia-ptbr-375x667.png` |
| Invalid path stays on the 404 surface | `prod-invalid-dashed-375x667.png` | `preview-invalid-dashed-375x667.png` |
| Valid catch-all address stays on the payment surface | `prod-valid-dead-address-375x667.png` | `preview-valid-dead-address-375x667.png` |

This orphan branch is temporary PR evidence. Delete it after the PR merges.
