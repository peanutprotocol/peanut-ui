import * as Sentry from '@sentry/nextjs'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { isCapacitor } from '@/utils/capacitor'
import { classifyPasskeyError } from '@/utils/webauthn.utils'
import { nativeErrorCode, nativePasskeyFailure, type NativePasskeyFailure } from './native-passkey-errors'

/**
 * Counts every WebAuthn ceremony the app actually asks for, and attributes each
 * one to the code path that asked.
 *
 * Testers report 2–3 passkey sheets for a single send-link creation, and the
 * flow has four legitimate prompt sources (kernel migration, session-key grant,
 * Rain admin EIP-712, UserOp) plus the @capgo/capacitor-passkey shim in between
 * our JS and the OS. Reading the code can't tell you which ones fired on a given
 * device, so this instruments the one place they all funnel through —
 * `navigator.credentials` — and labels it from an ambient purpose stack.
 *
 * The count here is the number of ceremonies OUR CODE requested. If a device
 * shows more sheets than this log has entries, the extra ones come from the
 * native plugin or the OS, not from us — which is itself the answer.
 *
 * Attribution is ambient (a module-level purpose/flow stack), which is exact
 * while ceremonies stay serialized — as the OS enforces for the sheet itself.
 * Two genuinely overlapping flows (app-lock racing a spend) can cross the
 * stacks, so every record carries `overlapped` / `openFlows`: when `overlapped`
 * is true, read that row's purpose as a guess, not as evidence.
 */

export type CeremonyPurpose =
    | 'user_op'
    | 'admin_eip712'
    | 'session_key_grant'
    | 'step_up'
    | 'kernel_migration'
    | 'login'
    | 'registration'
    | 'app_lock'
    | 'ephemeral_enable'

export type CeremonyRecord = {
    seq: number
    kind: 'get' | 'create'
    /** Purpose stack joined innermost-last, e.g. `kernel_migration>user_op`. */
    purpose: string
    flow: string | null
    flowId: string | null
    startedAt: number
    durationMs: number
    /** Idle time since the previous ceremony ended — back-to-back sheets show as a small gap. */
    gapMs: number | null
    outcome: 'ok' | 'error'
    errorName?: string
    errorCode?: string
    nativeErrorCode?: string
    nativeReason?: NativePasskeyFailure
    allowCredentials?: number
    rpId?: string
    native: boolean
    /** True when another ceremony was already in flight — attribution is unreliable for this row. */
    overlapped: boolean
    openFlows: number
    /**
     * Index of `"challenge":"` in the decoded clientDataJSON of a successful
     * ceremony. The on-chain WebAuthn validator reads the challenge at a fixed
     * byte, so the standard layout gives 23 for `get` and 26 for `create`; a
     * provider that sorts the keys gives 41 on both, and its signatures fail as
     * AA24 (TASK-23931). Unset when clientDataJSON is empty or has no challenge.
     */
    challengeOffset?: number
    /**
     * The authenticator's backup-eligible flag (BE, bit 3 of the flags byte);
     * false means a device-bound passkey. Unset when no authenticator data
     * arrived, which is always the case for `create` on native.
     */
    backupEligible?: boolean
}

type FlowFrame = { id: string; name: string; startedAt: number; fromSeq: number }

const LOG_LIMIT = 40
const STORAGE_KEY = '__webauthn_ceremony_log'

let installed = false
let hydrated = false
let inFlight = 0
let seq = 0
let flowCounter = 0
let lastEndedAt: number | null = null
const openCallStarts = new Map<number, number>()
const purposeStack: CeremonyPurpose[] = []
const flowStack: FlowFrame[] = []
let log: CeremonyRecord[] = []

/**
 * A hard reload resets module state while sessionStorage still holds the
 * tester's earlier ceremonies. Without this, the first ceremony after a reload
 * appends to an empty array and persists it, erasing the reproduction we asked
 * them to capture.
 */
function hydrate(): void {
    if (hydrated) return
    hydrated = true
    try {
        const stored = window.sessionStorage.getItem(STORAGE_KEY)
        if (!stored) return
        const parsed = JSON.parse(stored) as CeremonyRecord[]
        if (!Array.isArray(parsed) || parsed.length === 0) return
        log = parsed
        seq = parsed.reduce((max, record) => Math.max(max, record.seq ?? 0), 0)
        const newest = parsed[parsed.length - 1]
        lastEndedAt = newest.startedAt + newest.durationMs
    } catch {
        // an unreadable mirror just means this session starts clean
    }
}

function persist(): void {
    try {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(log))
    } catch {
        // sessionStorage is a convenience for the dev page, never a requirement
    }
}

export function getCeremonyLog(): CeremonyRecord[] {
    hydrate()
    return [...log]
}

export function clearCeremonyLog(): void {
    hydrated = true
    log = []
    seq = 0
    lastEndedAt = null
    persist()
}

// authenticatorData: rpIdHash (32 bytes) | flags (1 byte) | signCount (4 bytes)
const AUTHENTICATOR_DATA_MIN_LENGTH = 37
const AUTHENTICATOR_FLAGS_INDEX = 32
const BACKUP_ELIGIBLE_FLAG = 0x08

