'use client'
import { getLinkFromTx, getNextDepositIndex } from '@/app/actions/claimLinks'
import { PEANUT_API_URL, PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN, next_proxy_url } from '@/constants'
import { loadingStateContext, tokenSelectorContext } from '@/context'
import { fetchWithSentry, isNativeCurrency, saveToLocalStorage } from '@/utils'
import peanut, {
    generateKeysFromString,
    getContractAbi,
    getContractAddress,
    getLatestContractVersion,
    getLinkFromParams,
    getRandomString,
    interfaces as peanutInterfaces,
} from '@squirrel-labs/peanut-sdk'
import { useCallback, useContext } from 'react'
import type { Hash } from 'viem'
import { bytesToNumber, encodeFunctionData, parseAbi, parseEther, parseEventLogs, parseUnits, toBytes } from 'viem'
import { useSignTypedData } from 'wagmi'

import { useZeroDev } from '@/hooks/useZeroDev'
import { useWallet } from '@/hooks/wallet/useWallet'
import { captureException } from '@sentry/nextjs'

export const useCreateLink = () => {
    const { setLoadingState } = useContext(loadingStateContext)
    const { selectedChainID } = useContext(tokenSelectorContext)

    const { address } = useWallet()
    const { signTypedDataAsync } = useSignTypedData()
    const { handleSendUserOpEncoded } = useZeroDev()

    const generatePassword = async () => {
        try {
            //generate password and save to state
            const password = await getRandomString(16)

            return password
        } catch (error) {
            console.error('error generating password', error)
            throw new Error('Error generating the password.')
        }
    }
    const makeGaslessDepositPayload = useCallback(
        async ({
            _linkDetails,
            _password,
        }: {
            _linkDetails: peanutInterfaces.IPeanutLinkDetails | undefined
            _password: string | undefined
        }) => {
            try {
                if (!_linkDetails || !_password) return

                const latestContractVersion = peanut.getLatestContractVersion({
                    chainId: selectedChainID,
                    type: 'normal',
                })

                const { payload, message } = await peanut.makeGaslessDepositPayload({
                    linkDetails: _linkDetails,
                    password: _password,
                    address: address ?? '',
                    contractVersion: latestContractVersion,
                })

                return { payload, message }
            } catch (error) {
                throw error
            }
        },
        [address, selectedChainID]
    )
    const prepareDepositTxs = useCallback(
        async ({
            _linkDetails,
            _password,
        }: {
            _linkDetails: peanutInterfaces.IPeanutLinkDetails | undefined
            _password: string | undefined
        }) => {
            try {
                if (!_linkDetails || !_password) return

                const prepareTxsResponse = await peanut.prepareDepositTxs({
                    address: address ?? '',
                    linkDetails: _linkDetails,
                    passwords: [_password],
                })

                return prepareTxsResponse
            } catch (error) {
                throw error
            }
        },
        [address]
    )

    const estimatePoints = async ({
        chainId,
        preparedTx,
        address,
        amountUSD,
        actionType,
    }: {
        chainId: string
        preparedTx: any // This could be detailed further depending on the transaction structure
        address: string
        amountUSD: number
        actionType: 'CREATE' | 'TRANSFER'
    }) => {
        try {
            const response = await fetchWithSentry(`${PEANUT_API_URL}/calculate-pts-for-action`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    actionType: actionType,
                    amountUsd: amountUSD,
                    transaction: preparedTx
                        ? {
                              from: preparedTx.from ? preparedTx.from.toString() : address,
                              to: preparedTx.to ? preparedTx.to.toString() : '',
                              data: preparedTx.data ? preparedTx.data.toString() : '',
                              value: preparedTx.value ? preparedTx.value.toString() : '',
                          }
                        : undefined,
                    chainId: chainId,
                    userAddress: address,
                }),
            })

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }
            const data = await response.json()
            return Math.round(data.points)
        } catch (error) {
            console.error('Failed to estimate points:', error)
            captureException(error)
            return 0 // Returning 0 or another error handling strategy could be implemented here
        }
    }
    const submitClaimLinkInit = async ({
        attachmentOptions,
        password,
        senderAddress,
    }: {
        password: string
        attachmentOptions: {
            message?: string
            attachmentFile?: File
        }
        senderAddress: string
    }) => {
        try {
            const formData = new FormData()
            formData.append('password', password)
            formData.append('attachmentOptions', JSON.stringify(attachmentOptions))
            formData.append('senderAddress', senderAddress)

            if (attachmentOptions.attachmentFile) {
                formData.append('attachment', attachmentOptions.attachmentFile)
            }

            const response = await fetchWithSentry('/api/peanut/submit-claim-link/init', {
                method: 'POST',
                body: formData,
            })

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }
            const data = await response.json()

            return data
        } catch (error) {
            console.error('Failed to publish file (init):', error)
            return ''
        }
    }
    const submitClaimLinkConfirm = async ({
        link,
        password,
        txHash,
        chainId,
        senderAddress,
        amountUsd,
        transaction,
    }: {
        link: string
        password: string
        txHash: string
        chainId: string
        senderAddress: string
        amountUsd: number
        transaction?: peanutInterfaces.IPeanutUnsignedTransaction
    }) => {
        try {
            const { address: pubKey } = generateKeysFromString(password)
            if (!pubKey) {
                throw new Error('Failed to generate pubKey from password')
            }

            const formattedTransaction = transaction
                ? {
                      from: transaction.from?.toString(),
                      to: transaction.to?.toString(),
                      data: transaction.data?.toString(),
                      value: transaction.value?.toString(),
                  }
                : undefined

            const response = await fetchWithSentry('/api/peanut/submit-claim-link/confirm', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    link,
                    password,
                    txHash,
                    chainId,
                    senderAddress,
                    amountUsd,
                    pubKey,
                    signature: '',
                    transaction: formattedTransaction,
                }),
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
            }
        } catch (error) {
            console.error('Failed to publish file (complete):', error)
            throw error
        }
    }

    const prepareDirectSendTx = ({
        recipient,
        tokenValue,
        tokenAddress,
        tokenDecimals,
    }: {
        recipient: string
        tokenValue: string
        tokenAddress: string
        tokenDecimals: number
    }) => {
        let transactionRequest

        if (!isNativeCurrency(tokenAddress)) {
            // ERC20 Token transfer
            const amount = parseUnits(tokenValue, tokenDecimals)
            const data = encodeFunctionData({
                abi: peanut.ERC20_ABI,
                functionName: 'transfer',
                args: [recipient, amount],
            })

            transactionRequest = {
                to: tokenAddress,
                data,
                value: 0n,
            }
        } else {
            // Native token transfer
            tokenValue = Number(tokenValue).toFixed(7)
            const amount = parseEther(tokenValue)
            transactionRequest = {
                to: recipient,
                value: amount,
            }
        }

        return transactionRequest
    }

    // step 2
    const signTypedData = async ({ gaslessMessage }: { gaslessMessage: peanutInterfaces.IPreparedEIP712Message }) => {
        try {
            const signature = await signTypedDataAsync({
                domain: {
                    ...gaslessMessage.domain,
                    chainId: Number(gaslessMessage.domain.chainId), //TODO: (mentioning) non-evm chains wont work
                    verifyingContract: gaslessMessage.domain.verifyingContract as `0x${string}`,
                },
                types: gaslessMessage.types,
                primaryType: gaslessMessage.primaryType,
                message: {
                    ...gaslessMessage.values,
                    value: BigInt(gaslessMessage.values.value),
                    validAfter: BigInt(gaslessMessage.values.validAfter),
                    validBefore: BigInt(gaslessMessage.values.validBefore),
                },
            })
            return signature
        } catch (error) {
            throw error
        }
    }
    const makeDepositGasless = async ({
        signature,
        payload,
    }: {
        signature: string
        payload: peanutInterfaces.IGaslessDepositPayload
    }) => {
        try {
            const response = await peanut.makeDepositGasless({
                payload: payload,
                signature: signature,
                baseUrl: `${next_proxy_url}/deposit-3009`,
                APIKey: 'doesnt-matter',
            })
            return response.txHash
        } catch (error) {
            throw error
        }
    }

    const getLinkFromHash = async ({
        hash,
        linkDetails,
        password,
        walletType,
    }: {
        hash: string
        linkDetails: peanutInterfaces.IPeanutLinkDetails
        password: string
        walletType: 'blockscout' | undefined
    }) => {
        try {
            let link = await getLinkFromTx({ linkDetails, txHash: hash, password })

            if (walletType === 'blockscout') {
                const _link = link
                const urlObj = new URL(_link)
                urlObj.searchParams.append('path', 'claim')
                const newUrl = urlObj.toString()
                link = newUrl
            }
            return link
        } catch (error) {
            throw error
        }
    }

    const createLink = useCallback(
        async (amount: bigint) => {
            setLoadingState('Generating details')
            const password = await generatePassword()
            const generatedKeys = generateKeysFromString(password)
            saveToLocalStorage(`sendLink::password::${generatedKeys.address}`, password)

            const chainId = PEANUT_WALLET_CHAIN.id.toString()
            const contractVersion = getLatestContractVersion({
                chainId,
                type: 'normal',
            })
            const tokenAddress = PEANUT_WALLET_TOKEN as Hash
          const contractAbi = peanut.getContractAbi(contractVersion)
          const contractAddress: Hash = peanut.getContractAddress(PEANUT_WALLET_CHAIN.id.toString(), contractVersion) as Hash
            // Get the next deposit index to store in case of failure
            const nextIndex = await getNextDepositIndex(contractVersion)

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
            const { receipt } = await handleSendUserOpEncoded(
                [
                    { to: tokenAddress, value: 0n, data: approveData },
                    { to: contractAddress, value: 0n, data: makeDepositData },
                ],
                chainId
            )
            let depositIdx: number
            let txHash: Hash | undefined = undefined
            if (receipt !== null) {
                const depositEvent = parseEventLogs({
                    abi: contractAbi,
                    eventName: 'DepositEvent',
                    logs: receipt.logs,
                })[0]
                depositIdx = bytesToNumber(toBytes(depositEvent.topics[1]!))
                txHash = depositEvent.transactionHash
            } else {
                depositIdx = nextIndex
            }

            const link = getLinkFromParams(
                chainId,
                contractVersion,
                depositIdx,
                password,
                `${process.env.NEXT_PUBLIC_BASE_URL!}/claim`,
                undefined
            )
            return {
                link,
                pubKey: generatedKeys.address,
                chainId,
                contractVersion,
                depositIdx,
                txHash,
                amount,
                tokenAddress,
            }
        },
        [handleSendUserOpEncoded]
    )

    return {
        generatePassword,
        makeGaslessDepositPayload,
        signTypedData,
        makeDepositGasless,
        prepareDepositTxs,
        getLinkFromHash,
        estimatePoints,
        submitClaimLinkInit,
        submitClaimLinkConfirm,
        prepareDirectSendTx,
        createLink,
    }
}
