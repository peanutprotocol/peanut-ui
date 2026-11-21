'use client'
import { PUBLIC_CLIENTS_BY_CHAIN } from '@/app/actions/clients'
import { BASE_URL } from '@/constants/general.consts'
import { loadingStateContext } from '@/context/loadingStates.context'
import { useAuth } from '@/context/authContext'
import { keepSendLinkPassword, readSendLinkPassword } from '@/utils/send-link-password'
import { generateKeysFromString, getLinkFromParams } from '@/utils/peanut-link.utils'
import {
    getContractAbi,
    getContractAddress,
    getLatestContractVersion,
    getRandomString,
} from '@/utils/peanut-claim.utils'
import { useCallback, useContext } from 'react'
import type { Hash, Address, TransactionReceipt } from 'viem'
import { encodeFunctionData, isAddressEqual, parseAbi, parseEventLogs } from 'viem'

import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN } from '@/constants/zerodev.consts'
import { useWallet } from '@/hooks/wallet/useWallet'
import { markSpendMayHaveBroadcast, type SpendBroadcast } from '@/hooks/wallet/spendBroadcast'
import { withCeremonyFlow } from '@/utils/webauthn-ceremony-telemetry'

const chainId = PEANUT_WALLET_CHAIN.id.toString()
const tokenAddress = PEANUT_WALLET_TOKEN as Hash

export interface CreatedSendLink {
    link: string
    pubKey: string
    chainId: string
    contractVersion: string
    depositIdx: number
    txHash: Hash
    amount: bigint
    tokenAddress: Hash
    /** Present only for collateral-funded ("mixed") links — the Rain prepare intent id. */
    preparationId?: string
}

/**
 * The link a deposit made, read from its receipt. The receipt is the only
 * source of the deposit index: another link can take the next index between a
 * read and this deposit. A bundle can carry other senders' deposits, so only
 * this wallet's deposit on the vault counts.
 */
function sendLinkFromReceipt(
    receipt: TransactionReceipt,
    { password, sender }: { password: string; sender: Address }
): Omit<CreatedSendLink, 'preparationId'> {
    const contractVersion = getLatestContractVersion({ chainId, type: 'normal' })
    const contractAddress = getContractAddress(chainId, contractVersion) as Address
    const deposit = parseEventLogs({
        abi: getContractAbi(contractVersion),
        eventName: 'DepositEvent',
        logs: receipt.logs,
    })
        .map(
            (log) =>
                log as unknown as {
                    address: Address
                    args: { _index: bigint; _amount: bigint; _senderAddress: Address }
                }
        )
        .find((log) => isAddressEqual(log.address, contractAddress) && isAddressEqual(log.args._senderAddress, sender))
    if (!deposit) throw new Error('The send link deposit is not in its receipt')
    const depositIdx = Number(deposit.args._index)
    return {
        link: getLinkFromParams(chainId, contractVersion, depositIdx, password, `${BASE_URL}/claim`, undefined),
        pubKey: generateKeysFromString(password).address,
        chainId,
        contractVersion,
        depositIdx,
        txHash: receipt.transactionHash,
        amount: deposit.args._amount,
        tokenAddress,
    }
}

/**
 * The link of a deposit the recovery found on chain, after its answer was
 * lost. The password was kept before signing, under the link's key.
 */
export async function sendLinkFromFoundDeposit({
    userId,
    pubKey,
    txHash,
    sender,
}: {
    userId: string | undefined
    pubKey: string
    txHash: Hash
    sender: Address
}): Promise<CreatedSendLink> {
    const password = readSendLinkPassword(userId, pubKey)
    if (!password) throw new Error('The send link password is not on this device')
    const receipt = await PUBLIC_CLIENTS_BY_CHAIN[PEANUT_WALLET_CHAIN.id].client.getTransactionReceipt({ hash: txHash })
    return sendLinkFromReceipt(receipt, { password, sender })
}

export const useCreateLink = () => {
    const { setLoadingState } = useContext(loadingStateContext)
    const { user } = useAuth()
    const userId = user?.user?.userId
    const { address, sendTransactions } = useWallet()

    const generatePassword = async () => {
        try {
            const password = await getRandomString(16)
            return password
        } catch (error) {
            console.error('error generating password', error)
            throw new Error('Error generating the password.')
        }
    }

    // @dev TODO: Fix edge case - balance validation should also check loadingState.isLoading
    // Current: NOT tracked by usePendingTransactions + validation doesn't check isLoading
    // Edge case: If user rapidly creates links, insufficient balance error could briefly show
    // Fix: Add isLoading check to Initial.link.send.view.tsx useEffect (line 98)
    // Better: Wrap in useMutation with mutationKey: [BALANCE_DECREASE, SEND_LINK]
    // Priority: Low (rare edge case in less common flow)
    /**
     * `onBegin` gets the link's key before anything is signed, and `onBroadcast`
     * each send before it leaves this device: the caller's pending marker
     * (usePendingChargeSend), so a lost answer is read back, never deposited again.
     */
    const createLink = useCallback(
        async (
            amount: bigint,
            {
                onBegin,
                onBroadcast,
            }: { onBegin: (pubKey: string) => void; onBroadcast: (broadcast: SpendBroadcast) => void }
        ): Promise<CreatedSendLink> => {
            let strategy: string | undefined
            return withCeremonyFlow(
                'link_create',
                async () => {
                    if (!userId || !address) throw new Error('Log in to create a link.')
                    setLoadingState('Generating details')
                    const password = await generatePassword()
                    const generatedKeys = generateKeysFromString(password)
                    keepSendLinkPassword(userId, generatedKeys.address, password)

                    const contractVersion = getLatestContractVersion({ chainId, type: 'normal' })
                    const contractAbi = getContractAbi(contractVersion)
                    const contractAddress = getContractAddress(chainId, contractVersion) as Address

                    const approveData = encodeFunctionData({
                        abi: parseAbi(['function approve(address _spender, uint256 _amount) external returns (bool)']),
                        functionName: 'approve',
                        args: [contractAddress, amount],
                    })
                    const makeDepositData = encodeFunctionData({
                        abi: contractAbi,
                        functionName: 'makeDeposit',
                        args: [tokenAddress, 1, amount, 0, generatedKeys.address as Hash],
                    })
                    onBegin(generatedKeys.address)
                    // Route through sendTransactions with `requiredUsdcAmount` so a Rain
                    // collateral withdraw is prepended to the UserOp when the smart
                    // account is short. Covers the mixed (smart + collateral) case.
                    const { receipt, intentId } = await sendTransactions(
                        [
                            { to: tokenAddress, value: 0n, data: approveData },
                            { to: contractAddress, value: 0n, data: makeDepositData },
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
                            onBroadcast,
                        }
                    )
                    // The deposit left this device but its receipt did not come
                    // back: the recovery reads it from the chain.
                    if (receipt === null) throw markSpendMayHaveBroadcast(new Error('The deposit has no receipt yet'))
                    try {
                        return {
                            ...sendLinkFromReceipt(receipt, { password, sender: address as Address }),
                            // threaded to /send-links so the backend adopts it instead of
                            // minting a duplicate SEND_LINK
                            preparationId: intentId,
                        }
                    } catch (error) {
                        // the deposit landed: never offer it again
                        throw markSpendMayHaveBroadcast(error)
                    }
                },
                () => ({ strategy })
            )
        },
        [sendTransactions, setLoadingState, userId, address]
    )

    return {
        createLink,
    }
}
