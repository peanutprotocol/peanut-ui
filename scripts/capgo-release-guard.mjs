#!/usr/bin/env node
// Public API for artifacts; the CLI's authenticated PostgREST interface for
// channel policies, because public/channel/get.ts omits ios/android/electron.
import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const CANDIDATE_CHANNEL = 'ota-candidate'
export const PRODUCTION_CHANNELS = { ios: 'ios-mobile-release', android: 'android-mobile-release' }
const DISABLED_AUDIENCES = {
    public: false,
    allow_device_self_set: false,
    allow_emulator: false,
    allow_device: false,
    allow_dev: false,
    allow_prod: false,
}
const CORE = /^(0|[1-9]\d*)\.([1-9]\d*)\.(0|[1-9]\d*)$/
const CHANNEL_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/

function channelVersion(row, channelName) {
    // Capgo represents the builtin bundle as a null channels.version foreign
    // key, so the embedded app_versions relation is null too. Check both the
    // raw key and relation to distinguish that legitimate state from a broken
    // or incomplete PostgREST response.
    if (row?.version_id === null && row.version === null) return 'builtin'
    if (
        !Number.isInteger(row?.version_id) ||
        row.version_id <= 0 ||
        row.version?.id !== row.version_id ||
        !CHANNEL_VERSION.test(row.version?.name ?? '')
    ) {
        throw new Error(`${channelName} has no valid current bundle version`)
    }
    return row.version.name
}

function required(env, name) {
    if (!env[name]) throw new Error(`${name} is required`)
    return env[name]
}
function platform(env) {
    const value = required(env, 'PLATFORM')
    if (!Object.hasOwn(PRODUCTION_CHANNELS, value)) throw new Error('PLATFORM must be ios or android')
    return value
}
export function verifyBundle(bundle, env) {
    const target = platform(env)
    const version = required(env, 'VERSION')
    const core = version.replace(/-(ios|android)$/, '')
    const android = required(env, 'FLOOR_ANDROID')
    const ios = required(env, 'FLOOR_IOS')
    const nativeFloor = required(env, 'NATIVE_FLOOR')
    const sha = required(env, 'GITHUB_SHA')
    // Native .0 records may be shared: both floors must equal that binary.
    // OTA records are distinct even when their web assets are identical.
    const native = CORE.test(version) && version.endsWith('.0')
    if (
        !CORE.test(core) ||
        (!native && (core.endsWith('.0') || version !== `${core}-${target}`)) ||
        !/^[a-f0-9]{40}$/.test(sha)
    ) {
        throw new Error('invalid release identity')
    }
    for (const floor of [android, ios]) {
        if (
            !CORE.test(floor) ||
            !floor.endsWith('.0') ||
            floor.split('.')[0] !== core.split('.')[0] ||
            Number(floor.split('.')[1]) > Number(core.split('.')[1])
        )
            throw new Error('invalid native floor')
    }
    if (native && (android !== version || ios !== version))
        throw new Error('native bundle floors must match the binary')
    if (nativeFloor !== (target === 'ios' ? ios : android))
        throw new Error('server floor must match the delivery platform')
    if (bundle?.name !== version || bundle.app_id !== required(env, 'CAPGO_APP_ID') || bundle.deleted !== false) {
        throw new Error(`bundle identity mismatch for ${version}`)
    }
    const expected = `[ota-floors: android=${android} ios=${ios}]`
    if (typeof bundle.comment !== 'string' || !bundle.comment.trimEnd().endsWith(expected)) {
        throw new Error(`bundle ${version} does not carry the expected candidate floors`)
    }
    // GET /bundle returns the app_versions row without camel-case mapping.
    if (bundle.min_update_version !== nativeFloor) throw new Error(`bundle ${version} has the wrong server floor`)
    if (bundle.link !== `https://github.com/peanutprotocol/peanut-ui/commit/${sha}`) {
        throw new Error(`bundle ${version} belongs to a different or unverified source commit`)
    }
    if (
        typeof bundle.checksum !== 'string' ||
        !bundle.checksum ||
        bundle.storage_provider !== 'r2' ||
        !bundle.r2_path
    ) {
        throw new Error(`bundle ${version} has incomplete artifact metadata`)
    }
    return version
}

