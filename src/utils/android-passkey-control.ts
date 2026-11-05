import { currentAndroidPasskeyScope, enableAndroidPasskeyScopes } from './android-passkey-scope'
import type { CapacitorPasskeyPlugin } from '@capgo/capacitor-passkey'
import posthog from 'posthog-js'
import { addBreadcrumb } from './sentry-lazy'
import { nativeCapability } from './native-capability'
import { createAndroidPasskeyController, type AndroidPasskeyCancelAck } from './android-passkey-controller'
import { sanitizePasskeyDiagnostics } from './android-passkey-diagnostics'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { assertPasskeyRegistrationCompatible } from './passkey-registration-compatibility'
import { nativePasskeyFailure } from './native-passkey-errors'

interface Controls {
    cancelRequest(options: { requestId: string }): Promise<AndroidPasskeyCancelAck>
    getDiagnostics(): Promise<Record<string, unknown>>
}
const native = nativeCapability<Controls>('CapacitorPasskey', { platforms: ['android'] })

/**
 * What the installed binary does with cancelRequest:
 * - release (patch peanut.2+): frees the native slot at once; late provider callbacks are dropped natively.
 * - confirm (patch peanut.1): answers only after the provider's terminal callback, and blocks new
 *   requests until then. androidx Play Services (Android 13 and older) suppresses that callback once
 *   the CancellationSignal fires, so cancelling there makes the block permanent; it is skipped.
 * - none (pre-patch or unknown): no control API; nothing is sent.
 */
export type AndroidPasskeyContract = 'release' | 'confirm' | 'none' | 'unknown'
let contract: AndroidPasskeyContract = 'unknown'
let androidSdk: number | undefined

export function androidPasskeyContract(facts: Record<string, unknown>): AndroidPasskeyContract {
    const patch = /^8\.2\.2-peanut\.(\d+)$/.exec(typeof facts.pluginVersion === 'string' ? facts.pluginVersion : '')
    if (!patch) return typeof facts.pluginVersion === 'string' ? 'none' : 'unknown'
    return Number(patch[1]) >= 2 ? 'release' : 'confirm'
}

function learnContract(facts: Record<string, unknown>) {
    const learned = androidPasskeyContract(facts)
    if (learned !== 'unknown') contract = learned
    if (typeof facts.androidSdk === 'number') androidSdk = facts.androidSdk
}

const signalsCancel = () => contract === 'release' || (contract === 'confirm' && (androidSdk ?? 0) >= 34)

type PluginRejection = { code?: unknown; message?: unknown; data?: { name?: unknown } }
const pluginErrorName = (error: unknown) => {
    const rejection = (error ?? {}) as PluginRejection
    return typeof rejection.code === 'string' ? rejection.code : rejection.data?.name
}

export function isAndroidNativePendingError(error: unknown): boolean {
    const message = (error as PluginRejection | undefined)?.message
    return (
        pluginErrorName(error) === 'InvalidStateError' &&
        typeof message === 'string' &&
        /passkey request is already pending/i.test(message)
    )
}

// The provider names user, device and credential outcomes; anything it leaves unnamed may be contention.
const isUnnamedNativeFailure = (error: unknown) => {
    const name = pluginErrorName(error)
    return !nativePasskeyFailure(error) && (name === undefined || name === 'UnknownError')
}

function lifecycle(facts: Record<string, string | number | boolean>) {
    const sanitized = sanitizePasskeyDiagnostics({ ...facts, contract })
    addBreadcrumb({ category: 'webauthn.android', level: 'info', message: 'Native passkey lifecycle', data: sanitized })
    posthog.capture(ANALYTICS_EVENTS.PASSKEY_NATIVE_LIFECYCLE, sanitized)
}

const controller = createAndroidPasskeyController({
    cancel: (requestId) => native.call('cancelRequest', { requestId }, () => ({ cancelled: false, unsupported: true })),
    signalsCancel,
    isNativePending: isAndroidNativePendingError,
    onDiagnostic: lifecycle,
})
const installed = new WeakSet<object>()

