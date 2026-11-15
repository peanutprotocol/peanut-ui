import test from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeDiagnostics, wranglerMessages } from './deploy-diagnostics.mjs'

// Deterministic bounded property sweep: 256 credentials, seed 0x3912.
test('seeded credentials remain redacted in literal, JSON and URL-encoded diagnostics', () => {
    let seed = 0x3912
    for (let index = 0; index < 256; index++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
        const credential = `credential-${seed.toString(16)}-${['+/=!?', 'üñïçødé', '"quoted"', '[a-z].*'][index % 4]}`
        const forms = [credential, encodeURIComponent(credential), JSON.stringify(credential).slice(1, -1)]
        const output = sanitizeDiagnostics(`D1 migration failed [code: 10021]\n${forms.join('\n')}`, {
            CLOUDFLARE_API_TOKEN: credential,
        })
        for (const form of forms) assert.ok(!output.includes(form), `seed=0x3912 case=${index}`)
        assert.match(output, /D1 migration failed \[code: 10021\]/)
    }
})

test('all private debug records are consumed without exposing nested user-facing record headers', () => {
    const log = `
--- 2026-11-03T00:00:00.000Z debug
HTTP body containing
--- 2026-11-03T00:00:00.001Z log
private body must stay private
---

--- 2026-11-03T00:00:00.002Z log
D1 request failed [code: 10000]
---
`
    const output = wranglerMessages(log)
    assert.match(output, /10000/)
    assert.doesNotMatch(output, /private body|HTTP body/)
})

test('credential labels redact private and authentication keys absent from the environment', () => {
    const output = sanitizeDiagnostics('private_key=unconfigured-private-value x-auth-key: unconfigured-auth-value', {})
    assert.doesNotMatch(output, /unconfigured-private-value|unconfigured-auth-value/)
})