export function verifyPolicies(channels, appId) {
    if (!Array.isArray(channels) || channels.length >= 1000 || channels.some((row) => row.app_id !== appId)) {
        throw new Error('invalid channel policy response')
    }
    for (const [target, name] of Object.entries(PRODUCTION_CHANNELS)) {
        const matches = channels.filter((row) => row.name === name)
        if (matches.length !== 1) throw new Error(`missing or ambiguous channel ${name}`)
        const row = matches[0]
        const expected = {
            public: true,
            ios: target === 'ios',
            android: target === 'android',
            electron: false,
            disable_auto_update: 'version_number',
            disable_auto_update_under_native: true,
            allow_device_self_set: false,
            allow_prod: true,
            allow_device: true,
            rollout_enabled: false,
        }
        for (const [field, value] of Object.entries(expected)) {
            if (row[field] !== value) throw new Error(`${name} must have ${field}=${value}`)
        }
        channelVersion(row, name)
    }
    if (
        channels.some(
            (row) => row.public && (row.ios || row.android) && !Object.values(PRODUCTION_CHANNELS).includes(row.name)
        )
    ) {
        throw new Error('another default channel overlaps mobile production routing')
    }
    return channels
}

export async function run(mode, { env = process.env, fetchImpl = fetch } = {}) {
    const appId = required(env, 'CAPGO_APP_ID')
    const apiKey = required(env, 'CAPGO_API_KEY')
    const json = async (url, init = {}) => {
        const response = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(30000), redirect: 'error' })
        if (!response.ok) throw new Error(`Capgo request failed (HTTP ${response.status})`)
        return response.json()
    }
    const request = async (resource, { query = {}, body } = {}) => {
        const url = new URL(`https://api.capgo.app/${resource}`)
        if (!body) url.search = new URLSearchParams({ app_id: appId, ...query }).toString()
        return json(url, {
            method: body ? 'POST' : 'GET',
            headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
            ...(body ? { body: JSON.stringify({ app_id: appId, ...body }) } : {}),
        })
    }
    const policies = async () => {
        // GET /app lists apps; app_id in its query does not select one record.
        const app = await request(`app/${encodeURIComponent(appId)}`)
        if (app?.app_id !== appId) throw new Error('Capgo app response does not match the requested app')
        if (app.expose_metadata !== true) throw new Error('app must expose bundle metadata to the plugin')
        // Same public configuration and capgkey authentication as Capgo CLI's
        // createSupabaseClient(). Pin the host before sending the release key.
        const config = await json('https://api.capgo.app/private/config', { method: 'GET' })
        if (config?.supaHost !== 'https://sb.capgo.app' || typeof config.supaKey !== 'string' || !config.supaKey) {
            throw new Error('unexpected Capgo database configuration')
        }
        const url = new URL('https://sb.capgo.app/rest/v1/channels')
        url.search = new URLSearchParams({
            app_id: `eq.${appId}`,
            limit: '1000',
            select: 'name,app_id,public,ios,android,electron,disable_auto_update,disable_auto_update_under_native,allow_device_self_set,allow_prod,allow_device,rollout_enabled,version_id:version,version:app_versions!channels_version_fkey(name,id)',
        }).toString()
        return verifyPolicies(
            await json(url, {
                method: 'GET',
                headers: {
                    apikey: config.supaKey,
                    Authorization: `Bearer ${config.supaKey}`,
                    capgkey: apiKey,
                },
            }),
            appId
        )
    }
    const verifyCandidate = async () => {
        const candidate = await request('channel', { query: { channel: CANDIDATE_CHANNEL } })
        if (candidate?.app_id !== appId || candidate.name !== CANDIDATE_CHANNEL)
            throw new Error('channel identity mismatch')
        for (const [field, expected] of Object.entries(DISABLED_AUDIENCES)) {
            if (candidate[field] !== expected) throw new Error(`candidate channel must have ${field}=false`)
        }
        if (candidate.rolloutEnabled !== false) throw new Error('candidate rollout must be disabled')
    }
    const verifyCandidateReset = async () => {
        const matches = (await policies()).filter((row) => row.name === CANDIDATE_CHANNEL)
        if (matches.length !== 1 || channelVersion(matches[0], CANDIDATE_CHANNEL) !== 'builtin') {
            throw new Error('candidate channel must be reset to builtin')
        }
    }
    const bundles = async () => {
        const rows = []
        for (let page = 0; page < 100; page++) {
            const response = await request('bundle', { query: { page: String(page) } })
            const batch = Array.isArray(response) ? response : response?.data
            if (!Array.isArray(batch)) throw new Error('invalid bundle-list response')
            rows.push(...batch)
            if (batch.length < 50) return rows
        }
        throw new Error('bundle-list pagination limit reached')
    }
    const bundle = async ({ allowMissing = false } = {}) => {
        const version = required(env, 'VERSION')
        const matches = (await bundles()).filter((row) => row?.name === version)
        if (matches.length > 1) throw new Error(`ambiguous bundle ${version}`)
        if (matches.length === 1) return verifyBundle(matches[0], env)
        if (allowMissing) return 'missing'
        throw new Error(`bundle ${version} was not found`)
    }
    switch (mode) {
        case 'prepare-candidate':
            await request('channel', {
                body: {
                    channel: CANDIDATE_CHANNEL,
                    // A failed run can leave its first platform bundle attached.
                    // Reset the disabled channel so the next run retains the
                    // checksum guard on its first upload.
                    // The hosted endpoint returned HTTP 400 for a JSON null.
                    // "builtin" is Capgo's public wire name for the same unlinked
                    // database state.
                    version: 'builtin',
                    ...DISABLED_AUDIENCES,
                    ios: false,
                    android: false,
                    electron: false,
                    rolloutEnabled: false,
                },
            })
            await verifyCandidate()
            await verifyCandidateReset()
            return 'Candidate channel is disabled and reset to builtin'
        case 'verify-bundle':
            await verifyCandidate()
            return `Verified bundle ${await bundle()}`
        case 'existing-native':
            if (!CORE.test(env.VERSION ?? '') || !env.VERSION.endsWith('.0'))
                throw new Error('expected native .0 version')
            return bundle({ allowMissing: true })
        case 'current-version': {
            const name = PRODUCTION_CHANNELS[platform(env)]
            return channelVersion(
                (await policies()).find((row) => row.name === name),
                name
            )
        }
        case 'current-release': {
            const current = (await policies())
                .filter((row) => Object.values(PRODUCTION_CHANNELS).includes(row.name))
                .map((row) => channelVersion(row, row.name))
                .filter((name) => name !== 'builtin')
            // Include failed/partial and deleted platform uploads: their names
            // remain reserved. Exclude staging's commit-count version sequence.
            current.push(
                ...(await bundles()).map((row) => row.name).filter((name) => /^\d+\.\d+\.\d+-(ios|android)$/.test(name))
            )
            const cores = current.map((name) => name.split('-')[0])
            cores.sort((a, b) => {
                const x = a.split('.').map(Number),
                    y = b.split('.').map(Number)
                return y[0] - x[0] || y[1] - x[1] || y[2] - x[2]
            })
            return cores[0] ?? 'builtin'
        }
        case 'verify-promotion':
            await policies()
            return 'Platform production policies verified'
        case 'verify-production': {
            const name = PRODUCTION_CHANNELS[platform(env)]
            const row = (await policies()).find((entry) => entry.name === name)
            if (channelVersion(row, name) !== required(env, 'VERSION'))
                throw new Error(`${name} does not exclusively serve the expected version`)
            return `${name} serves verified bundle ${await bundle()}`
        }
        default:
            throw new Error(`unknown release-guard mode: ${mode}`)
    }
}
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
    try {
        console.log(await run(process.argv[2]))
    } catch (error) {
        console.error(`capgo-release-guard: ${error.message}`)
        process.exitCode = 1
    }
}
