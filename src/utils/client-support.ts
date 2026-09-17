/*
 * Mandatory-update policy: read, validate, remember and judge.
 *
 * The API never rejects a client by version and there are no version headers.
 * The only enforcement is this client-side gate, which compares the bundle's
 * CLIENT_GENERATION with the minimum the public policy publishes for its
 * platform. Everything here is API-independent on purpose: it runs before the
 * wallet providers mount.
 */

import {
    CLIENT_GENERATION,
    CLIENT_SUPPORT_FETCH_TIMEOUT_MS,
    CLIENT_SUPPORT_POLICY_PATH,
    CLIENT_SUPPORT_POLICY_STORAGE_KEY,
} from '@/constants/client-support.consts'
import { DEV_TOOLS_ENABLED } from '@/constants/dev-tools.consts'
import { ensureActiveFixture } from '@/dev/fixtures/active'
import { getApiBaseUrl, getPlatform } from '@/utils/capacitor'
import { readStoredValue, writeStoredValue } from '@/utils/safe-storage'

/** The policy's platform groups. Mirrors `platformGroup` in mono's compatibility core. */
export type ClientPlatform = 'web' | 'ios' | 'android'
export const CLIENT_PLATFORMS: readonly ClientPlatform[] = ['web', 'ios', 'android']

/** Exactly what mono's `publicPolicy()` emits. Anything else is rejected. */
export interface ClientSupportPolicy {
    schemaVersion: 1
    minimumGeneration: Record<ClientPlatform, number>
}

export type ClientSupportVerdict = 'supported' | 'unsupported'

/** The verdict, or `unavailable` when no policy has ever been validated. */
export type ClientSupportStatus = ClientSupportVerdict | 'unavailable'

export interface ClientSupportResolution {
    status: ClientSupportStatus
    policy: ClientSupportPolicy | null
    source: 'live' | 'cached' | 'none'
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Strict parse: schema version 1, the three platform floors as non-negative
 * safe integers, and nothing else. A policy this code does not fully
 * understand is treated as unavailable, which keeps the cached verdict in
 * force instead of guessing.
 */
export function parseClientSupportPolicy(value: unknown): ClientSupportPolicy | null {
    if (!isRecord(value) || value.schemaVersion !== 1 || Object.keys(value).length !== 2) return null
    const floors = value.minimumGeneration
    if (!isRecord(floors) || Object.keys(floors).length !== CLIENT_PLATFORMS.length) return null
    const minimumGeneration = {} as Record<ClientPlatform, number>
    for (const platform of CLIENT_PLATFORMS) {
        const floor = floors[platform]
        if (typeof floor !== 'number' || !Number.isSafeInteger(floor) || floor < 0) return null
        minimumGeneration[platform] = floor
    }
    return { schemaVersion: 1, minimumGeneration }
}

/** PWAs are web clients: they update with the deployment, not through a store. */
export function clientPlatform(platform: ReturnType<typeof getPlatform> = getPlatform()): ClientPlatform {
    if (platform === 'ios-native') return 'ios'
    if (platform === 'android-native') return 'android'
    return 'web'
}

/** Generation zero disables the floor for a platform, so the initial policy requires nothing. */
export function evaluateClientSupport(
    policy: ClientSupportPolicy,
    platform: ClientPlatform,
    generation: number = CLIENT_GENERATION
): ClientSupportVerdict {
    return generation >= policy.minimumGeneration[platform] ? 'supported' : 'unsupported'
}

export function readStoredClientSupportPolicy(): ClientSupportPolicy | null {
    const raw = readStoredValue(CLIENT_SUPPORT_POLICY_STORAGE_KEY)
    if (raw === null) return null
    try {
        return parseClientSupportPolicy(JSON.parse(raw))
    } catch {
        return null
    }
}

export function storeClientSupportPolicy(policy: ClientSupportPolicy): void {
    writeStoredValue(CLIENT_SUPPORT_POLICY_STORAGE_KEY, JSON.stringify(policy))
}

/**
 * Native reads the web origin's copy (https://peanut.me/client-support.json);
 * the web app and PWA read it same-origin. `getApiBaseUrl` already encodes
 * that split.
 */
export function clientSupportPolicyUrl(): string {
    return `${getApiBaseUrl()}${CLIENT_SUPPORT_POLICY_PATH}`
}

/**
 * Dev fixtures can stand in for the policy (`responses['GET /client-support.json']`)
 * or fail it (`fails`), so a blocked state is capturable without a live floor.
 * `undefined` means the fixture says nothing and the real file is read.
 * DEV_TOOLS_ENABLED is inlined at build time, so production folds this away.
 */
async function fixtureClientSupportPolicy(): Promise<unknown> {
    if (!DEV_TOOLS_ENABLED) return undefined
    const name = ensureActiveFixture()
    if (!name) return undefined
    const { FIXTURES } = await import('@/dev/fixtures/registry')
    const fixture = FIXTURES[name]
    const key = `GET ${CLIENT_SUPPORT_POLICY_PATH}`
    if (fixture?.fails?.includes(key)) return null
    return fixture?.responses?.[key]
}

/** One live read: strict, uncached, short timeout. Null on any failure. */
export async function fetchClientSupportPolicy(): Promise<ClientSupportPolicy | null> {
    const fixture = await fixtureClientSupportPolicy()
    if (fixture !== undefined) return parseClientSupportPolicy(fixture)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), CLIENT_SUPPORT_FETCH_TIMEOUT_MS)
    try {
        const response = await fetch(clientSupportPolicyUrl(), {
            cache: 'no-store',
            credentials: 'omit',
            signal: controller.signal,
        })
        if (!response.ok) return null
        return parseClientSupportPolicy(await response.json())
    } catch {
        return null
    } finally {
        clearTimeout(timeout)
    }
}

/**
 * A valid live policy is the truth and is remembered. Without one, a
 * remembered policy answers only when it blocks: a known block never clears
 * because the network or the file failed, but an old "supported" is not proof
 * of current support — a dormant client coming back after an API cleanup must
 * not be admitted on the floor it last saw. Everything else is no verdict.
 */
export function resolveClientSupport(
    live: ClientSupportPolicy | null,
    cached: ClientSupportPolicy | null,
    platform: ClientPlatform
): ClientSupportResolution {
    if (live) return { status: evaluateClientSupport(live, platform), policy: live, source: 'live' }
    if (cached && evaluateClientSupport(cached, platform) === 'unsupported') {
        return { status: 'unsupported', policy: cached, source: 'cached' }
    }
    return { status: 'unavailable', policy: null, source: 'none' }
}

/** Read the live policy, remember it when valid, and resolve against the fallback. */
export async function checkClientSupport(
    fallback: ClientSupportPolicy | null,
    platform: ClientPlatform = clientPlatform()
): Promise<ClientSupportResolution> {
    const live = await fetchClientSupportPolicy()
    if (live) storeClientSupportPolicy(live)
    return resolveClientSupport(live, fallback ?? readStoredClientSupportPolicy(), platform)
}
