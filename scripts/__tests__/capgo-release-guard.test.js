/** @jest-environment node */
const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { spawnSync } = require('node:child_process')
const ROOT = path.join(__dirname, '../..')
const SCRIPT = pathToFileURL(path.join(ROOT, 'scripts/capgo-release-guard.mjs')).href
const SHA = 'a'.repeat(40)
const MARKER = '[ota-floors: android=1.6.0 ios=1.5.0]'
const env = {
    CAPGO_APP_ID: 'me.peanut.wallet',
    CAPGO_API_KEY: 'test-key',
    VERSION: '1.6.3',
    FLOOR_ANDROID: '1.6.0',
    FLOOR_IOS: '1.5.0',
    NATIVE_FLOOR: '1.5.0',
    GITHUB_SHA: SHA,
}
const goodBundle = {
    app_id: env.CAPGO_APP_ID,
    name: '1.6.3',
    deleted: false,
    comment: `commit ${MARKER}`,
    minUpdateVersion: '1.5.0',
    link: `https://github.com/peanutprotocol/peanut-ui/commit/${SHA}`,
    checksum: 'signed-checksum',
    storage_provider: 'r2',
    r2_path: 'org/app/1.6.3.zip',
}
const candidate = {
    app_id: env.CAPGO_APP_ID,
    name: 'ota-candidate',
    public: false,
    allow_device_self_set: false,
    allow_emulator: false,
    allow_device: false,
    allow_dev: false,
    allow_prod: false,
}

// Exercise the actual ESM entry point with recorded HTTP responses. No API key,
// network or publication happens in these tests; unexpected requests fail.
function invoke(mode, responses, overrides = {}) {
    const driver = `
      import { run } from ${JSON.stringify(SCRIPT)};
      import { readFileSync } from 'node:fs';
      const input = JSON.parse(readFileSync(0, 'utf8'));
      const requests = [];
      try {
        const result = await run(input.mode, { env: input.env, fetchImpl: async (url, init) => {
          requests.push({ url: String(url), method: init.method, body: init.body && JSON.parse(init.body) });
          const response = input.responses.shift();
          if (!response) throw new Error('unexpected request');
          if (response.networkError) throw new Error('network failure');
          return { ok: !response.status || response.status === 200, status: response.status || 200,
            json: async () => { if (response.invalidJson) throw new Error('invalid JSON'); return response.body; } };
        }});
        console.log(JSON.stringify({ result, requests }));
      } catch (error) { console.log(JSON.stringify({ error: error.message, requests })); process.exitCode = 1; }
    `
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', driver], {
        input: JSON.stringify({ mode, env: { ...env, ...overrides }, responses }),
        encoding: 'utf8',
    })
    return { status: result.status, ...JSON.parse(result.stdout) }
}
function verify(rows, overrides) {
    return invoke('verify-bundle', [{ body: candidate }, { body: rows }], overrides)
}

