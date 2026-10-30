import { currentAndroidPasskeyScope, enableAndroidPasskeyScopes } from './android-passkey-scope'
import type { CapacitorPasskeyPlugin } from '@capgo/capacitor-passkey'
import posthog from 'posthog-js'
import { addBreadcrumb } from './sentry-lazy'
import { nativeCapability } from './native-capability'
import { createAndroidPasskeyController } from './android-passkey-controller'
import { sanitizePasskeyDiagnostics } from './android-passkey-diagnostics'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { assertPasskeyRegistrationCompatible } from './passkey-registration-compatibility'

interface Controls {
    cancelRequest(options: { requestId: string }): Promise<{ cancelled: boolean }>
    getDiagnostics(): Promise<Record<string, unknown>>
}
const native = nativeCapability<Controls>('CapacitorPasskey', { platforms: ['android'] })
const controller = createAndroidPasskeyController({
    cancel: (requestId) => native.call('cancelRequest', { requestId }, () => ({ cancelled: false })),
})
const installed = new WeakSet<object>()

export function cancelActiveAndroidPasskeyRequest(): void {
    controller.cancelActive()
}

function report(
    operation: 'get' | 'create',
    started: number,
    outcome: 'success' | 'error' | 'timeout',
    error?: unknown
) {
    const durationMs = Date.now() - started
    // Native metadata is optional and bounded, never on the authentication critical path.
    let timer: ReturnType<typeof setTimeout>
    const deadline = new Promise<Record<string, unknown>>((resolve) => {
        timer = setTimeout(() => resolve({}), 1000)
    })
    void Promise.race([native.call('getDiagnostics', undefined, () => ({})), deadline])
        .then((metadata) => {
            const nativeException = (error as { data?: { nativeException?: unknown } } | undefined)?.data
                ?.nativeException
            const facts = sanitizePasskeyDiagnostics({ ...metadata, operation, outcome, durationMs, nativeException })
            addBreadcrumb({
                category: 'webauthn.android',
                level: 'info',
                message: 'Native passkey request completed',
                data: facts,
            })
            posthog.capture(ANALYTICS_EVENTS.PASSKEY_NATIVE_DIAGNOSTIC, facts)
        })
        .catch(() => {})
        .finally(() => clearTimeout(timer))
}

/** Install before autoShimWebAuthn so all login/signup/signing calls share ownership. */
export function installAndroidPasskeyControl(plugin: CapacitorPasskeyPlugin): void {
    if (!native.isSupportedPlatform() || installed.has(plugin)) return
    enableAndroidPasskeyScopes()
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
                .run<Awaited<ReturnType<typeof invoke>>>((requestId) => {
                    invoked = true
                    if (scope) scope.cancel = () => controller.cancelRequest(requestId)
                    // The pinned plugin patch forwards this control ID outside WebAuthn JSON.
                    return invoke({ ...options, requestId } as never)
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