export function cancelActiveAndroidPasskeyRequest(): void {
    controller.cancelActive()
}

function readDiagnostics(): Promise<Record<string, unknown>> {
    // Native metadata is optional and bounded, never on the authentication critical path.
    let timer: ReturnType<typeof setTimeout>
    const deadline = new Promise<Record<string, unknown>>((resolve) => {
        timer = setTimeout(() => resolve({}), 1000)
    })
    return Promise.race([native.call('getDiagnostics', undefined, () => ({})), deadline])
        .then((metadata) => {
            learnContract(metadata)
            return metadata
        })
        .catch(() => ({}))
        .finally(() => clearTimeout(timer))
}

function report(
    operation: 'get' | 'create',
    started: number,
    outcome: 'success' | 'error' | 'timeout',
    error?: unknown
) {
    const durationMs = Date.now() - started
    void readDiagnostics()
        .then((metadata) => {
            const nativeException = (error as { data?: { nativeException?: unknown } } | undefined)?.data
                ?.nativeException
            const facts = sanitizePasskeyDiagnostics({
                ...metadata,
                operation,
                outcome,
                durationMs,
                nativeException,
                contract,
            })
            addBreadcrumb({
                category: 'webauthn.android',
                level: 'info',
                message: 'Native passkey request completed',
                data: facts,
            })
            posthog.capture(ANALYTICS_EVENTS.PASSKEY_NATIVE_DIAGNOSTIC, facts)
        })
        .catch(() => {})
}

/** Install before autoShimWebAuthn so all login/signup/signing calls share ownership. */
export function installAndroidPasskeyControl(plugin: CapacitorPasskeyPlugin): void {
    if (!native.isSupportedPlatform() || installed.has(plugin)) return
    enableAndroidPasskeyScopes()
    void readDiagnostics()
    for (const method of ['getCredential', 'createCredential'] as const) {
        const invoke = plugin[method].bind(plugin)
        const wrapped = (options: Parameters<typeof invoke>[0]) => {
            const scope = currentAndroidPasskeyScope()
            if (scope?.expired)
                return Promise.reject(
                    Object.assign(new Error('Passkey flow has expired'), { name: 'CeremonyTimeoutError' })
                )
            const started = Date.now()
            const operation = method === 'getCredential' ? 'get' : 'create'
            let invoked = false
            return controller
                .run<Awaited<ReturnType<typeof invoke>>>((requestId, { contended }) => {
                    invoked = true
                    if (scope) scope.cancel = () => controller.cancelRequest(requestId)
                    // The pinned plugin patch forwards this control ID outside WebAuthn JSON.
                    return Promise.resolve(invoke({ ...options, requestId } as never)).catch((cause: unknown) => {
                        if (!contended || isAndroidNativePendingError(cause) || !isUnnamedNativeFailure(cause))
                            throw cause
                        lifecycle({ phase: 'contended_failure' })
                        throw Object.assign(new Error('The previous passkey request is still closing'), {
                            name: 'PasskeyRequestSettlingError',
                            cause,
                        })
                    })
                })
                .then((result) => {
                    // Reject before the shim lets the SDK submit register/verify and reserve the username.
                    if (method === 'createCredential') assertPasskeyRegistrationCompatible(result)
                    return result
                })
                .then(
                    (result) => {
                        report(operation, started, 'success')
                        return result
                    },
                    (error: unknown) => {
                        if (invoked)
                            report(
                                operation,
                                started,
                                (error as Error)?.name === 'CeremonyTimeoutError' ? 'timeout' : 'error',
                                error
                            )
                        throw error
                    }
                )
        }
        // Each method retains its original argument/result type at the public boundary.
        plugin[method] = wrapped as typeof plugin.getCredential & typeof plugin.createCredential
    }
    installed.add(plugin)
}
