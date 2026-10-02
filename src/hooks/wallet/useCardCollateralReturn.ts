'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { isAddressEqual } from 'viem'
import { useAuth } from '@/context/authContext'
import { useKernelClient } from '@/context/kernelClient.context'
import { PEANUT_WALLET_CHAIN } from '@/constants/zerodev.consts'
import { useZeroDev } from '@/hooks/useZeroDev'
import { RAIN_CARD_OVERVIEW_QUERY_KEY } from '@/hooks/useRainCardOverview'
import { rainApi } from '@/services/rain'
import { beginKernelSigning } from '@/utils/kernelSigningGuard'
import { signRainWithdrawAdmin } from '@/utils/rainWithdraw.utils'
import { rescueUserOpReceipt, type UserOpReceiptWaiter } from '@/utils/userop-rescue.utils'
import {
    CollateralReturnError,
    collateralReturnOwner,
    pendingCollateralReturns,
    returnCardCollateral,
    type CollateralReturnOutcome,
} from './cardCollateralReturn'
import { runCollateralSpendPreflight } from './spendPreflight'

/**
 * Moves the provider-withdrawable card balance back to the user's own wallet
 * (see `cardCollateralReturn.ts`). Shared by managed funding setup and the card
 * screen. Never locks or cancels the card and never grants a permission.
 *
 * While a return runs it holds the kernel signing guard, so a permission
 * migration cannot start under it. Opens no dialog of its own: callers show
 * progress and errors in their own surface.
 */
export const useCardCollateralReturn = () => {
    const queryClient = useQueryClient()
    const { user } = useAuth()
    const userId = user?.user?.userId
    const { getClientForChain, ensureClientForChain, rebuildClientForChain } = useKernelClient()
    const { handleSendUserOpEncoded, address: connectedAddress } = useZeroDev()
    const [isReturning, setIsReturning] = useState(false)
    const [lastError, setLastError] = useState<CollateralReturnError | null>(null)
    // Latest identity, read after every await: a switch sends nothing further.
    const identityRef = useRef({ userId, connectedAddress })
    identityRef.current = { userId, connectedAddress }

    // Another account's error is not this one's.
    useEffect(() => {
        setLastError(null)
    }, [userId, connectedAddress])

    const returnCollateral = useCallback(
        async (opts: { onStart?: () => void } = {}): Promise<CollateralReturnOutcome> => {
            const startedFor = identityRef.current
            const isChanged = () =>
                identityRef.current.userId !== startedFor.userId ||
                identityRef.current.connectedAddress !== startedFor.connectedAddress
            const chainIdStr = PEANUT_WALLET_CHAIN.id.toString()

            let release: () => void
            try {
                release = beginKernelSigning()
            } catch (e) {
                throw new CollateralReturnError('busy', undefined, { cause: e })
            }
            setIsReturning(true)
            setLastError(null)
            try {
                let client = await ensureClientForChain(chainIdStr)
                const wallet = client.account?.address
                if (!startedFor.userId || !wallet) throw new CollateralReturnError('failed')
                if (isChanged()) throw new CollateralReturnError('account-changed')
                const owner = collateralReturnOwner(startedFor.userId, wallet)

                const outcome = await pendingCollateralReturns.runExclusive(owner, () =>
                    returnCardCollateral({
                        owner,
                        wallet,
                        chainId: PEANUT_WALLET_CHAIN.id,
                        pending: pendingCollateralReturns,
                        readOverview: async () => {
                            const fresh = await rainApi.getOverview()
                            if (!isChanged()) {
                                queryClient.setQueryData([RAIN_CARD_OVERVIEW_QUERY_KEY, startedFor.userId], fresh)
                            }
                            return fresh
                        },
                        prepare: (input) => rainApi.prepareWithdrawal(input, { suppressCooldownEvent: true }),
                        submit: (input) => rainApi.submitWithdrawal(input, { suppressStaleApprovalEvent: true }),
                        stamp: (input) => rainApi.stampWithdrawal(input, { throwOnError: true }),
                        readStatus: (preparationId) => rainApi.getWithdrawalStatus(preparationId),
                        cancelPreparation: (preparationId) => void rainApi.cancelPreparation(preparationId),
                        cancelVerified: (preparationId) =>
                            rainApi.cancelPreparation(preparationId, { throwOnError: true }),
                        // An unmigrated (pre-2025-09-18) wallet must migrate its root
                        // validator before a root UserOp can verify the admin signature.
                        // That may rebuild the client: sign with the current one.
                        readyRootPath: async (overview) => {
                            client = await runCollateralSpendPreflight({
                                strategy: 'mixed',
                                kind: 'INTERNAL_TRANSFER',
                                kernelClient: client,
                                overview,
                                requireOverview: true,
                                sendNoopUserOp: (call) =>
                                    handleSendUserOpEncoded([call], chainIdStr, { returnRevertedReceipt: true }),
                                rebuildClient: () => rebuildClientForChain(chainIdStr),
                                migrationTrigger: 'collateral-return',
                            })
                            const current = client.account?.address
                            if (isChanged() || !current || !isAddressEqual(current, wallet)) {
                                throw new CollateralReturnError('account-changed')
                            }
                        },
                        signAdmin: (prep) => signRainWithdrawAdmin(client.account!, prep, PEANUT_WALLET_CHAIN.id),
                        sendRootUserOp: (calls, onBroadcastAttempt) =>
                            handleSendUserOpEncoded(calls, chainIdStr, { onBroadcastAttempt }),
                        findUserOpReceipt: (userOpHash) =>
                            rescueUserOpReceipt(
                                getClientForChain(chainIdStr) as unknown as UserOpReceiptWaiter,
                                userOpHash,
                                null,
                                'collateral-return'
                            ),
                        isChanged,
                        onStart: opts.onStart,
                    })
                )
                if (outcome.kind === 'returned') {
                    await Promise.all([
                        queryClient.invalidateQueries({ queryKey: [RAIN_CARD_OVERVIEW_QUERY_KEY] }),
                        queryClient.invalidateQueries({ queryKey: ['balance'] }),
                    ])
                }
                return outcome
            } catch (e) {
                const error =
                    e instanceof CollateralReturnError
                        ? e
                        : new CollateralReturnError('failed', undefined, { cause: e })
                if (!isChanged()) setLastError(error)
                throw error
            } finally {
                release()
                setIsReturning(false)
            }
        },
        [queryClient, getClientForChain, ensureClientForChain, rebuildClientForChain, handleSendUserOpEncoded]
    )

    return { returnCollateral, isReturning, lastError }
}