function bytesOf(value: unknown): Uint8Array {
    if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
    return new Uint8Array(value as ArrayBuffer)
}

/**
 * Reads the layout facts of a successful ceremony: the challenge offset and
 * the backup-eligible flag. Offset and flag only, never the content, which
 * holds the challenge. The capgo shim turns a missing field into a 0-byte
 * buffer, so short authenticator data records no flag instead of a false
 * "device-bound". Same contract as `commit`: nothing here may throw into the
 * ceremony.
 */
function describeResult(result: unknown): Pick<CeremonyRecord, 'challengeOffset' | 'backupEligible'> {
    try {
        const response = (result as { response?: Record<string, unknown> } | null | undefined)?.response
        if (!response) return {}
        const layout: Pick<CeremonyRecord, 'challengeOffset' | 'backupEligible'> = {}
        const challengeOffset = new TextDecoder().decode(bytesOf(response.clientDataJSON)).indexOf('"challenge":"')
        if (challengeOffset >= 0) layout.challengeOffset = challengeOffset
        // assertions carry authenticatorData; attestations expose it through a
        // method on real browsers only (the native shim has no such method)
        const getAuthenticatorData = response.getAuthenticatorData
        const authenticatorData = bytesOf(
            response.authenticatorData ??
                (typeof getAuthenticatorData === 'function' ? getAuthenticatorData.call(response) : undefined)
        )
        if (authenticatorData.length >= AUTHENTICATOR_DATA_MIN_LENGTH) {
            layout.backupEligible = (authenticatorData[AUTHENTICATOR_FLAGS_INDEX] & BACKUP_ELIGIBLE_FLAG) !== 0
        }
        return layout
    } catch {
        return {}
    }
}

function describeOptions(kind: 'get' | 'create', options?: CredentialCreationOptions | CredentialRequestOptions) {
    if (kind === 'get') {
        const publicKey = (options as CredentialRequestOptions | undefined)?.publicKey
        return { rpId: publicKey?.rpId, allowCredentials: publicKey?.allowCredentials?.length }
    }
    const publicKey = (options as CredentialCreationOptions | undefined)?.publicKey
    return { rpId: publicKey?.rp?.id, allowCredentials: undefined }
}

/**
 * Nothing in here may throw: this runs inside the `navigator.credentials`
 * wrapper, so an exception would turn a successful ceremony into a failed one
 * (or mask the real NotAllowedError on the error path).
 */
function commit(record: CeremonyRecord): void {
    try {
        lastEndedAt = record.startedAt + record.durationMs
        log.push(record)
        if (log.length > LOG_LIMIT) log = log.slice(-LOG_LIMIT)
        persist()
        capture(ANALYTICS_EVENTS.WEBAUTHN_CEREMONY, {
            seq: record.seq,
            kind: record.kind,
            purpose: record.purpose,
            flow: record.flow,
            flow_id: record.flowId,
            duration_ms: record.durationMs,
            gap_ms: record.gapMs,
            outcome: record.outcome,
            error_name: record.errorName,
            error_code: record.errorCode,
            native_error_code: record.nativeErrorCode,
            native_reason: record.nativeReason,
            allow_credentials: record.allowCredentials,
            overlapped: record.overlapped,
            open_flows: record.openFlows,
            native: record.native,
            challenge_offset: record.challengeOffset,
            backup_eligible: record.backupEligible,
        })
        Sentry.addBreadcrumb({
            category: 'webauthn.ceremony',
            level: record.outcome === 'ok' ? 'info' : 'warning',
            message: `#${record.seq} ${record.purpose} (${record.outcome})`,
            data: { ...record },
        })
    } catch {
        // telemetry never gets to break the ceremony it is measuring
    }
}

function capture(event: string, properties: Record<string, unknown>): void {
    try {
        posthog.capture(event, properties)
    } catch {
        // posthog may not be initialised yet; the local log still has the record
    }
}

function safeErrorCode(error: unknown): string | undefined {
    try {
        return classifyPasskeyError(error)?.code
    } catch {
        return undefined
    }
}

function safeNativeErrorCode(error: unknown): string | undefined {
    try {
        return nativeErrorCode(error)
    } catch {
        return undefined
    }
}

function safeNativeReason(error: unknown): NativePasskeyFailure | undefined {
    try {
        return nativePasskeyFailure(error)
    } catch {
        return undefined
    }
}

function safeExtra(extra?: () => Record<string, unknown>): Record<string, unknown> {
    try {
        return extra?.() ?? {}
    } catch {
        return {}
    }
}

