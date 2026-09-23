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
    min_update_version: '1.5.0',
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
it('permits the explicit iOS 1.5 bridge with a newer Android floor only in bridge mode', () => {
    const bridge = { ...goodBundle, name: '1.5.1000-ios' }
    const options = { VERSION: bridge.name, IOS_LEGACY_BRIDGE: '1' }
    expect(verify([bridge], options).status).toBe(0)
    expect(verify([bridge], { VERSION: bridge.name }).status).toBe(1)
    expect(verify([bridge], { ...options, PLATFORM: 'android' }).status).toBe(1)
    expect(verify([bridge], { ...options, FLOOR_IOS: '1.4.0' }).status).toBe(1)
})
it('permits an Android 1.6 bridge only with its matching platform and floor', () => {
    const bridge = { ...goodBundle, name: '1.6.1000-android', min_update_version: '1.6.0' }
    const options = {
        PLATFORM: 'android',
        VERSION: bridge.name,
        ANDROID_LEGACY_BRIDGE: '1',
        NATIVE_FLOOR: '1.6.0',
    }
    expect(verify([bridge], options).status).toBe(0)
    expect(verify([bridge], { ...options, PLATFORM: 'ios' }).status).toBe(1)
    expect(verify([bridge], { ...options, FLOOR_ANDROID: '1.5.0' }).status).toBe(1)
})
it('binds a manual release to the pinned main commit instead of the dev workflow commit', () => {
    const mainSha = 'b'.repeat(40)
    const mainBundle = { ...goodBundle, link: `https://github.com/peanutprotocol/peanut-ui/commit/${mainSha}` }
    expect(verify([mainBundle], { OTA_SOURCE_SHA: mainSha }).status).toBe(0)
    expect(verify([goodBundle], { OTA_SOURCE_SHA: mainSha }).status).toBe(1)
    expect(verify([mainBundle], { OTA_SOURCE_SHA: '' }).status).toBe(1)
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
    { min_update_version: '1.4.0' },
    { min_update_version: undefined, minUpdateVersion: '1.5.0' },
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
it('accepts Capgo’s empty-page response after an exactly full bundle page', () => {
    const terminalPage = {
        status: 400,
        body: { error: 'cannot_get_bundle', message: 'Cannot get bundle', moreInfo: { supabaseError: null } },
    }
    const rows = [goodBundle, ...Array.from({ length: 49 }, (_, i) => ({ name: `1.6.${i + 100}` }))]
    const result = invoke('verify-bundle', [{ body: candidate }, { body: rows }, terminalPage])
    expect(result.status).toBe(0)
    expect(result.requests[2].url).toContain('page=1')
    expect(invoke('current-release', [...policyResponses(), { body: rows }, terminalPage]).status).toBe(0)
})
it('does not treat other HTTP 400 errors as the end of bundle pagination', () => {
    const rows = Array.from({ length: 50 }, (_, i) => ({ name: `1.6.${i + 100}` }))
    for (const body of [
        { error: 'cannot_get_bundle', message: "You can't access this app", moreInfo: { app_id: env.CAPGO_APP_ID } },
        { error: 'cannot_get_bundle', message: 'Cannot get bundle', moreInfo: { supabaseError: { code: 'DB_ERROR' } } },
        { error: 'some_other_error', message: 'Cannot get bundle', moreInfo: { supabaseError: null } },
    ]) {
        expect(invoke('verify-bundle', [{ body: candidate }, { body: rows }, { status: 400, body }]).status).toBe(1)
    }
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
it('reserves the next iOS 1.5 bridge version even after a partial upload', () => {
    const result = invoke('next-ios-bridge', [
        ...policyResponses(),
        { body: [{ name: '1.5.1000-ios', deleted: true }, { name: '1.6.7-ios' }] },
    ])
    expect(result.result).toBe('1.5.1001-ios')
})
it('reserves the next Android 1.6 bridge version even after a partial upload', () => {
    const result = invoke('next-android-bridge', [
        ...policyResponses(),
        { body: [{ name: '1.6.1000-android', deleted: true }, { name: '1.7.2-android' }] },
    ])
    expect(result.result).toBe('1.6.1001-android')
})
it('recognizes only the verified Android bridge policy', () => {
    const bridge = { ...channelPolicy('android', '1.6.1000-android'), disable_auto_update_under_native: false }
    expect(invoke('android-bridge-status', policyResponses()).result).toBe('inactive')
    expect(invoke('android-bridge-status', policyResponses([channels[0], bridge])).result).toBe('active')
    expect(invoke('verify-promotion', policyResponses([channels[0], bridge])).status).toBe(1)
    expect(
        invoke('verify-promotion', policyResponses([channels[0], bridge]), { ALLOW_ANDROID_BRIDGE: '1' }).status
    ).toBe(0)
    expect(
        invoke(
            'android-bridge-status',
            policyResponses([channels[0], { ...bridge, version: { id: 42, name: '1.7.2-android' } }])
        ).status
    ).toBe(1)
    expect(
        invoke(
            'android-bridge-status',
            policyResponses([channels[0], { ...bridge, version: { id: 42, name: '1.6.8-android' } }])
        ).status
    ).toBe(1)
})
it('promotes an Android 1.6 bridge without changing iOS routing', () => {
    const version = '1.6.1000-android'
    const bridgeBundle = { ...goodBundle, name: version, min_update_version: '1.6.0' }
    const promoted = { ...channelPolicy('android', version), disable_auto_update_under_native: false }
    const result = invoke(
        'promote-android-bridge',
        [
            ...policyResponses(),
            { body: [bridgeBundle] },
            { body: { status: 'success' } },
            ...policyResponses([channels[0], promoted]),
        ],
        { PLATFORM: 'android', VERSION: version, ANDROID_LEGACY_BRIDGE: '1', NATIVE_FLOOR: '1.6.0' }
    )
    expect(result.status).toBe(0)
    expect(result.requests[4].body).toMatchObject({
        channel: 'android-mobile-release',
        version,
        disableAutoUpdateUnderNative: false,
        rolloutEnabled: false,
    })
})
it('recognizes the verified iOS bridge channel while preserving Android policy', () => {
    const bridge = { ...channelPolicy('ios', '1.5.1000-ios'), disable_auto_update_under_native: false }
    expect(invoke('bridge-status', policyResponses()).result).toBe('inactive')
    expect(invoke('bridge-status', policyResponses([bridge, channels[1]])).result).toBe('active')
    expect(invoke('current-release', [...policyResponses([bridge, channels[1]]), { body: [] }]).status).toBe(1)
    expect(
        invoke('current-release', [...policyResponses([bridge, channels[1]]), { body: [] }], {
            ALLOW_IOS_BRIDGE: '1',
        }).status
    ).toBe(0)
    expect(
        invoke('bridge-status', policyResponses([{ ...bridge, version: { id: 42, name: '1.6.8-ios' } }, channels[1]]))
            .status
    ).toBe(1)
})
it('promotes a verified bridge and disables native-version downgrade protection only for iOS', () => {
    const version = '1.5.1000-ios'
    const bridge = { ...goodBundle, name: version }
    const promoted = { ...channelPolicy('ios', version), disable_auto_update_under_native: false }
    const result = invoke(
        'promote-ios-bridge',
        [
            ...policyResponses(),
            { body: [bridge] },
            { body: { status: 'success' } },
            ...policyResponses([promoted, channels[1]]),
        ],
        { VERSION: version, IOS_LEGACY_BRIDGE: '1' }
    )
    expect(result.status).toBe(0)
    expect(result.requests[4].body).toMatchObject({
        channel: 'ios-mobile-release',
        version,
        disableAutoUpdateUnderNative: false,
        rolloutEnabled: false,
    })
    expect(invoke('verify-promotion', policyResponses([promoted, channels[1]])).status).toBe(1)
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
        verify([{ ...goodBundle, name: version, min_update_version: nativeFloor }], {
            PLATFORM: platform,
            VERSION: version,
            NATIVE_FLOOR: nativeFloor,
        }).status
    ).toBe(0)
})
it('allows reuse only of a verified native .0 record from the exact source', () => {
    const native = {
        ...goodBundle,
        name: '1.8.0',
        min_update_version: '1.7.0',
        comment: '[ota-floors: android=1.7.0 ios=1.6.0]',
    }
    const overrides = { VERSION: '1.8.0', FLOOR_ANDROID: '1.7.0', FLOOR_IOS: '1.6.0', NATIVE_FLOOR: '1.7.0' }
    expect(invoke('existing-native', [{ body: [] }], overrides).result).toBe('missing')
    expect(invoke('existing-native', [{ body: [native] }], overrides).result).toBe('1.8.0')
    expect(invoke('existing-native', [{ body: [{ ...native, checksum: null }] }], overrides).status).toBe(1)
    expect(invoke('existing-native', [{ body: [{ ...native, link: 'wrong-source' }] }], overrides).status).toBe(1)
    expect(invoke('existing-native', [{ body: [native] }], { ...overrides, NATIVE_FLOOR: '1.6.0' }).status).toBe(1)
    expect(invoke('existing-native', [], { VERSION: '1.7.1-ios' }).status).toBe(1)
})

it('promotes one platform bundle and disables rollout in the same mutation', () => {
    const promoted = channelPolicy('ios', env.VERSION)
    const result = invoke('promote-production', [
        ...policyResponses(),
        { body: { status: 'success' } },
        ...policyResponses([promoted, channels[1]]),
    ])

    expect(result.status).toBe(0)
    expect(result.requests[3]).toMatchObject({
        method: 'POST',
        body: {
            app_id: env.CAPGO_APP_ID,
            channel: 'ios-mobile-release',
            version: env.VERSION,
            rolloutEnabled: false,
        },
    })
})
it('continues the 1.5.x iOS lane only when the bridge policy is active', () => {
    const bridge = { ...channelPolicy('ios', '1.5.1000-ios'), disable_auto_update_under_native: false }
    const next = { ...bridge, version: { id: 42, name: '1.5.1001-ios' } }
    const options = { PLATFORM: 'ios', VERSION: '1.5.1001-ios', ALLOW_IOS_BRIDGE: '1', IOS_LEGACY_BRIDGE: '1' }
    expect(
        invoke(
            'promote-production',
            [
                ...policyResponses([bridge, channels[1]]),
                { body: { status: 'success' } },
                ...policyResponses([next, channels[1]]),
            ],
            options
        ).status
    ).toBe(0)
    const rejected = invoke('promote-production', policyResponses([bridge, channels[1]]), {
        ...options,
        IOS_LEGACY_BRIDGE: '0',
    })
    expect(rejected.status).toBe(1)
    expect(rejected.requests.every((request) => request.method === 'GET')).toBe(true)
})
it('continues the 1.6.x Android lane only in Android bridge mode', () => {
    const bridge = { ...channelPolicy('android', '1.6.1000-android'), disable_auto_update_under_native: false }
    const next = { ...bridge, version: { id: 42, name: '1.6.1001-android' } }
    const options = {
        PLATFORM: 'android',
        VERSION: '1.6.1001-android',
        ALLOW_ANDROID_BRIDGE: '1',
        ANDROID_LEGACY_BRIDGE: '1',
        NATIVE_FLOOR: '1.6.0',
    }
    expect(
        invoke(
            'promote-production',
            [
                ...policyResponses([channels[0], bridge]),
                { body: { status: 'success' } },
                ...policyResponses([channels[0], next]),
            ],
            options
        ).status
    ).toBe(0)
    const rejected = invoke('promote-production', policyResponses([channels[0], bridge]), {
        ...options,
        ANDROID_LEGACY_BRIDGE: '0',
    })
    expect(rejected.status).toBe(1)
    expect(rejected.requests.every((request) => request.method === 'GET')).toBe(true)
})

it('does not mutate production after a rejected policy preflight', () => {
    const result = invoke(
        'promote-production',
        policyResponses([{ ...channels[0], rollout_enabled: true }, channels[1]])
    )
    expect(result.status).toBe(1)
    expect(result.requests.every((request) => request.method === 'GET')).toBe(true)
})

it('fails when Capgo does not persist the exclusive promotion', () => {
    const result = invoke('promote-production', [
        ...policyResponses(),
        { body: { status: 'success' } },
        ...policyResponses(),
    ])
    expect(result.status).toBe(1)
    expect(result.error).toContain('did not persist the exclusive promotion')
})
it('uploads and verifies both artifacts before any production promotion', () => {
    const source = fs.readFileSync(path.join(ROOT, '.github/workflows/release-ota.yml'), 'utf8')
    expect(source.indexOf('- name: Upload bundles')).toBeLessThan(source.indexOf('- name: Verify the floors'))
    expect(source.indexOf('- name: Verify the floors')).toBeLessThan(source.indexOf('- name: Promote verified bundles'))
    expect(source).not.toContain('--version-exists-ok')
    expect(source).toContain('--channel ota-candidate')
    expect(source).toContain('UPLOAD_GUARD_ARGS+=(--ignore-checksum-check)')
    expect(source).toContain('"${UPLOAD_GUARD_ARGS[@]}"')
    expect(source).toContain('capgo-release-guard.mjs promote-production')
    expect(source).not.toContain('channel set')
})

it('bypasses the candidate checksum collision only for the second platform record', () => {
    const source = fs.readFileSync(path.join(ROOT, '.github/workflows/release-ota.yml'), 'utf8')
    const step = source.slice(source.indexOf('- name: Upload bundles'), source.indexOf('- name: Verify the floors'))
    const shell = step.match(/run: \|\n([\s\S]*)/)[1]
    const mainSha = 'b'.repeat(40)
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ota-platform-uploads-'))
    const calls = path.join(dir, 'calls')
    const shellCommand = `
          npx() { printf '%s\\n' "$*" >> "$CALLS_FILE"; }
          ${shell}
        `
    try {
        const result = spawnSync('bash', ['-euo', 'pipefail', '-c', shellCommand], {
            encoding: 'utf8',
            env: {
                ...process.env,
                CAPGO_API_KEY: 'api-key',
                CAPGO_PRIVATE_KEY: 'private-key',
                COMMIT_MSG: 'release',
                RELEASE_VERSION: '1.6.4',
                RELEASE_VERSION_IOS: '1.6.4-ios',
                RELEASE_VERSION_ANDROID: '1.6.4-android',
                FLOOR_ANDROID: '1.6.0',
                FLOOR_IOS: '1.5.0',
                GITHUB_SHA: SHA,
                OTA_SOURCE_SHA: mainSha,
                CALLS_FILE: calls,
            },
        })
        expect(result.status).toBe(0)
        const [ios, android] = fs.readFileSync(calls, 'utf8').trim().split('\n')
        expect(ios).toContain('--bundle 1.6.4-ios')
        expect(ios).toContain(`--link https://github.com/peanutprotocol/peanut-ui/commit/${mainSha}`)
        expect(ios).not.toContain(`--link https://github.com/peanutprotocol/peanut-ui/commit/${SHA}`)
        expect(ios).toContain('--min-update-version 1.5.0')
        expect(ios).not.toContain('--ignore-checksum-check')
        expect(android).toContain('--bundle 1.6.4-android')
        expect(android).toContain('--min-update-version 1.6.0')
        expect(android).toContain('--ignore-checksum-check')

        const bridgeResult = spawnSync('bash', ['-euo', 'pipefail', '-c', shellCommand], {
            encoding: 'utf8',
            env: {
                ...process.env,
                CAPGO_API_KEY: 'api-key',
                CAPGO_PRIVATE_KEY: 'private-key',
                RELEASE_VERSION: '1.6.5',
                RELEASE_VERSION_IOS: '1.5.1001-ios',
                RELEASE_VERSION_ANDROID: '1.6.5-android',
                FLOOR_ANDROID: '1.6.0',
                FLOOR_IOS: '1.5.0',
                OTA_SOURCE_SHA: mainSha,
                CALLS_FILE: calls,
            },
        })
        expect(bridgeResult.status).toBe(0)
        const [, , bridgedIos, nextAndroid] = fs.readFileSync(calls, 'utf8').trim().split('\n')
        expect(bridgedIos).toContain('--bundle 1.5.1001-ios')
        expect(bridgedIos).toContain('--min-update-version 1.5.0')
        expect(nextAndroid).toContain('--bundle 1.6.5-android')

        const bothBridges = spawnSync('bash', ['-euo', 'pipefail', '-c', shellCommand], {
            encoding: 'utf8',
            env: {
                ...process.env,
                CAPGO_API_KEY: 'api-key',
                CAPGO_PRIVATE_KEY: 'private-key',
                RELEASE_VERSION: '1.7.1',
                RELEASE_VERSION_IOS: '1.5.1002-ios',
                RELEASE_VERSION_ANDROID: '1.6.1001-android',
                FLOOR_ANDROID: '1.6.0',
                FLOOR_IOS: '1.5.0',
                OTA_SOURCE_SHA: mainSha,
                CALLS_FILE: calls,
            },
        })
        expect(bothBridges.status).toBe(0)
        const uploads = fs.readFileSync(calls, 'utf8').trim().split('\n')
        expect(uploads.at(-2)).toContain('--bundle 1.5.1002-ios')
        expect(uploads.at(-1)).toContain('--bundle 1.6.1001-android')
    } finally {
        fs.rmSync(dir, { recursive: true, force: true })
    }
})

it('never assigns a prerelease .0 identity that sorts below its native binary', () => {
    expect(verify([{ ...goodBundle, name: '1.6.0-ios' }], { VERSION: '1.6.0-ios' }).status).toBe(1)
})

// Execute the native publisher with deterministic command responses. Assertions
// cover the ordering and failures that can otherwise promote an absent artifact.
function publishNative({
    existing = 'missing',
    raceWinner = 'missing',
    failure = '',
    platform = 'ios',
    androidFloor = '1.7.0',
    iosFloor = '1.7.0',
    sharedFloor = '1.7.0',
    isRebuild = false,
} = {}) {
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
            if [ "$1" = scripts/ota-platform-floor.mjs ]; then
              if [ "$2" = --platform ]; then
                MODE="floor-$3"
                if [ "$3" = android ]; then RESULT="$ANDROID_FLOOR"; else RESULT="$IOS_FLOOR"; fi
              else
                MODE=floor-shared
                RESULT="$SHARED_FLOOR"
              fi
              printf '%s\\n' "$MODE" >> "$CALL_LOG"
              printf 'floor-args:%s\\n' "$*" >> "$CALL_LOG"
              [ "$FAILURE" != "$MODE" ] || return 1
              printf '%s\\n' "$RESULT"
              return
            fi
            printf '%s\\n' "$2" >> "$CALL_LOG"
            [ "$FAILURE" != "$2" ] || return 1
            if [ "$2" = existing-native ]; then
              COUNT="$(grep -c '^existing-native$' "$CALL_LOG")"
              if [ "$COUNT" -eq 1 ]; then printf '%s' "$EXISTING"; else printf '%s' "$RACE_WINNER"; fi
            fi
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
                    VERSION: '1.8.0',
                    PLATFORM: platform,
                    CAPGO_PRIVATE_KEY: 'test-private-key',
                    ANDROID_FLOOR: androidFloor,
                    IOS_FLOOR: iosFloor,
                    SHARED_FLOOR: sharedFloor,
                    IS_REBUILD: isRebuild ? 'true' : 'false',
                    CALL_LOG: log,
                    EXISTING: existing,
                    RACE_WINNER: raceWinner,
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
    const promote = calls.indexOf('promote-production')
    expect(upload).toBeGreaterThan(calls.indexOf('existing-native'))
    expect(calls[upload]).toContain('--min-update-version 1.7.0')
    expect(calls[upload]).toContain('[ota-floors: android=1.7.0 ios=1.7.0]')
    expect(promote).toBeGreaterThan(calls.indexOf('verify-bundle'))
    expect(calls.at(-1)).toBe('verify-production')
})
it('native publisher uses the stricter compatible floor when platform floors differ', () => {
    const { status, calls } = publishNative({ androidFloor: '1.8.0', iosFloor: '1.7.0', sharedFloor: '1.8.0' })
    expect(status).toBe(0)
    const upload = calls.find((line) => line.includes('bundle upload'))
    expect(upload).toContain('--min-update-version 1.8.0')
    expect(upload).toContain('[ota-floors: android=1.8.0 ios=1.7.0]')
})
it('native publisher explicitly validates a same-version replacement', () => {
    const { status, calls } = publishNative({
        platform: 'android',
        androidFloor: '1.8.0',
        iosFloor: '1.7.0',
        sharedFloor: '1.8.0',
        isRebuild: true,
    })
    expect(status).toBe(0)
    expect(calls).toContain(
        'floor-args:scripts/ota-platform-floor.mjs --platform android --prospective-version 1.8.0 --replacement-platform android'
    )
    expect(calls).toContain(
        'floor-args:scripts/ota-platform-floor.mjs --shared --prospective-version 1.8.0 --replacement-platform android'
    )
    expect(calls.find((line) => line.includes('bundle upload'))).toContain('--min-update-version 1.8.0')
})
it('native publisher skips uploading only an already verified record', () => {
    const { status, calls } = publishNative({ existing: '1.8.0' })
    expect(status).toBe(0)
    expect(calls.some((line) => line.includes('bundle upload'))).toBe(false)
    expect(calls).toContain('verify-bundle')
})
it('native publisher recovers only when a concurrent upload verifies exactly', () => {
    const { status, calls } = publishNative({ failure: 'upload', raceWinner: '1.8.0' })
    expect(status).toBe(0)
    expect(calls.filter((line) => line === 'existing-native')).toHaveLength(2)
    expect(calls.indexOf('verify-bundle')).toBeLessThan(calls.indexOf('promote-production'))
})
it.each([
    'floor-android',
    'floor-ios',
    'floor-shared',
    'existing-native',
    'upload',
    'verify-bundle',
    'verify-promotion',
    'promote-production',
])('native publisher cannot promote after %s fails', (failure) => {
    const { status, calls } = publishNative({ failure })
    expect(status).toBe(1)
    if (failure !== 'promote-production') expect(calls).not.toContain('promote-production')
    expect(calls).not.toContain('verify-production')
})
