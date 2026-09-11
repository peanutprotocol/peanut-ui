/** @jest-environment node */
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { pathToFileURL } = require('node:url')
const { spawnSync } = require('node:child_process')
const ROOT = path.join(__dirname, '../..')
const SCRIPT = pathToFileURL(path.join(ROOT, 'scripts/capgo-release-guard.mjs')).href
const SHA = 'a'.repeat(40)
const MARKER = '[ota-floors: android=1.6.0 ios=1.5.0]'
const env = {
    CAPGO_APP_ID: 'me.peanut.wallet',
    CAPGO_API_KEY: 'test-key',
    VERSION: '1.6.3-ios',
    PLATFORM: 'ios',
    FLOOR_ANDROID: '1.6.0',
    FLOOR_IOS: '1.5.0',
    NATIVE_FLOOR: '1.5.0',
    GITHUB_SHA: SHA,
}
const goodBundle = {
    app_id: env.CAPGO_APP_ID,
    name: '1.6.3-ios',
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
    rolloutEnabled: false,
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
          let response = input.responses.shift();
          if (response?.routes) response = response.routes[new URL(url).pathname];
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
it('prepares the disabled channel, clears a partial bundle and reads the settings back', () => {
    const result = invoke('prepare-candidate', [
        { body: { status: 'success' } },
        { body: candidate },
        { body: app },
        { body: config },
        { body: [...channels, candidatePolicy()] },
    ])
    expect(result.status).toBe(0)
    expect(result.requests[0].body).toMatchObject({
        ...Object.fromEntries(Object.entries(candidate).filter(([key]) => key !== 'name')),
        channel: 'ota-candidate',
        version: 'builtin',
        ios: false,
        android: false,
        electron: false,
        rolloutEnabled: false,
    })
    expect(result.requests[1].method).toBe('GET')
    expect(result.requests.slice(2).every((request) => request.method === 'GET')).toBe(true)
})
it('rejects preparation when the server did not persist the audience restrictions', () => {
    expect(invoke('prepare-candidate', [{ body: {} }, { body: { ...candidate, allow_prod: true } }]).status).toBe(1)
})

const app = { app_id: env.CAPGO_APP_ID, expose_metadata: true }
const config = { supaHost: 'https://sb.capgo.app', supaKey: 'public-anon-key' }
const channelPolicy = (platform, version = 'builtin') => ({
    app_id: env.CAPGO_APP_ID,
    name: `${platform}-mobile-release`,
    public: true,
    ios: platform === 'ios',
    android: platform === 'android',
    electron: false,
    disable_auto_update: 'version_number',
    disable_auto_update_under_native: true,
    allow_device_self_set: false,
    allow_prod: true,
    allow_device: true,
    rollout_enabled: false,
    version_id: version === 'builtin' ? null : 42,
    version: version === 'builtin' ? null : { id: 42, name: version },
})
const candidatePolicy = (version = 'builtin') => ({
    ...channelPolicy('ios', version),
    name: 'ota-candidate',
    public: false,
    ios: false,
    allow_prod: false,
    allow_device: false,
})
const channels = [channelPolicy('ios'), channelPolicy('android')]
const policyResponses = (rows = channels) => [{ body: app }, { body: config }, { body: rows }]

it('stops before upload when Capgo did not clear the partial candidate bundle', () => {
    const result = invoke('prepare-candidate', [
        { body: { status: 'success' } },
        { body: candidate },
        ...policyResponses([...channels, candidatePolicy('1.6.3-ios')]),
    ])
    expect(result.status).toBe(1)
    expect(result.error).toBe('candidate channel must be reset to builtin')
})

// Capgo routes GET /app to getAll(), regardless of an app_id query.
// Only GET /app/:id returns the single app required by the metadata check.
it('resolves a release through the app-specific endpoint when the app list is enabled', () => {
    const result = invoke('current-release', [
        { routes: { '/app': { body: [app] }, [`/app/${env.CAPGO_APP_ID}`]: { body: app } } },
        { body: config },
        { body: channels },
        { body: [] },
    ])
    expect(result.status).toBe(0)
    expect(result.result).toBe('builtin')
    expect(new URL(result.requests[0].url).pathname).toBe(`/app/${env.CAPGO_APP_ID}`)
    expect(result.requests.every((request) => request.method === 'GET')).toBe(true)
})
it.each([{ body: [app] }, { body: { ...app, app_id: 'another.app' } }, { body: null }])(
    'identifies an invalid app response separately from disabled metadata: %j',
    ({ body }) => {
        const result = invoke('verify-promotion', [{ body }])
        expect(result.status).toBe(1)
        expect(result.error).toBe('Capgo app response does not match the requested app')
        expect(result.requests).toHaveLength(1)
    }
)

it('reads builtin as a legitimate starting state, but rejects a missing version', () => {
    expect(invoke('current-version', policyResponses()).result).toBe('builtin')
    expect(
        invoke('current-version', policyResponses([{ ...channels[0], version_id: 42, version: null }, channels[1]]))
            .status
    ).toBe(1)
})
it.each([
    { version_id: undefined, version: null },
    { version_id: null, version: { id: 42, name: '1.6.2-ios' } },
    { version_id: 42, version: null },
    { version_id: 42, version: { id: 41, name: '1.6.2-ios' } },
    { version_id: 42, version: { id: 42, name: 'invalid' } },
])('rejects an inconsistent channel version response: %j', (change) => {
    expect(invoke('current-version', policyResponses([{ ...channels[0], ...change }, channels[1]])).status).toBe(1)
})
it.each([
    { android: true },
    { ios: false },
    { electron: true },
    { public: false },
    { disable_auto_update: 'major' },
    { disable_auto_update_under_native: false },
    { allow_device_self_set: true },
    { allow_prod: false },
    { allow_device: false },
    { rollout_enabled: true },
    { rollout_enabled: null },
    { rollout_enabled: undefined },
])('rejects unsafe iOS policy before promotion: %j', (change) => {
    const result = invoke('verify-promotion', policyResponses([{ ...channels[0], ...change }, channels[1]]))
    expect(result.status).toBe(1)
    expect(result.requests.every((request) => request.method === 'GET')).toBe(true)
})
it('requires an exclusive Android default too, even when promoting iOS', () => {
    expect(invoke('verify-promotion', policyResponses([channels[0], { ...channels[1], ios: true }])).status).toBe(1)
    expect(
        invoke('verify-promotion', policyResponses([...channels, { ...channels[0], name: 'production' }])).status
    ).toBe(1)
})
it.each([false, null, undefined])('blocks releases when metadata exposure is %s', (expose_metadata) => {
    const result = invoke('verify-promotion', [{ body: { ...app, expose_metadata } }])
    expect(result.status).toBe(1)
    expect(result.requests).toHaveLength(1)
})
it('never sends credentials to an unexpected configuration host', () => {
    const result = invoke('verify-promotion', [
        { body: app },
        { body: { ...config, supaHost: 'https://untrusted.test' } },
    ])
    expect(result.status).toBe(1)
    expect(result.requests).toHaveLength(2)
})
it('accepts validated metadata routing and fails closed on API failure', () => {
    expect(invoke('verify-promotion', policyResponses()).status).toBe(0)
    expect(invoke('verify-promotion', [{ body: app }, { body: config }, { status: 503 }]).status).toBe(1)
})
it('keeps a partial or deleted upload reserved, and ignores the staging counter', () => {
    const result = invoke('current-release', [
        ...policyResponses(),
        { body: [{ name: '1.6.3-ios', deleted: true }, { name: '1.6.11913' }, { name: '1.6.2-android' }] },
    ])
    expect(result.result).toBe('1.6.3')
    expect(invoke('current-release', [...policyResponses(), { body: [] }]).result).toBe('builtin')
})
it('verifies the selected production artifact after promotion', () => {
    const rows = [channelPolicy('ios', env.VERSION), channels[1]]
    expect(invoke('verify-production', [...policyResponses(rows), { body: [goodBundle] }]).status).toBe(0)
    expect(invoke('verify-production', policyResponses()).status).toBe(1)
})
it('rejects the lower iOS floor on an Android delivery record', () => {
    const result = verify([{ ...goodBundle, name: '1.6.3-android' }], { PLATFORM: 'android', VERSION: '1.6.3-android' })
    expect(result.status).toBe(1)
    expect(result.error).toContain('server floor must match the delivery platform')
})
it.each(['ios', 'android'])('verifies a distinct %s artifact with its own native floor', (platform) => {
    const nativeFloor = platform === 'ios' ? '1.5.0' : '1.6.0'
    const version = `1.6.3-${platform}`
    expect(
        verify([{ ...goodBundle, name: version, minUpdateVersion: nativeFloor }], {
            PLATFORM: platform,
            VERSION: version,
            NATIVE_FLOOR: nativeFloor,
        }).status
    ).toBe(0)
})
it('allows reuse only of a verified native .0 record from the exact source', () => {
    const native = {
        ...goodBundle,
        name: '1.7.0',
        minUpdateVersion: '1.7.0',
        comment: '[ota-floors: android=1.7.0 ios=1.7.0]',
    }
    const overrides = { VERSION: '1.7.0', FLOOR_ANDROID: '1.7.0', FLOOR_IOS: '1.7.0', NATIVE_FLOOR: '1.7.0' }
    expect(invoke('existing-native', [{ body: [] }], overrides).result).toBe('missing')
    expect(invoke('existing-native', [{ body: [native] }], overrides).result).toBe('1.7.0')
    expect(invoke('existing-native', [{ body: [{ ...native, checksum: null }] }], overrides).status).toBe(1)
    expect(invoke('existing-native', [{ body: [{ ...native, link: 'wrong-source' }] }], overrides).status).toBe(1)
    expect(invoke('existing-native', [], { VERSION: '1.7.1-ios' }).status).toBe(1)
})

// Run the actual promotion shell; only executables are replaced. The real
// preflight consumes recorded API responses. Post-promotion verification has
// separate exact-artifact cases above. No network or publication is possible.
function promotion(change = {}, apiFails = false) {
    const source = fs.readFileSync(path.join(ROOT, '.github/workflows/release-ota.yml'), 'utf8')
    const step = source.slice(
        source.indexOf('- name: Promote verified bundles'),
        source.indexOf('- name: Deployment summary')
    )
    const shell = step.match(/run: \|\n([\s\S]*)/)[1]
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ota-promotion-'))
    const marker = path.join(dir, 'production-mutated')
    const driver = `
      const mode = process.argv[2]; process.argv[1] = process.execPath;
      globalThis.fetch = () => { throw new Error('unexpected live request'); };
      if (mode !== 'verify-promotion') process.exit(0);
      const { run } = await import(${JSON.stringify(SCRIPT)});
      const responses = JSON.parse(process.env.TEST_RESPONSES);
      try { await run(mode, { fetchImpl: async () => ({
        ok: process.env.TEST_API_FAILS !== 'true', status: 503,
        json: async () => responses.shift().body
      }) }); } catch (error) { console.error(error.message); process.exitCode = 1; }
    `
    try {
        const result = spawnSync(
            'bash',
            [
                '-euo',
                'pipefail',
                '-c',
                `
          node() { "$NODE_BINARY" --input-type=module -e "$GUARD_DRIVER" "$@"; }
          npx() { printf 'promoted' >> "$PROMOTED_FILE"; }
          ${shell}
        `,
            ],
            {
                encoding: 'utf8',
                env: {
                    ...process.env,
                    ...env,
                    RELEASE_VERSION: '1.6.3',
                    NODE_BINARY: process.execPath,
                    GUARD_DRIVER: driver,
                    PROMOTED_FILE: marker,
                    TEST_API_FAILS: String(apiFails),
                    TEST_RESPONSES: JSON.stringify(policyResponses([{ ...channels[0], ...change }, channels[1]])),
                },
            }
        )
        return { status: result.status, promoted: fs.existsSync(marker) }
    } finally {
        fs.rmSync(dir, { recursive: true, force: true })
    }
}
it.each([{ rollout_enabled: true }, { rollout_enabled: null }, { android: true }, { disable_auto_update: 'major' }])(
    'the actual workflow cannot mutate either channel after rejected preflight %j',
    (change) => {
        expect(promotion(change)).toEqual({ status: 1, promoted: false })
    }
)
it('the actual workflow stops before mutation on API failure', () => {
    expect(promotion({}, true)).toEqual({ status: 1, promoted: false })
})
it('the actual workflow promotes only after both platform policies pass', () => {
    expect(promotion()).toEqual({ status: 0, promoted: true })
})
it('uploads and verifies both artifacts before any production promotion', () => {
    const source = fs.readFileSync(path.join(ROOT, '.github/workflows/release-ota.yml'), 'utf8')
    expect(source.indexOf('- name: Upload bundles')).toBeLessThan(source.indexOf('- name: Verify the floors'))
    expect(source.indexOf('- name: Verify the floors')).toBeLessThan(source.indexOf('- name: Promote verified bundles'))
    expect(source).not.toContain('--version-exists-ok')
    expect(source).toContain('--channel ota-candidate')
    expect(source).toContain('UPLOAD_GUARD_ARGS+=(--ignore-checksum-check)')
    expect(source).toContain('"${UPLOAD_GUARD_ARGS[@]}"')
    expect(source).not.toContain('channel set production')
})

it('bypasses the candidate checksum collision only for the second platform record', () => {
    const source = fs.readFileSync(path.join(ROOT, '.github/workflows/release-ota.yml'), 'utf8')
    const step = source.slice(source.indexOf('- name: Upload bundles'), source.indexOf('- name: Verify the floors'))
    const shell = step.match(/run: \|\n([\s\S]*)/)[1]
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ota-platform-uploads-'))
    const calls = path.join(dir, 'calls')
    try {
        const result = spawnSync(
            'bash',
            [
                '-euo',
                'pipefail',
                '-c',
                `
          npx() { printf '%s\\n' "$*" >> "$CALLS_FILE"; }
          ${shell}
        `,
            ],
            {
                encoding: 'utf8',
                env: {
                    ...process.env,
                    CAPGO_API_KEY: 'api-key',
                    CAPGO_PRIVATE_KEY: 'private-key',
                    COMMIT_MSG: 'release',
                    RELEASE_VERSION: '1.6.4',
                    FLOOR_ANDROID: '1.6.0',
                    FLOOR_IOS: '1.5.0',
                    GITHUB_SHA: SHA,
                    CALLS_FILE: calls,
                },
            }
        )
        expect(result.status).toBe(0)
        const [ios, android] = fs.readFileSync(calls, 'utf8').trim().split('\n')
        expect(ios).toContain('--bundle 1.6.4-ios')
        expect(ios).toContain('--min-update-version 1.5.0')
        expect(ios).not.toContain('--ignore-checksum-check')
        expect(android).toContain('--bundle 1.6.4-android')
        expect(android).toContain('--min-update-version 1.6.0')
        expect(android).toContain('--ignore-checksum-check')
    } finally {
        fs.rmSync(dir, { recursive: true, force: true })
    }
})

it('never assigns a prerelease .0 identity that sorts below its native binary', () => {
    expect(verify([{ ...goodBundle, name: '1.6.0-ios' }], { VERSION: '1.6.0-ios' }).status).toBe(1)
})

// Execute the native publisher with deterministic command responses. Assertions
// cover the ordering and failures that can otherwise promote an absent artifact.
function publishNative({ existing = 'missing', failure = '', platform = 'ios' } = {}) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'native-ota-publish-'))
    const log = path.join(dir, 'calls')
    fs.mkdirSync(path.join(dir, 'out'))
    fs.writeFileSync(path.join(dir, 'out/index.html'), '<html></html>')
    try {
        const result = spawnSync(
            'bash',
            [
                '-c',
                `
          node() {
            printf '%s\\n' "$2" >> "$CALL_LOG"
            [ "$FAILURE" != "$2" ] || return 1
            if [ "$2" = existing-native ]; then printf '%s' "$EXISTING"; fi
          }
          npx() {
            printf '%s\\n' "$*" >> "$CALL_LOG"
            [ "$FAILURE" != upload ] || return 1
          }
          source "$PUBLISH_SCRIPT"
        `,
            ],
            {
                cwd: dir,
                encoding: 'utf8',
                env: {
                    ...process.env,
                    ...env,
                    VERSION: '1.7.0',
                    PLATFORM: platform,
                    CAPGO_PRIVATE_KEY: 'test-private-key',
                    CALL_LOG: log,
                    EXISTING: existing,
                    FAILURE: failure,
                    PUBLISH_SCRIPT: path.join(ROOT, 'scripts/publish-native-ota.sh'),
                },
            }
        )
        return { status: result.status, calls: fs.readFileSync(log, 'utf8').trim().split('\n') }
    } finally {
        fs.rmSync(dir, { recursive: true, force: true })
    }
}
it.each(['ios', 'android'])('native publisher verifies before promoting %s', (platform) => {
    const { status, calls } = publishNative({ platform })
    expect(status).toBe(0)
    const upload = calls.findIndex((line) => line.includes('bundle upload'))
    const promote = calls.findIndex((line) => line.includes('channel set'))
    expect(upload).toBeGreaterThan(calls.indexOf('existing-native'))
    expect(calls[upload]).toContain('--min-update-version 1.7.0')
    expect(calls[upload]).toContain('[ota-floors: android=1.7.0 ios=1.7.0]')
    expect(promote).toBeGreaterThan(calls.indexOf('verify-bundle'))
    expect(calls[promote]).toContain(`channel set ${platform}-mobile-release`)
    expect(calls.at(-1)).toBe('verify-production')
})
it('native publisher skips uploading only an already verified record', () => {
    const { status, calls } = publishNative({ existing: '1.7.0' })
    expect(status).toBe(0)
    expect(calls.some((line) => line.includes('bundle upload'))).toBe(false)
    expect(calls).toContain('verify-bundle')
})
it.each(['existing-native', 'upload', 'verify-bundle', 'verify-promotion'])(
    'native publisher cannot promote after %s fails',
    (failure) => {
        const { status, calls } = publishNative({ failure })
        expect(status).toBe(1)
        expect(calls.some((line) => line.includes('channel set'))).toBe(false)
    }
)
