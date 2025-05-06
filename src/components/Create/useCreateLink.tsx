'use client'
import { getLinkFromTx } from '@/app/actions/claimLinks'
import { getFeeOptions, type ChainId, type FeeOptions } from '@/app/actions/clients'
import { fetchTokenPrice } from '@/app/actions/tokens'
import { PEANUT_API_URL, PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN, next_proxy_url } from '@/constants'
import { loadingStateContext, tokenSelectorContext } from '@/context'
import { fetchWithSentry, isNativeCurrency, jsonParse, saveToLocalStorage } from '@/utils'
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
import type { Hash, Hex } from 'viem'
import {
    bytesToNumber,
    encodeFunctionData,
    formatEther,
    parseAbi,
    parseEther,
    parseEventLogs,
    parseUnits,
    toBytes,
} from 'viem'
import { useAccount, useSignTypedData } from 'wagmi'

import { useZeroDev } from '@/hooks/useZeroDev'
import { useWallet } from '@/hooks/wallet/useWallet'
import { NATIVE_TOKEN_ADDRESS } from '@/utils/token.utils'
import { captureException } from '@sentry/nextjs'

export const useCreateLink = () => {
    const { setLoadingState } = useContext(loadingStateContext)
    const { selectedChainID } = useContext(tokenSelectorContext)

    const { address } = useWallet()
    const { connector } = useAccount()
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
    const isSafeConnector = (connector?: { name?: string }): boolean => {
        const name = connector?.name
        if (!name) return false
        return name.toLowerCase().includes('safe')
    }
    const estimateGasFee = useCallback(
        async ({ from, chainId, preparedTx }: { from: Hex; chainId: string; preparedTx: any }) => {
            // Return early with default values for Safe connector
            // requirement for internut (injects AA with zero gas fees)
            if (isSafeConnector({ name: connector?.name })) {
                return {
                    feeOptions: {
                        gasLimit: BigInt(0),
                        maxFeePerGas: BigInt(0),
                        gasPrice: BigInt(0),
                    },
                    transactionCostUSD: 0,
                }
            }
            const feeOptions = jsonParse<FeeOptions>(
                await getFeeOptions(Number(chainId) as ChainId, {
                    ...preparedTx,
                    value: preparedTx.value?.toString() ?? '0',
                    account: from,
                })
            )
            let transactionCostWei = feeOptions.gas * feeOptions.maxFeePerGas
            let transactionCostNative = formatEther(transactionCostWei)
            const nativeTokenPrice = await fetchTokenPrice(NATIVE_TOKEN_ADDRESS, chainId)
            if (!nativeTokenPrice || typeof nativeTokenPrice.price !== 'number' || isNaN(nativeTokenPrice.price)) {
                throw new Error('Failed to fetch token price')
            }
            const transactionCostUSD = Number(transactionCostNative) * nativeTokenPrice.price

            return {
                feeOptions,
                transactionCostUSD,
            }
        },
        []
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
    const submitDirectTransfer = async ({
        txHash,
        chainId,
        senderAddress,
        amountUsd,
        transaction,
    }: {
        txHash: string
        chainId: string
        senderAddress: string
        amountUsd: number
        transaction?: peanutInterfaces.IPeanutUnsignedTransaction
    }) => {
        try {
            const response = await fetchWithSentry('/api/peanut/submit-direct-transfer', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    txHash,
                    chainId,
                    senderAddress: senderAddress,
                    amountUsd,
                    transaction: {
                        ...transaction,
                        value:
                            transaction?.value && transaction.value !== BigInt(0)
                                ? transaction.value.toString()
                                : undefined,
                    },
                }),
            })

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }
        } catch (error) {
            console.error('Failed to publish file (complete):', error)
            return ''
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
            const contractAbi = getContractAbi(contractVersion)
            const contractAddress: Hash = getContractAddress(chainId, contractVersion) as Hash
            const tokenAddress = PEANUT_WALLET_TOKEN as Hash

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
            const receipt = await handleSendUserOpEncoded(
                [
                    { to: tokenAddress, value: 0n, data: approveData },
                    { to: contractAddress, value: 0n, data: makeDepositData },
                ],
                chainId
            )
            const depositEvent = parseEventLogs({
                abi: contractAbi,
                eventName: 'DepositEvent',
                logs: receipt.logs,
            })[0]
            const depositIdx = bytesToNumber(toBytes(depositEvent.topics[1]!))

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
                txHash: receipt.transactionHash,
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
        estimateGasFee,
        estimatePoints,
        submitClaimLinkInit,
        submitClaimLinkConfirm,
        prepareDirectSendTx,
        submitDirectTransfer,
        createLink,
    }
}
