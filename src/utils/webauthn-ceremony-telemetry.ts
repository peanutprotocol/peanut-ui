import * as Sentry from '@sentry/nextjs'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { isCapacitor } from '@/utils/capacitor'
import { classifyPasskeyError } from '@/utils/webauthn.utils'

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
    allowCredentials?: number
    rpId?: string
    native: boolean
    /** True when another ceremony was already in flight — attribution is unreliable for this row. */
    overlapped: boolean
    openFlows: number
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
            allow_credentials: record.allowCredentials,
            overlapped: record.overlapped,
            open_flows: record.openFlows,
            native: record.native,
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

    try {
        const result = await run()
        commit({ ...base, durationMs: Date.now() - startedAt, outcome: 'ok' })
        return result
    } catch (error) {
        commit({
            ...base,
            durationMs: Date.now() - startedAt,
            outcome: 'error',
            errorName: error instanceof Error ? error.name : 'unknown',
            errorCode: safeErrorCode(error),
        })
        throw error
    } finally {
        inFlight -= 1
    }
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