it('verifies the exact structured bundle record', () => {
    expect(verify([goodBundle]).status).toBe(0)
    expect(verify({ data: [goodBundle] }).status).toBe(0)
})
it.each(['1.6.2', '1.6.30', '11.6.3', '1.6.3-rc1', '1.6.3.1'])(
    'cannot use %s even when its subject names the requested version',
    (name) => {
        const rows = [
            { ...goodBundle, name, comment: `fix 1.6.3 rollout ${MARKER}` },
            { ...goodBundle, comment: 'no floors' },
        ]
        expect(verify(rows).status).toBe(1)
    }
)
it.each([
    { comment: null },
    { comment: `${MARKER} trailing text` },
    { comment: '[ota-floors: android=1.5.0 ios=1.5.0]' },
    { minUpdateVersion: '1.4.0' },
    { app_id: 'wrong.app' },
    { deleted: true },
    { link: 'https://github.com/peanutprotocol/peanut-ui/commit/other' },
    { checksum: null },
    { storage_provider: 'supabase' },
    { r2_path: null },
])('refuses stale or incomplete artifact metadata: %j', (change) => {
    expect(verify([{ ...goodBundle, ...change }]).status).toBe(1)
})
it('rejects missing, ambiguous and malformed bundle records', () => {
    for (const response of [[], [goodBundle, goodBundle], { error: 'bad' }, 'CLI error 1.6.3']) {
        expect(verify(response).status).toBe(1)
    }
})
it('follows pagination using exact names', () => {
    const older = Array.from({ length: 50 }, (_, i) => ({ name: `1.6.${i + 100}`, comment: MARKER }))
    const result = invoke('verify-bundle', [{ body: candidate }, { body: older }, { body: [goodBundle] }])
    expect(result.status).toBe(0)
    expect(result.requests[2].url).toContain('page=1')
})
it.each([{ status: 401 }, { status: 500 }, { networkError: true }, { invalidJson: true }])(
    'fails closed on API failure: %j',
    (response) => {
        expect(invoke('verify-bundle', [{ body: candidate }, response]).status).toBe(1)
    }
)
it.each(['public', 'allow_device_self_set', 'allow_emulator', 'allow_device', 'allow_dev', 'allow_prod'])(
    'rejects a candidate channel with %s enabled',
    (field) => {
        const result = invoke('verify-bundle', [{ body: { ...candidate, [field]: true } }, { body: [goodBundle] }])
        expect(result.status).toBe(1)
        expect(result.requests).toHaveLength(1)
    }
)
it('prepares the disabled channel and reads the persisted settings back', () => {
    const result = invoke('prepare-candidate', [{ body: { status: 'success' } }, { body: candidate }])
    expect(result.status).toBe(0)
    expect(result.requests[0].body).toMatchObject({
        ...Object.fromEntries(Object.entries(candidate).filter(([key]) => key !== 'name')),
        channel: 'ota-candidate',
        ios: false,
        android: false,
        electron: false,
        rolloutEnabled: false,
    })
    expect(result.requests[1].method).toBe('GET')
})
it('rejects preparation when the server did not persist the audience restrictions', () => {
    expect(invoke('prepare-candidate', [{ body: {} }, { body: { ...candidate, allow_prod: true } }]).status).toBe(1)
})
it('reads the production version field without matching versions in arbitrary text', () => {
    const production = {
        app_id: env.CAPGO_APP_ID,
        name: 'production',
        version: { name: '1.6.2' },
        rolloutEnabled: false,
    }
    expect(invoke('current-version', [{ body: production }]).result).toBe('1.6.2')
    expect(
        invoke('current-version', [{ body: { ...production, version: null, comment: 'version 1.6.2' } }]).status
    ).toBe(1)
})
it('rejects an active or unverifiable production rollout during preflight', () => {
    const production = { app_id: env.CAPGO_APP_ID, name: 'production', version: { name: '1.6.2' } }
    for (const rolloutEnabled of [true, undefined]) {
        const result = invoke('current-version', [{ body: { ...production, rolloutEnabled } }])
        expect(result.status).toBe(1)
        expect(result.error).toContain('rollout')
        expect(result.requests).toHaveLength(1)
    }
})
it('verifies production and the promoted artifact, and rejects an active alternate rollout', () => {
    const production = {
        app_id: env.CAPGO_APP_ID,
        name: 'production',
        version: { name: '1.6.3' },
        rolloutEnabled: false,
    }
    expect(invoke('verify-production', [{ body: production }, { body: [goodBundle] }]).status).toBe(0)
    for (const change of [{ rolloutEnabled: true }, { version: { name: '1.6.2' } }]) {
        expect(invoke('verify-production', [{ body: { ...production, ...change } }]).status).toBe(1)
    }
})
it.each([{ FLOOR_ANDROID: '2.1.0' }, { FLOOR_IOS: '1.7.0' }, { NATIVE_FLOOR: '1.6.0' }, { FLOOR_IOS: '1.5.1' }])(
    'rejects invalid floor expectations: %j',
    (overrides) => {
        expect(verify([goodBundle], overrides).status).toBe(1)
    }
)
it('keeps production promotion after successful verification and upload isolated', () => {
    const source = fs.readFileSync(path.join(ROOT, '.github/workflows/release-ota.yml'), 'utf8')
    const upload = source.slice(source.indexOf('- name: Upload bundle'), source.indexOf('- name: Verify the floors'))
    expect(upload).toContain('CHANNEL: ota-candidate')
    expect(upload).toContain('--channel "$CHANNEL"')
    expect(upload).not.toMatch(/^\s+--version-exists-ok\b/m)
    expect(upload).toContain('--link "https://github.com/peanutprotocol/peanut-ui/commit/$GITHUB_SHA"')
    const prepare = source.indexOf('node scripts/capgo-release-guard.mjs prepare-candidate')
    const preflight = source.indexOf('node scripts/capgo-release-guard.mjs current-version')
    const verify = source.indexOf('node scripts/capgo-release-guard.mjs verify-bundle')
    const promote = source.indexOf('channel set production')
    expect(preflight).toBeLessThan(source.indexOf('- name: Upload bundle'))
    expect(prepare).toBeLessThan(source.indexOf('- name: Upload bundle'))
    expect(verify).toBeLessThan(promote)
    expect(source.slice(verify, promote)).not.toMatch(/continue-on-error|always\(\)/)
    expect(source).toContain('CAPGO_APP_ID: me.peanut.wallet')
    expect(fs.readFileSync(path.join(ROOT, 'capacitor.config.ts'), 'utf8')).toContain("appId: 'me.peanut.wallet'")
})
