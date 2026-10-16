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

/**
 * Arguments for `zerodevPaymaster.sponsorUserOperation`.
 * viem passes preparation-only fields to the callback before removing them
 * from the final op. ZeroDev 5.5.7 strips `context` but serializes the remaining
 * fields, so `paymasterContext` reached the provider and failed validation.
 */
export function sponsorUserOperationArgs<
    T extends { context?: unknown; paymasterContext?: unknown; parameters?: unknown },
>(userOperation: T): { userOperation: T; shouldOverrideFee: true; shouldConsume: boolean } {
    const { paymasterContext: _paymasterContext, parameters: _parameters, ...rpcOperation } = userOperation
    return {
        // Both removed fields are optional callback metadata. Retain T's
        // discriminated EntryPoint union, which a plain Omit would collapse.
        userOperation: rpcOperation as T,
        shouldOverrideFee: true,
        shouldConsume: !isPaymasterPreviewContext(userOperation.context),
    }
}