async function trace<T>(
    kind: 'get' | 'create',
    options: CredentialCreationOptions | CredentialRequestOptions | undefined,
    run: () => Promise<T>
): Promise<T> {
    hydrate()
    const startedAt = Date.now()
    const flow = flowStack[flowStack.length - 1]
    inFlight += 1
    const base = {
        seq: ++seq,
        kind,
        purpose: purposeStack.length > 0 ? purposeStack.join('>') : 'unknown',
        flow: flow?.name ?? null,
        flowId: flow?.id ?? null,
        startedAt,
        gapMs: lastEndedAt === null ? null : startedAt - lastEndedAt,
        native: isCapacitor(),
        overlapped: inFlight > 1,
        openFlows: flowStack.length,
        ...describeOptions(kind, options),
    }
    openCallStarts.set(base.seq, startedAt)

    try {
        const result = await run()
        commit({ ...base, ...describeResult(result), durationMs: Date.now() - startedAt, outcome: 'ok' })
        return result
    } catch (error) {
        commit({
            ...base,
            durationMs: Date.now() - startedAt,
            outcome: 'error',
            errorName: error instanceof Error ? error.name : 'unknown',
            errorCode: safeErrorCode(error),
            nativeErrorCode: safeNativeErrorCode(error),
            nativeReason: safeNativeReason(error),
        })
        throw error
    } finally {
        inFlight -= 1
        openCallStarts.delete(base.seq)
    }
}

/**
 * The newest ceremony of `kind` whose innermost purpose is `purpose` and that
 * started at or after `sinceMs`. The bound keeps a caller from reading an
 * earlier attempt: the log survives reloads, and a failure before the OS
 * prompt (prepare, paymaster, a ceremony timeout) records nothing.
 */
export function latestCeremony(
    kind: 'get' | 'create',
    purpose: CeremonyPurpose,
    sinceMs: number
): CeremonyRecord | undefined {
    hydrate()
    for (let index = log.length - 1; index >= 0; index--) {
        const record = log[index]
        if (record.kind === kind && record.startedAt >= sinceMs && record.purpose.split('>').pop() === purpose) {
            return record
        }
    }
    return undefined
}

/**
 * The newest navigator.credentials call still waiting on the OS, so a guard
 * timeout can tell a live sheet from a call that never started or never called
 * back. Undefined until the wrapper is installed, when nothing can be known.
 */
export function openCredentialCall(): { inFlight: boolean; elapsedMs?: number } | undefined {
    if (!installed) return undefined
    let newest: number | undefined
    for (const startedAt of openCallStarts.values()) {
        if (newest === undefined || startedAt > newest) newest = startedAt
    }
    return newest === undefined ? { inFlight: false } : { inFlight: true, elapsedMs: Date.now() - newest }
}

/**
 * Patches `navigator.credentials` in place. On native this MUST run after
 * `CapacitorPasskey.autoShimWebAuthn()` resolves — patching first would capture
 * the browser implementation the shim then replaces, and the wrapper would both
 * miss every ceremony and call an API that doesn't work inside the WebView.
 */
export function installCeremonyTelemetry(): void {
    if (installed) return
    if (typeof navigator === 'undefined' || !navigator.credentials) return
    installed = true
    hydrate()

    const credentials = navigator.credentials
    const originalGet = credentials.get.bind(credentials)
    const originalCreate = credentials.create.bind(credentials)

    credentials.get = ((options?: CredentialRequestOptions) =>
        trace('get', options, () => originalGet(options))) as typeof credentials.get
    credentials.create = ((options?: CredentialCreationOptions) =>
        trace('create', options, () => originalCreate(options))) as typeof credentials.create
}

export function beginCeremonyFlow(name: string): string {
    const id = `${name}-${++flowCounter}-${Date.now()}`
    flowStack.push({ id, name, startedAt: Date.now(), fromSeq: seq })
    return id
}

export function endCeremonyFlow(id: string, extra: Record<string, unknown> = {}): void {
    const index = flowStack.findIndex((frame) => frame.id === id)
    if (index === -1) return
    const [frame] = flowStack.splice(index, 1)
    const ceremonies = log.filter((record) => record.seq > frame.fromSeq && record.startedAt >= frame.startedAt)

    capture(ANALYTICS_EVENTS.WEBAUTHN_CEREMONY_FLOW, {
        flow: frame.name,
        flow_id: frame.id,
        ceremony_count: ceremonies.length,
        purposes: ceremonies.map((record) => record.purpose),
        outcomes: ceremonies.map((record) => record.outcome),
        total_ms: Date.now() - frame.startedAt,
        native: isCapacitor(),
        ...extra,
    })
}

export async function withCeremonyFlow<T>(
    name: string,
    fn: () => Promise<T>,
    extra?: () => Record<string, unknown>
): Promise<T> {
    const id = beginCeremonyFlow(name)
    try {
        const result = await fn()
        endCeremonyFlow(id, { outcome: 'ok', ...safeExtra(extra) })
        return result
    } catch (error) {
        endCeremonyFlow(id, {
            outcome: 'error',
            error_name: error instanceof Error ? error.name : 'unknown',
            ...safeExtra(extra),
        })
        throw error
    }
}

export async function withCeremonyPurpose<T>(purpose: CeremonyPurpose, fn: () => Promise<T>): Promise<T> {
    purposeStack.push(purpose)
    try {
        return await fn()
    } finally {
        purposeStack.pop()
    }
}
