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
    | 'login_auto'
    | 'registration'
    | 'app_lock'
    | 'ephemeral_enable'

export type CeremonyRecord = {
    seq: number
    kind: 'get' | 'create'
    /** Attempt outcome recorded without invoking navigator.credentials. */
    synthetic?: boolean
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
     * ceremony, or of a registration refused for its layout (TASK-24498).
     * The on-chain WebAuthn validator reads the challenge at a fixed
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
    timing?: CeremonyTimingProperties
}

type Phase = 'options' | 'native' | 'verify'
type CeremonyTimingProperties = {
    attempt_id: string
    options_ms: number | null
    native_ms: number | null
    verify_ms: number | null
    total_ms: number
    backgrounded_ms: number
    timeout_phase?: Phase | 'other'
}

export type CeremonyTiming = {
    id: string
    activate(): void
    phase(phase: Phase): () => void
    attach(record: CeremonyRecord): void
    update(record: CeremonyRecord, fields: Partial<CeremonyRecord>): void
    request(path: string): void
    timeout(): void
    finish(error?: unknown): void
    dispose(): void
    operationStarted(): void
    operationSettled(): void
    purpose(): string
    bindChallenge(challenge: unknown): void
}
const activeTimings = new Map<string, CeremonyTiming>()
const pendingTimings = new Map<string, CeremonyTiming>()
let pendingTimingCount = 0
// Retain bounded challenge ownership so a retired SDK continuation cannot borrow a retry's timing.
const challengeTimings = new Map<string, CeremonyTiming>()
const TIMING_CORRELATION_LIMIT = 40
let attemptCounter = 0
const attemptPrefix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`

const safely = (fn: () => void): void => {
    try {
        fn()
    } catch {}
}

function rememberTiming(map: Map<string, CeremonyTiming>, key: unknown, timing: CeremonyTiming): void {
    if (typeof key !== 'string' || !key || key.length > 4096) return
    map.delete(key)
    map.set(key, timing)
    if (map.size > TIMING_CORRELATION_LIMIT) map.delete(map.keys().next().value!)
}

function challengeKey(value: unknown): string | undefined {
    if (typeof value === 'string') return value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    if (!(value instanceof ArrayBuffer) && !ArrayBuffer.isView(value)) return undefined
    const bytes = bytesOf(value)
    if (bytes.length > 4096) return undefined
    return btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')
}

export function currentCeremonyTiming(): CeremonyTiming | undefined {
    return [...activeTimings.values()].pop()
}

export function timingForCredentialOptions(options?: {
    publicKey?: { challenge?: unknown }
}): CeremonyTiming | undefined {
    try {
        const key = challengeKey(options?.publicKey?.challenge)
        const pending = [...pendingTimings.values()].filter((timing) => timing.purpose() === currentCeremonyPurpose())
        const owner = key ? challengeTimings.get(key) : undefined
        if (owner) return owner
        const current = currentCeremonyTiming()
        if (key && (!current || pendingTimingCount > 1)) return undefined
        return current ?? (pendingTimingCount === 1 && pending.length === 1 ? pending[0] : undefined)
    } catch {
        return undefined
    }
}

export function startCeremonyPhase(timing: CeremonyTiming | undefined, phase: Phase): () => void {
    try {
        return timing?.phase(phase) ?? (() => {})
    } catch {
        return () => {}
    }
}

export function beginCeremonyTiming(
    startedAt: number = Date.now(),
    purpose = currentCeremonyPurpose()
): CeremonyTiming {
    hydrate()
    const id = `${attemptPrefix}-${++attemptCounter}`
    const flow = flowStack[flowStack.length - 1]
    const phases: Partial<Record<Phase, { started: number; elapsed: number; pending: number }>> = {}
    const records: CeremonyRecord[] = []
    let finished = false
    let snapshot: CeremonyTimingProperties | undefined
    let timedOut = false
    let hiddenAt: number | undefined
    let backgrounded = 0
    let kind: 'get' | 'create' = purpose.split('>').pop() === 'registration' ? 'create' : 'get'
    let listening = false
    let operationPending = false
    let rawOperationPending = false
    const elapsed = (since: number) => Math.max(0, Date.now() - since)
    const onVisibility = () =>
        safely(() => {
            if (document.hidden && hiddenAt === undefined) hiddenAt = Date.now()
            if (!document.hidden && hiddenAt !== undefined) {
                backgrounded += elapsed(hiddenAt)
                hiddenAt = undefined
            }
        })
    safely(() => {
        if (typeof document === 'undefined') return
        onVisibility()
        document.addEventListener('visibilitychange', onVisibility)
        listening = true
    })
    const freeze = () => {
        if (snapshot) return
        const duration = (phase: Phase) => {
            const entry = phases[phase]
            if (!entry || (phase === 'native' && entry.pending > 0)) return null
            return entry.elapsed + (entry.pending > 0 ? elapsed(entry.started) : 0)
        }
        snapshot = {
            attempt_id: id,
            options_ms: duration('options'),
            native_ms: duration('native'),
            verify_ms: duration('verify'),
            total_ms: elapsed(startedAt),
            backgrounded_ms: backgrounded + (hiddenAt === undefined ? 0 : elapsed(hiddenAt)),
            ...(timedOut
                ? {
                      timeout_phase:
                          (['verify', 'native', 'options'] as const).find(
                              (phase) => (phases[phase]?.pending ?? 0) > 0
                          ) ?? 'other',
                  }
                : {}),
        }
        if (listening) {
            document.removeEventListener('visibilitychange', onVisibility)
            listening = false
        }
    }
    const timing = {
        id,
        activate() {
            safely(() => {
                if (!finished) {
                    if (!operationPending) {
                        operationPending = true
                        pendingTimingCount += 1
                    }
                    activeTimings.delete(id)
                    activeTimings.set(id, timing)
                    rememberTiming(pendingTimings, id, timing)
                }
            })
        },
        purpose: () => purpose,
        bindChallenge(challenge: unknown) {
            safely(() => rememberTiming(challengeTimings, challengeKey(challenge), timing))
        },
        operationStarted() {
            safely(() => {
                rawOperationPending = true
            })
        },
        operationSettled() {
            safely(() => {
                rawOperationPending = false
                if (operationPending) {
                    operationPending = false
                    pendingTimingCount -= 1
                }
                pendingTimings.delete(id)
            })
        },
        phase(phase: Phase) {
            if (finished || snapshot) return () => {}
            const entry = phases[phase] ?? { started: Date.now(), elapsed: 0, pending: 0 }
            if (entry.pending === 0) entry.started = Date.now()
            entry.pending += 1
            phases[phase] = entry
            let settled = false
            return () =>
                safely(() => {
                    if (settled || finished || snapshot) return
                    settled = true
                    entry.pending -= 1
                    if (entry.pending === 0) entry.elapsed += elapsed(entry.started)
                })
        },
        attach(record: CeremonyRecord) {
            safely(() => {
                if (!finished && !snapshot) {
                    if (purpose === 'unknown') purpose = record.purpose
                    Object.assign(record, { purpose, flow: flow?.name ?? null, flowId: flow?.id ?? null })
                    records.push(record)
                }
            })
        },
        update(record: CeremonyRecord, fields: Partial<CeremonyRecord>) {
            safely(() => {
                if (!finished && !snapshot) Object.assign(record, fields)
            })
        },
        request(path: string) {
            safely(() => {
                if (finished || snapshot) return
                if (path.includes('/register/')) kind = 'create'
                if (purpose === 'unknown') purpose = currentCeremonyPurpose()
            })
        },
        timeout() {
            safely(() => {
                if (!finished) {
                    timedOut = true
                    freeze()
                }
            })
        },
        finish(error?: unknown) {
            safely(() => {
                if (finished) return
                if (safeErrorCode(error) === 'CEREMONY_TIMEOUT') timedOut = true
                freeze()
                finished = true
                activeTimings.delete(id)
                const fallback: CeremonyRecord | undefined =
                    records.length === 0
                        ? {
                              seq: ++seq,
                              kind,
                              synthetic: true,
                              purpose,
                              flow: flow?.name ?? null,
                              flowId: flow?.id ?? null,
                              startedAt,
                              durationMs: snapshot!.total_ms,
                              gapMs: lastEndedAt === null ? null : startedAt - lastEndedAt,
                              outcome: 'ok',
                              native: isCapacitor(),
                              overlapped: false,
                              openFlows: flowStack.length,
                          }
                        : undefined
                for (const record of fallback ? [fallback] : records) {
                    commit({
                        ...record,
                        durationMs:
                            snapshot!.native_ms === null
                                ? Math.max(0, startedAt + snapshot!.total_ms - record.startedAt)
                                : record.durationMs,
                        timing: snapshot,
                        ...(error !== undefined || timedOut
                            ? {
                                  outcome: 'error' as const,
                                  errorName: timedOut
                                      ? 'CeremonyTimeoutError'
                                      : error instanceof Error
                                        ? error.name
                                        : 'unknown',
                                  errorCode: timedOut ? 'CEREMONY_TIMEOUT' : safeErrorCode(error),
                                  nativeErrorCode: safeNativeErrorCode(error),
                                  nativeReason: safeNativeReason(error),
                              }
                            : {}),
                    })
                }
            })
        },
        dispose() {
            safely(() => {
                activeTimings.delete(id)
                if (!rawOperationPending) timing.operationSettled()
                if (listening) document.removeEventListener('visibilitychange', onVisibility)
                listening = false
            })
        },
    }
    return timing
}

export function timingForPasskeyRequest(init?: RequestInit): CeremonyTiming | undefined {
    try {
        if (typeof init?.body === 'string') {
            if (init.body.length > 65_536) return undefined
            const body = JSON.parse(init.body)
            const clientData = body?.cred?.response?.clientDataJSON
            if (clientData !== undefined) {
                if (typeof clientData !== 'string') return undefined
                const key = challengeKey(JSON.parse(atob(clientData.replace(/-/g, '+').replace(/_/g, '/')))?.challenge)
                return key ? challengeTimings.get(key) : undefined
            }
        }
        return currentCeremonyTiming()
    } catch {
        return undefined
    }
}

export function observePasskeyOptions(response: Response, timing: CeremonyTiming): void {
    safely(() => {
        // Observe the SDK's existing read without awaiting another read or replacing its promise.
        const json = response.json.bind(response)
        response.json = () => {
            const result = json()
            void result.then(
                (body) =>
                    safely(() => {
                        timing.bindChallenge(body?.challenge ?? body?.options?.challenge)
                    }),
                () => {}
            )
            return result
        }
    })
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

/**
 * The layout facts a refused registration carries (PasskeyProviderUnsupportedError,
 * TASK-24498). Signup refuses the sorted layout before the SDK sees the
 * credential, so without this the ceremony would record an error with no
 * offset and `challenge_offset` would stop counting the layout it refuses.
 */
function describeRefusal(error: unknown): Pick<CeremonyRecord, 'challengeOffset' | 'backupEligible'> {
    try {
        const { challengeOffset, backupEligible } = error as { challengeOffset?: unknown; backupEligible?: unknown }
        return {
            ...(typeof challengeOffset === 'number' ? { challengeOffset } : {}),
            ...(typeof backupEligible === 'boolean' ? { backupEligible } : {}),
        }
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
            ...record.timing,
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
    let timing: CeremonyTiming | undefined
    safely(() => {
        timing = timingForCredentialOptions(options)
    })
    const unattributedGuardedCall = !timing && (activeTimings.size > 0 || pendingTimingCount > 0)
    let ownsTiming = false
    safely(() => {
        if (!timing && !unattributedGuardedCall) {
            timing = beginCeremonyTiming(startedAt)
            ownsTiming = true
        }
    })
    let settleNative = () => {}
    safely(() => {
        settleNative = timing?.phase('native') ?? settleNative
    })
    inFlight += 1
    const base: CeremonyRecord = {
        seq: ++seq,
        kind,
        purpose: currentCeremonyPurpose(),
        flow: flow?.name ?? null,
        flowId: flow?.id ?? null,
        startedAt,
        durationMs: 0,
        outcome: 'ok',
        gapMs: lastEndedAt === null ? null : startedAt - lastEndedAt,
        native: isCapacitor(),
        overlapped: inFlight > 1,
        openFlows: flowStack.length,
        ...describeOptions(kind, options),
    }
    openCallStarts.set(base.seq, startedAt)
    timing?.attach(base)

    try {
        const result = await run()
        settleNative()
        const fields = { ...describeResult(result), durationMs: Date.now() - startedAt, outcome: 'ok' as const }
        if (timing) timing.update(base, fields)
        else if (!unattributedGuardedCall) commit({ ...base, ...fields })
        if (ownsTiming) timing?.finish()
        return result
    } catch (error) {
        if (safeErrorCode(error) !== 'CEREMONY_TIMEOUT') settleNative()
        const fields: Partial<CeremonyRecord> = {
            ...describeRefusal(error),
            durationMs: Date.now() - startedAt,
            outcome: 'error',
            errorName: error instanceof Error ? error.name : 'unknown',
            errorCode: safeErrorCode(error),
            nativeErrorCode: safeNativeErrorCode(error),
            nativeReason: safeNativeReason(error),
        }
        if (timing) timing.update(base, fields)
        else if (!unattributedGuardedCall) commit({ ...base, ...fields })
        if (ownsTiming) timing?.finish(error)
        throw error
    } finally {
        inFlight -= 1
        openCallStarts.delete(base.seq)
        if (ownsTiming) timing?.dispose()
    }
}

/**
 * The newest ceremony of `kind` whose innermost purpose is `purpose` and that
 * started at or after `sinceMs`. The bound keeps a caller from reading an
 * earlier attempt: the log survives reloads. Synthetic attempt outcomes
 * recorded before a credential invocation are excluded.
 */
export function latestCeremony(
    kind: 'get' | 'create',
    purpose: CeremonyPurpose,
    sinceMs: number
): CeremonyRecord | undefined {
    hydrate()
    for (let index = log.length - 1; index >= 0; index--) {
        const record = log[index]
        if (
            !record.synthetic &&
            record.kind === kind &&
            record.startedAt >= sinceMs &&
            record.purpose.split('>').pop() === purpose
        ) {
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

/** The purpose stack of the ceremony running now, innermost last, e.g. `kernel_migration>user_op`. */
export function currentCeremonyPurpose(): string {
    return purposeStack.length > 0 ? purposeStack.join('>') : 'unknown'
}

export async function withCeremonyPurpose<T>(purpose: CeremonyPurpose, fn: () => Promise<T>): Promise<T> {
    purposeStack.push(purpose)
    try {
        return await fn()
    } finally {
        purposeStack.pop()
    }
}
