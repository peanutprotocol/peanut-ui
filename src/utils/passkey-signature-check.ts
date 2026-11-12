import * as Sentry from '@sentry/nextjs'
import posthog from 'posthog-js'
import { bytesToHex, hashTypedData, type Hex, type SignableMessage, type TypedDataDefinition } from 'viem'
import { getUserOperationHash, type UserOperation } from 'viem/account-abstraction'
import type { toPasskeyValidator } from '@zerodev/passkey-validator'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { getPlatform } from '@/utils/capacitor'
import { currentCeremonyPurpose } from '@/utils/webauthn-ceremony-telemetry'
import { checkPasskeyUserOpSignature, type PasskeySignatureRejection } from '@/utils/webauthn-userop-signature'

type PasskeyValidator = Awaited<ReturnType<typeof toPasskeyValidator>>
type SigningMethod = 'signMessage' | 'signTypedData' | 'signUserOperation'

interface SignatureCheckContext {
    publicKey: { x: bigint; y: bigint }
    /** Undefined only for a client built without a chain; a userOp check then reports `check_error`. */
    chainId: number | undefined
    entryPoint: { address: `0x${string}`; version: '0.7' }
}

/**
 * Checks every passkey signature the validator returns, the way the deployed
 * on-chain validator will, before anything uses it (TASK-24840). A phone can
 * answer a pinned request with another passkey, or a provider can sign other
 * bytes; until now nothing noticed before the chain refused it.
 *
 * Log-only: a failed check sends one event and the signature is still
 * returned, so a bug here can never block a payment. ZeroDev's ceremony and
 * the Android native callback stay untouched: this only reads their output.
 */
export function withPasskeySignatureCheck(validator: PasskeyValidator, ctx: SignatureCheckContext): PasskeyValidator {
    return {
        ...validator,
        signMessage: async (args) =>
            checked('signMessage', await validator.signMessage(args), ctx, () => messageChallenge(args.message)),
        signTypedData: async (typedData) =>
            checked('signTypedData', await validator.signTypedData(typedData), ctx, () =>
                hashTypedData(typedData as TypedDataDefinition)
            ),
        signUserOperation: async (userOperation, pluginEnableSignature) =>
            checked(
                'signUserOperation',
                await validator.signUserOperation(userOperation, pluginEnableSignature),
                ctx,
                () => {
                    if (ctx.chainId === undefined) throw new Error('no chain id for the userOp hash')
                    // The hash ZeroDev's toPasskeyValidator signs.
                    return getUserOperationHash({
                        userOperation: { ...userOperation, signature: '0x' } as UserOperation<'0.7'>,
                        entryPointAddress: ctx.entryPoint.address,
                        entryPointVersion: ctx.entryPoint.version,
                        chainId: ctx.chainId,
                    })
                }
            ),
    }
}

// ZeroDev reads a string message, and a string `raw`, as hex.
function messageChallenge(message: SignableMessage): Hex {
    if (typeof message === 'string') return message as Hex
    return typeof message.raw === 'string' ? message.raw : bytesToHex(message.raw)
}

function checked(method: SigningMethod, signature: Hex, ctx: SignatureCheckContext, challenge: () => Hex): Hex {
    try {
        const check = checkPasskeyUserOpSignature({ signature, userOpHash: challenge(), publicKey: ctx.publicKey })
        if (!check.valid) report(method, check.reason, check.challengeOffset)
    } catch {
        report(method, 'check_error')
    }
    return signature
}

// One Sentry warning per method and reason per page load: an account that fails
// every signature (Android sorted layout, TASK-23931) would otherwise send one per
// signature. PostHog keeps every event; it is the count the enforcement call reads.
const sentryReported = new Set<string>()

function report(method: SigningMethod, reason: PasskeySignatureRejection | 'check_error', challengeOffset?: number) {
    try {
        const properties = {
            method,
            reason,
            platform: getPlatform(),
            purpose: currentCeremonyPurpose(),
            challenge_offset: challengeOffset,
        }
        posthog.capture(ANALYTICS_EVENTS.PASSKEY_SIGNATURE_MISMATCH, properties)
        const sentryKey = `${method}:${reason}`
        if (sentryReported.has(sentryKey)) return
        sentryReported.add(sentryKey)
        Sentry.captureMessage('Passkey signature fails the on-chain validator check', {
            level: 'warning',
            tags: { method, reason, platform: properties.platform, purpose: properties.purpose },
            extra: { challengeOffset },
        })
    } catch {
        // telemetry never gets to break the signature it checks
    }
}
