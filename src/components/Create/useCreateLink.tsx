'use client'
import { BASE_URL } from '@/constants/general.consts'
import { loadingStateContext } from '@/context/loadingStates.context'
import { saveToLocalStorage } from '@/utils/general.utils'
import { generateKeysFromString, getLinkFromParams } from '@/utils/peanut-link.utils'
import {
    getContractAddress,
    getLatestContractVersion,
    getRandomString,
    peanutVaultAbi,
} from '@/utils/peanut-claim.utils'
import { useCallback, useContext } from 'react'
import type { Address } from 'viem'
import { encodeFunctionData, parseAbi } from 'viem'

import { useKernelClient } from '@/context/kernelClient.context'
import { useZeroDev } from '@/hooks/useZeroDev'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN } from '@/constants/zerodev.consts'
import { useWallet } from '@/hooks/wallet/useWallet'
import { sendLinksApi } from '@/services/sendLinks'
import { captureNetworkTriagedFailure } from '@/utils/network-triage'
import { criticalFlowTags } from '@/utils/sentry-critical-flow'
import { resolveLinkDeposit } from '@/utils/send-link-deposit.utils'
import { withCeremonyFlow } from '@/utils/webauthn-ceremony-telemetry'

/** What the sender attaches to a link. */
interface SendLinkDetails {
    message?: string
    attachment?: File
}

export const useCreateLink = () => {
    const { setLoadingState } = useContext(loadingStateContext)
    const { sendTransactions } = useWallet()
    // The kernel account: the vault records it as the deposit's sender.
    const sender = useZeroDev().address as Address | undefined
    const { getClientForChain } = useKernelClient()

    const generatePassword = async () => {
        try {
            const password = await getRandomString(16)
            return password
        } catch (error) {
            console.error('error generating password', error)
            throw new Error('Error generating the password.')
        }
    }

    /**
     * Funds a link in the vault and records it with the backend before it
     * returns (TASK-24270). The success screen used to show first, so a failed
     * record went unseen. The loading state stays busy the whole time, which
     * is what keeps the view's balance gate and its button quiet.
     */
    const createLink = useCallback(
        async (amount: bigint, { message, attachment }: SendLinkDetails = {}) => {
            let strategy: string | undefined
            const funded = await withCeremonyFlow(
                'link_create',
                async () => {
                    // Checked before any signing: the deposit is matched to its sender.
                    if (!sender) throw new Error('Wallet is not ready')
                    setLoadingState('Generating details')
                    const password = await generatePassword()
                    const { address: pubKey } = generateKeysFromString(password)
                    saveToLocalStorage(`sendLink::password::${pubKey}`, password)

                    const chainId = PEANUT_WALLET_CHAIN.id.toString()
                    const contractVersion = getLatestContractVersion({ chainId, type: 'normal' })
                    const tokenAddress = PEANUT_WALLET_TOKEN as Address
                    const vault = getContractAddress(chainId, contractVersion)

                    const approveData = encodeFunctionData({
                        abi: parseAbi(['function approve(address _spender, uint256 _amount) external returns (bool)']),
                        functionName: 'approve',
                        args: [vault, amount],
                    })
                    const makeDepositData = encodeFunctionData({
                        abi: peanutVaultAbi,
                        functionName: 'makeDeposit',
                        args: [tokenAddress, 1, amount, 0n, pubKey],
                    })
                    // Route through sendTransactions with `requiredUsdcAmount` so a Rain
                    // collateral withdraw is prepended to the UserOp when the smart
                    // account is short. Covers the mixed (smart + collateral) case.
                    const { receipt, userOpHash, intentId } = await sendTransactions(
                        [
                            { to: tokenAddress, value: 0n, data: approveData },
                            { to: vault, value: 0n, data: makeDepositData },
                        ],
                        {
                            chainId,
                            requiredUsdcAmount: amount,
                            kind: 'LINK_CREATE',
                            // as soon as routing decides, not when it succeeds — a
                            // cancelled flow still has to be readable by strategy
                            onStrategyDecided: (decided) => {
                                strategy = decided
                            },
                        }
                    )
                    // The send is over but a timed-out receipt means one more
                    // wait: keep the screen busy so the link cannot be created twice.
                    setLoadingState('Executing transaction')
                    const { depositIdx, txHash } = await resolveLinkDeposit({
                        receipt,
                        userOpHash,
                        // The bundler finds any op by hash, the session-key one included.
                        receiptWaiter: () => getClientForChain(chainId),
                        vault,
                        sender,
                        pubKey,
                    })

                    return {
                        link: getLinkFromParams(chainId, contractVersion, depositIdx, password, `${BASE_URL}/claim`),
                        pubKey,
                        chainId,
                        contractVersion,
                        depositIdx,
                        txHash,
                        tokenAddress,
                        // Present only for collateral-funded ("mixed") links — the Rain
                        // prepare intent id, threaded to /send-links so the backend
                        // adopts it instead of minting a duplicate SEND_LINK.
                        preparationId: intentId,
                    }
                },
                () => ({ strategy })
            )

            setLoadingState('Creating link')
            const { link, ...deposit } = funded
            try {
                await sendLinksApi.persist({
                    ...deposit,
                    amount,
                    reference: message,
                    attachment,
                    filename: attachment?.name,
                    mimetype: attachment?.type,
                })
            } catch (error) {
                // The money is in the vault and the link still claims: the API
                // rebuilds a missing row from chain when the link is opened.
                // Hiding the link would hide the only claim URL, so show it and
                // report: the sender's history misses it until support restores it.
                console.error(error)
                void captureNetworkTriagedFailure(error, {
                    tags: { ...criticalFlowTags('send-link'), send_link_step: 'persist' },
                    // Everything support needs to restore the row, preparationId
                    // included: without it a mixed link's Rain intent is not adopted.
                    extra: deposit,
                })
            }
            return { link, chainId: funded.chainId, tokenAddress: funded.tokenAddress }
        },
        [getClientForChain, sendTransactions, sender, setLoadingState]
    )

    return {
        createLink,
    }
}
