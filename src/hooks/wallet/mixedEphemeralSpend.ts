import type { Chain, Hash, Hex, PublicClient, TransactionReceipt } from 'viem'
import { encodeFunctionData, erc20Abi } from 'viem'
import type { KernelValidator } from '@zerodev/sdk/types'
import { PEANUT_WALLET_TOKEN } from '@/constants/zerodev.consts'
import { rainCoordinatorAbi } from '@/constants/rain.consts'
import { buildRainWithdrawTypedData } from '@/utils/rainWithdraw.utils'
import type { PrepareRainWithdrawalResponse } from '@/services/rain'
import { createEphemeralSpendSession, type EphemeralCall } from '@/utils/ephemeralSpendKey'
import { rescueUserOpReceipt } from '@/utils/userop-rescue.utils'

/*
 * One-tap mixed spend: the single
 * passkey tap signs the permission-enable for a per-transaction ephemeral key
 * (see ephemeralSpendKey.ts), which then silently signs BOTH the Rain admin
 * EIP-712 (consumed via the kernel's ERC-1271 during withdrawAsset) and the
 * batched UserOp.
 *
 * FALLBACK SAFETY — why the caller may retry the passkey path after ANY
 * failure here, even an ambiguous post-broadcast one: the fallback reuses the
 * SAME prep, so both attempts carry the same adminNonce. The coordinator
 * increments adminNonce on execution, so whichever UserOp lands first wins and
 * the other's withdrawAsset reverts — taking its whole batch down atomically.
 * Double-spend is structurally impossible as long as the prep is not re-made.
 */

export interface MixedEphemeralSpendArgs {
    publicClient: PublicClient
    chain: Chain
    /** From useKernelClient().getPatchedSudoValidator (v0.0.3 PATCHED). */
    patchedSudoValidator: KernelValidator
    /** The user's kernel account address (= Rain admin). */
    accountAddress: Hex
    prep: PrepareRainWithdrawalResponse
    /** Final recipient transfer, when the flow has one. */
    recipient?: Hex
    requiredUsdcAmount: bigint
    subsequentCalls: { to: Hex; value: bigint; data: Hex }[]
}

export type MixedEphemeralSpendResult =
    | { ok: true; userOpHash: Hash; receipt: TransactionReceipt | null }
    | { ok: false; reason: string }

export function buildWithdrawCall(prep: PrepareRainWithdrawalResponse, adminSignature: Hex): EphemeralCall {
    return {
        to: prep.coordinatorAddress as Hex,
        value: 0n,
        data: encodeFunctionData({
            abi: rainCoordinatorAbi,
            functionName: 'withdrawAsset',
            args: [
                prep.collateralProxy as Hex,
                prep.tokenAddress as Hex,
                BigInt(prep.amount),
                prep.recipientAddress as Hex,
                BigInt(prep.expiresAt),
                prep.executorSalt as Hex,
                prep.executorSignature as Hex,
                [prep.adminSalt as Hex],
                [adminSignature],
                prep.directTransfer,
            ],
        }),
    }
}

export async function tryMixedEphemeralSpend(args: MixedEphemeralSpendArgs): Promise<MixedEphemeralSpendResult> {
    const { publicClient, chain, patchedSudoValidator, accountAddress, prep, recipient, requiredUsdcAmount } = args

    let dispose: (() => void) | undefined
    try {
        const transferCall: EphemeralCall | null = recipient
            ? {
                  to: PEANUT_WALLET_TOKEN as Hex,
                  value: 0n,
                  data: encodeFunctionData({
                      abi: erc20Abi,
                      functionName: 'transfer',
                      args: [recipient, requiredUsdcAmount],
                  }),
              }
            : null

        // Placeholder admin signature: the scoping only reads targets, selectors
        // and the static leading args, all of which are final here.
        const scopedCalls: EphemeralCall[] = [
            buildWithdrawCall(prep, '0x'),
            ...(transferCall ? [transferCall] : []),
            ...args.subsequentCalls,
        ]

        const session = await createEphemeralSpendSession({
            publicClient,
            chain,
            patchedSudoValidator,
            scope: {
                accountAddress,
                calls: scopedCalls,
                withdrawAmountCap: BigInt(prep.amount),
                collateralProxy: prep.collateralProxy as Hex,
                coordinatorAddress: prep.coordinatorAddress as Hex,
            },
        })
        dispose = session.dispose

        // Silent: the ephemeral key signs; the coordinator verifies it against
        // the kernel via ERC-1271 once the permission is installed by this same
        // UserOp's validation phase.
        const adminSignature = (await session.account.signTypedData(buildRainWithdrawTypedData(prep, chain.id))) as Hex

        // uninstallCall last: the permission destroys itself at the end of the
        // same UserOp — after this transaction the ephemeral key has no
        // authority of any kind, on-chain or off.
        const calls = [
            buildWithdrawCall(prep, adminSignature),
            ...(transferCall ? [transferCall] : []),
            ...args.subsequentCalls,
            session.uninstallCall,
        ]

        const userOpHash = await session.client.sendUserOperation({
            account: session.account,
            callData: await session.account.encodeCalls(calls),
        })

        let receipt: TransactionReceipt | null = null
        try {
            const userOpReceipt = await session.client.waitForUserOperationReceipt({ hash: userOpHash })
            /*
             * A mined-but-reverted op is THE signature of the 1271-ordering
             * assumption failing (permission not consulted at execution time):
             * the revert rolled adminNonce back, so the passkey fallback with
             * the same prep will succeed. Report failure, not success.
             */
            if (!userOpReceipt.success) {
                return { ok: false, reason: 'ephemeral userOp reverted on-chain' }
            }
            receipt = userOpReceipt.receipt
        } catch (error) {
            // Shared rescue (see rescueUserOpReceipt): a transport blip must
            // not leave useSpendBundle stamping the withdrawal with the userOp
            // hash — unresolvable by webhook reconciliation (TASK-21147). A
            // rescued REVERTED op takes the same ok:false exit as the check
            // above so the passkey fallback still runs.
            const rescued = await rescueUserOpReceipt(session.client, userOpHash, error, 'mixed-ephemeral-spend')
            if (rescued && !rescued.success) {
                return { ok: false, reason: 'ephemeral userOp reverted on-chain' }
            }
            receipt = rescued?.receipt ?? null
        }
        return { ok: true, userOpHash, receipt }
    } catch (e) {
        return { ok: false, reason: e instanceof Error ? e.message : String(e) }
    } finally {
        dispose?.()
    }
}
