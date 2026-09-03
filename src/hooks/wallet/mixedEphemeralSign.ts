import type { Chain, Hex, PublicClient } from 'viem'
import { encodeFunctionData, erc20Abi } from 'viem'
import type { KernelValidator } from '@zerodev/sdk/types'
import { signUserOperation } from '@zerodev/sdk/actions'
import { PEANUT_WALLET_TOKEN, USER_OP_ENTRY_POINT } from '@/constants/zerodev.consts'
import { buildRainWithdrawTypedData } from '@/utils/rainWithdraw.utils'
import type { PrepareRainWithdrawalResponse } from '@/services/rain'
import { createEphemeralSpendSession, type EphemeralCall } from '@/utils/ephemeralSpendKey'
import { buildWithdrawCall } from './mixedEphemeralSpend'
import type { SignedUserOpData } from './useSignUserOp'

/*
 * Sign-only twin of tryMixedEphemeralSpend for the
 * engine whose UserOp the BACKEND broadcasts (QR pay, Manteca withdraw, card
 * lock/cancel). Same one tap: the enable signature inside
 * createEphemeralSpendSession; the Rain admin EIP-712 and the UserOp are then
 * signed silently by the in-memory key and handed back unbroadcast.
 *
 * What differs from the broadcasting twin: nothing is sent from here, so a
 * signing failure falls back to the two-tap path with nothing at stake — but
 * a permission that turns out not to validate on-chain surfaces later, as
 * the backend's broadcast reverting, with no client-side retry.
 *
 * The permission outlives the broadcasting default because the backend
 * may hold the op briefly before eth_sendUserOperation; the op's nonce
 * still makes it single-use, and the batch still ends in the self-uninstall.
 */
export const SIGN_ONLY_TTL_SECONDS = 10 * 60

export interface MixedEphemeralSignArgs {
    publicClient: PublicClient
    chain: Chain
    /** From useKernelClient().getPatchedSudoValidator (v0.0.3 PATCHED). */
    patchedSudoValidator: KernelValidator
    /** The user's kernel account address (= Rain admin). */
    accountAddress: Hex
    prep: PrepareRainWithdrawalResponse
    recipient: Hex
    requiredUsdcAmount: bigint
}

export type MixedEphemeralSignResult = { ok: true; signedUserOp: SignedUserOpData } | { ok: false; reason: string }

export async function signMixedEphemeralSpend(args: MixedEphemeralSignArgs): Promise<MixedEphemeralSignResult> {
    const { publicClient, chain, patchedSudoValidator, accountAddress, prep, recipient, requiredUsdcAmount } = args

    let dispose: (() => void) | undefined
    try {
        const transferCall: EphemeralCall = {
            to: PEANUT_WALLET_TOKEN as Hex,
            value: 0n,
            data: encodeFunctionData({
                abi: erc20Abi,
                functionName: 'transfer',
                args: [recipient, requiredUsdcAmount],
            }),
        }

        // Placeholder admin signature: scoping reads targets, selectors and the
        // static leading args only, all final here.
        const session = await createEphemeralSpendSession({
            publicClient,
            chain,
            patchedSudoValidator,
            ttlSeconds: SIGN_ONLY_TTL_SECONDS,
            scope: {
                accountAddress,
                calls: [buildWithdrawCall(prep, '0x'), transferCall],
                withdrawAmountCap: BigInt(prep.amount),
                collateralProxy: prep.collateralProxy as Hex,
                coordinatorAddress: prep.coordinatorAddress as Hex,
            },
        })
        dispose = session.dispose

        const adminSignature = (await session.account.signTypedData(buildRainWithdrawTypedData(prep, chain.id))) as Hex

        // uninstallCall last: the permission destroys itself at the end of the
        // same UserOp, whoever broadcasts it.
        const calls = [buildWithdrawCall(prep, adminSignature), transferCall, session.uninstallCall]
        const signedUserOp = await signUserOperation(session.client, {
            account: session.account,
            callData: await session.account.encodeCalls(calls),
        })

        return {
            ok: true,
            signedUserOp: {
                signedUserOp,
                chainId: chain.id.toString(),
                entryPointAddress: USER_OP_ENTRY_POINT.address,
            },
        }
    } catch (e) {
        return { ok: false, reason: e instanceof Error ? e.message : String(e) }
    } finally {
        dispose?.()
    }
}
