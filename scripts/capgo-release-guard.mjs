#!/usr/bin/env node
// Structured release checks. The pinned CLI's human bundle table omits comments.
// API contracts: https://capgo.app/docs/public-api/bundles/ and /channels/.
// Keep the upload on a channel with every device audience disabled until the
// exact version, source commit and compatibility metadata have been verified.
import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const CANDIDATE_CHANNEL = 'ota-candidate'
const DISABLED_AUDIENCES = {
    public: false,
    allow_device_self_set: false,
    allow_emulator: false,
    allow_device: false,
    allow_dev: false,
    allow_prod: false,
}
const VERSION = /^(0|[1-9]\d*)\.([1-9]\d*)\.(0|[1-9]\d*)$/

function required(env, name) {
    if (!env[name]) throw new Error(`${name} is required`)
    return env[name]
}

export function verifyBundle(bundle, env) {
    const version = required(env, 'VERSION')
    const android = required(env, 'FLOOR_ANDROID')
    const ios = required(env, 'FLOOR_IOS')
    const nativeFloor = required(env, 'NATIVE_FLOOR')
    const sha = required(env, 'GITHUB_SHA')
    if (!VERSION.test(version) || !/^[a-f0-9]{40}$/.test(sha)) throw new Error('invalid release identity')
    for (const floor of [android, ios]) {
        if (
            !VERSION.test(floor) ||
            !floor.endsWith('.0') ||
            floor.split('.')[0] !== version.split('.')[0] ||
            Number(floor.split('.')[1]) > Number(version.split('.')[1])
        )
            throw new Error('invalid native floor')
    }
    const lowest = [android, ios].sort((a, b) => Number(a.split('.')[1]) - Number(b.split('.')[1]))[0]
    if (nativeFloor !== lowest) throw new Error('shared native floor must equal the lower platform floor')
    if (bundle?.name !== version || bundle.app_id !== required(env, 'CAPGO_APP_ID') || bundle.deleted !== false) {
        throw new Error(`bundle identity mismatch for ${version}`)
    }
    const expected = `[ota-floors: android=${android} ios=${ios}]`
    if (typeof bundle.comment !== 'string' || !bundle.comment.trimEnd().endsWith(expected)) {
        throw new Error(`bundle ${version} does not carry the expected candidate floors`)
    }
    if (bundle.minUpdateVersion !== nativeFloor) throw new Error(`bundle ${version} has the wrong server floor`)
    if (bundle.link !== `https://github.com/peanutprotocol/peanut-ui/commit/${sha}`) {
        throw new Error(`bundle ${version} belongs to a different or unverified source commit`)
    }
    // Require artifact metadata as well as compatibility data. This does not
    // prove the remote bytes exist: the workflow also requires a successful fresh
    // upload and forbids --version-exists-ok for incomplete prior attempts.
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

export async function run(mode, { env = process.env, fetchImpl = fetch } = {}) {
    const appId = required(env, 'CAPGO_APP_ID')
    const apiKey = required(env, 'CAPGO_API_KEY')
    const request = async (resource, { query = {}, body } = {}) => {
        const url = new URL(`https://api.capgo.app/${resource}`)
        if (!body) url.search = new URLSearchParams({ app_id: appId, ...query }).toString()
        const response = await fetchImpl(url, {
            method: body ? 'POST' : 'GET',
            headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
            ...(body ? { body: JSON.stringify({ app_id: appId, ...body }) } : {}),
            signal: AbortSignal.timeout(30000),
            redirect: 'error',
        })
        if (!response.ok) throw new Error(`Capgo ${resource} request failed (HTTP ${response.status})`)
        return response.json()
    }
    const channel = async (name) => {
        const result = await request('channel', { query: { channel: name } })
        if (result?.app_id !== appId || result.name !== name) throw new Error('channel identity mismatch')
        return result
    }
    const verifyCandidate = async () => {
        const candidate = await channel(CANDIDATE_CHANNEL)
        for (const [field, expected] of Object.entries(DISABLED_AUDIENCES)) {
            if (candidate[field] !== expected) throw new Error(`candidate channel must have ${field}=false`)
        }
    }
    const bundle = async () => {
        const version = required(env, 'VERSION')
        // The API pages by 50 and does not implement its optional version filter.
        // Search the actual name field; never search a serialized record or log.
        for (let page = 0; page < 100; page++) {
            const response = await request('bundle', { query: { page: String(page) } })
            const rows = Array.isArray(response) ? response : response?.data
            if (!Array.isArray(rows)) throw new Error('invalid bundle-list response')
            const matches = rows.filter((row) => row?.name === version)
            if (matches.length > 1) throw new Error(`ambiguous bundle ${version}`)
            if (matches.length === 1) return verifyBundle(matches[0], env)
            if (rows.length < 50) break
        }
        throw new Error(`bundle ${version} was not found`)
    }

    switch (mode) {
        case 'prepare-candidate':
            await request('channel', {
                body: {
                    channel: CANDIDATE_CHANNEL,
                    ...DISABLED_AUDIENCES,
                    ios: false,
                    android: false,
                    electron: false,
                    rolloutEnabled: false,
                },
            })
            await verifyCandidate()
            return 'Candidate channel has no enabled device audience'
        case 'verify-bundle':
            await verifyCandidate()
            return `Verified bundle ${await bundle()}`
        case 'current-version': {
            const current = (await channel('production')).version?.name
            if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/.test(current ?? '')) {
                throw new Error('production has no valid current bundle version')
            }
            return current
        }
        case 'verify-production': {
            const production = await channel('production')
            if (production.version?.name !== required(env, 'VERSION') || production.rolloutEnabled !== false) {
                throw new Error('production does not exclusively serve the expected version')
            }
            return `Production serves verified bundle ${await bundle()}`
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
