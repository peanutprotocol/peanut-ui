/**
 * How a ZeroDev sponsorship request decides whether it CONSUMES the project's
 * sponsorship policy (TASK-22692).
 *
 * viem's `prepareUserOperation` accepts a per-request `paymasterContext` and
 * hands it to the configured paymaster callback as `context` (falling back to
 * the client's `paymasterContext`). With only `getPaymasterData` configured —
 * the pre-existing setup — viem invokes that one callback exactly once per
 * preparation. The ZeroDev paymaster action accepts a `shouldConsume`
 * argument, `true` by default. This module is the only bridge between the
 * two: a request carrying the preview marker below is sponsored without a
 * policy use; every other request consumes.
 *
 * Nothing here mutates a client or a paymaster: the marker travels with the
 * request, so concurrent flows on the same client cannot leak each other's mode.
 */

export const PAYMASTER_PREVIEW_CONTEXT = Object.freeze({ sponsorship: 'preview' as const })

export function isPaymasterPreviewContext(context: unknown): boolean {
    return (
        typeof context === 'object' &&
        context !== null &&
        (context as { sponsorship?: unknown }).sponsorship === PAYMASTER_PREVIEW_CONTEXT.sponsorship
    )
}

// Preserve viem's entry-point union when removing the local context field.
type WithoutPaymasterContext<T> = T extends unknown ? Omit<T, 'paymasterContext'> : never

/**
 * viem includes `paymasterContext` in callback arguments before it removes
 * that field from the prepared operation. ZeroDev strips `context` but sends
 * `paymasterContext` to its RPC, which rejects it. Remove it from a copy here.
 */
export function sponsorUserOperationArgs<T extends { context?: unknown; paymasterContext?: unknown }>(
    userOperation: T
): { userOperation: WithoutPaymasterContext<T>; shouldOverrideFee: true; shouldConsume: boolean } {
    const { paymasterContext: _, ...operation } = userOperation
    return {
        userOperation: operation as WithoutPaymasterContext<T>,
        shouldOverrideFee: true,
        shouldConsume: !isPaymasterPreviewContext(userOperation.context),
    }
}
