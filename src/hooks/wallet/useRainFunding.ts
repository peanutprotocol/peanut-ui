'use client'

import { useCallback, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { encodeFunctionData, erc20Abi, maxUint256, type Address } from 'viem'
import { peanutPublicClient } from '@/app/actions/clients'
import { useAuth } from '@/context/authContext'
import { useKernelClient } from '@/context/kernelClient.context'
import { useZeroDev } from '@/hooks/useZeroDev'
import { rainApi, type RainCardFunding } from '@/services/rain'
import {
    isRainFundingApproved,
    isRainFundingConfigValid,
    isRainFundingWallet,
    type RainFundingError,
    type RainFundingResult,
} from '@/utils/rain-funding.utils'

const RAIN_CARD_FUNDING_QUERY_KEY = 'rain-card-funding'

const readAllowance = (funding: RainCardFunding): Promise<bigint> =>
    peanutPublicClient.readContract({
        address: funding.tokenAddress as Address,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [funding.walletAddress as Address, funding.operatorAddress as Address],
    })

/**
 * Real-time funding consent for the Rain card. Rain pulls every card
 * authorization from the smart wallet through its operator contract, so the
 * card is funded only while the wallet's ERC20 allowance to that operator
 * stands.
 *
 * `approve` sets the allowance with the user's own passkey (root validator,
 * sponsored UserOp) — never the backend session key. `revoke` sets it to zero,
 * for after the last card is cancelled. Both report success only when the
 * chain shows the requested allowance:
 *   - `handleSendUserOpEncoded` throws on a rejected passkey and on a reverted
 *     UserOp, and returns a receipt only for a successful one;
 *   - it can also return `receipt: null` (receipt lost after a timeout). That
 *     is uncertain, not failed: the allowance read decides, and an unchanged
 *     allowance reports `pending` so the caller re-checks instead of sending
 *     a second UserOp blind.
 *
 * Chain, token and operator come from `GET /rain/cards/funding`; this hook
 * holds no addresses of its own. The query is keyed by user so one account's
 * allowance can never answer for another.
 */
export const useRainFunding = ({ enabled = true }: { enabled?: boolean } = {}) => {
    const queryClient = useQueryClient()
    const { user } = useAuth()
    const userId = user?.user?.userId
    const { ensureClientForChain } = useKernelClient()
    const { handleSendUserOpEncoded } = useZeroDev()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [lastError, setLastError] = useState<RainFundingError | null>(null)
    // One allowance UserOp at a time: a second tap joins the first.
    const inFlightRef = useRef<Promise<RainFundingResult> | null>(null)

    const {
        data: funding,
        isLoading,
        error: fundingError,
        refetch,
    } = useQuery<RainCardFunding>({
        queryKey: [RAIN_CARD_FUNDING_QUERY_KEY, userId],
        queryFn: () => rainApi.getCardFunding(),
        enabled: enabled && !!userId,
        staleTime: 30_000,
        // A wallet mismatch (409) never heals on retry, and the banner offers
        // an explicit retry for everything else.
        retry: false,
    })

    const setAllowance = useCallback(
        (target: 'approve' | 'revoke'): Promise<RainFundingResult> => {
            if (inFlightRef.current) return inFlightRef.current

            const run = async (): Promise<RainFundingResult> => {
                setIsSubmitting(true)
                setLastError(null)
                const fail = (error: RainFundingError): RainFundingResult => {
                    setLastError(error)
                    return { ok: false, error }
                }
                try {
                    // Always a fresh read: a cached allowance must not skip or
                    // repeat an approval. This is also what makes a retry after
                    // `pending` idempotent.
                    let live: RainCardFunding
                    try {
                        live = await rainApi.getCardFunding()
                    } catch (e) {
                        return fail({ kind: 'funding-unavailable', message: (e as Error).message })
                    }
                    if (!isRainFundingConfigValid(live)) return fail({ kind: 'config-mismatch' })

                    const kernelClient = await ensureClientForChain(live.chainId)
                    if (!isRainFundingWallet(live, kernelClient.account?.address)) {
                        return fail({ kind: 'wallet-mismatch' })
                    }

                    const isDone = (allowance: bigint) =>
                        target === 'approve' ? isRainFundingApproved(allowance) : allowance === 0n
                    const store = (allowance: bigint) =>
                        queryClient.setQueryData<RainCardFunding>([RAIN_CARD_FUNDING_QUERY_KEY, userId], {
                            ...live,
                            allowance: allowance.toString(),
                        })

                    // Idempotent: the allowance is already what the user asked for.
                    if (isDone(BigInt(live.allowance))) {
                        store(BigInt(live.allowance))
                        return { ok: true }
                    }

                    // Throws on a rejected passkey and on a reverted UserOp.
                    const { receipt } = await handleSendUserOpEncoded(
                        [
                            {
                                to: live.tokenAddress as Address,
                                value: 0n,
                                data: encodeFunctionData({
                                    abi: erc20Abi,
                                    functionName: 'approve',
                                    args: [live.operatorAddress as Address, target === 'approve' ? maxUint256 : 0n],
                                }),
                            },
                        ],
                        live.chainId
                    )
                    // The chain is the proof, with or without a receipt.
                    const allowance = await readAllowance(live)
                    if (isDone(allowance)) {
                        store(allowance)
                        return { ok: true }
                    }
                    return fail(receipt ? { kind: 'not-confirmed' } : { kind: 'pending' })
                } catch (err) {
                    const message = (err as Error).message ?? String(err)
                    const lower = message.toLowerCase()
                    const cancelled =
                        (err as Error).name === 'NotAllowedError' ||
                        lower.includes('user rejected') ||
                        lower.includes('cancelled')
                    return fail(cancelled ? { kind: 'user-cancelled' } : { kind: 'unexpected', message })
                } finally {
                    setIsSubmitting(false)
                }
            }

            const promise = run().finally(() => {
                inFlightRef.current = null
            })
            inFlightRef.current = promise
            return promise
        },
        [ensureClientForChain, handleSendUserOpEncoded, queryClient, userId]
    )

    const approve = useCallback(() => setAllowance('approve'), [setAllowance])
    const revoke = useCallback(() => setAllowance('revoke'), [setAllowance])
    /** Re-read the allowance and drop the last error — the way out of `pending`. */
    const recheck = useCallback(async () => {
        setLastError(null)
        await refetch()
    }, [refetch])

    return {
        funding,
        /** `undefined` while the allowance is unknown — never read that as "not approved". */
        isApproved: funding ? isRainFundingApproved(funding.allowance) : undefined,
        isLoading,
        fundingError,
        approve,
        revoke,
        recheck,
        isSubmitting,
        lastError,
    }
}
