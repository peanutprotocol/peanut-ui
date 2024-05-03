'use client'
import { useCallback, useContext, useEffect, useState, useRef } from 'react'
import peanut, { getRandomString, interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'
import { useAccount, useSendTransaction, useSignTypedData, useSwitchChain, useConfig } from 'wagmi'
import { waitForTransactionReceipt } from 'wagmi/actions'

import { useBalance } from '@/hooks/useBalance'
import * as context from '@/context'
import * as consts from '@/constants'
import * as utils from '@/utils'
import * as _utils from './Create.utils'
import { ethers } from 'ethers'

interface IAssertValuesProps {
    tokenValue: string | undefined
}

export const useCreateLink = () => {
    const { setLoadingState } = useContext(context.loadingStateContext)
    const {
        inputDenomination,
        selectedChainID,
        selectedTokenPrice,
        selectedTokenAddress,
        setSelectedTokenPrice,
        setInputDenomination,
    } = useContext(context.tokenSelectorContext)
    const { balances } = useBalance()

    const { chain: currentChain, address } = useAccount()
    const { switchChainAsync } = useSwitchChain()
    const { signTypedDataAsync } = useSignTypedData()
    const { sendTransactionAsync } = useSendTransaction()
    const config = useConfig()

    // step 1
    const assertValues = async ({ tokenValue }: IAssertValuesProps) => {
        // if inputDenomination is USD, the tokenPrice has to be defineds
        if (inputDenomination == 'USD') {
            if (!selectedTokenPrice) {
                try {
                    const _selectedTokenPrice = await utils.fetchTokenPrice(selectedTokenAddress, selectedChainID)
                    setSelectedTokenPrice(_selectedTokenPrice?.price)
                } catch (error) {
                    setInputDenomination('TOKEN')
                    throw new Error(
                        'Something went wrong while fetching the token price. Please change the input denomination and try again'
                    )
                }
            }
        }

        // the selectedChainID and selectedTokenAddress have to be defined
        if (!selectedChainID && !selectedTokenAddress) {
            throw new Error('Please ensure that the correct token and chain are defined')
        }

        // if the userbalances are know, the user must have a balance of the selected token
        if (balances.length > 0) {
            const balance = balances.find(
                (balance) =>
                    utils.compareTokenAddresses(balance.address, selectedTokenAddress) &&
                    balance.chainId === selectedChainID
            )?.amount
            if (!balance || (balance && balance <= Number(tokenValue))) {
                throw new Error('Please ensure that you have sufficient balance of the token you are trying to send')
            }
        }

        // the selected tokenvalue has to be a number higher then .0001
        if (!tokenValue || (tokenValue && Number(tokenValue) <= 0.0001)) {
            throw new Error('The minimum amount to send is 0.0001')
        }
    }
    const generateLinkDetails = ({ tokenValue }: { tokenValue: string | undefined }) => {
        // get tokenDetails (type and decimals)
        const tokenDetails = _utils.getTokenDetails(selectedTokenAddress, selectedChainID, balances)

        // baseUrl
        let baseUrl = ''
        if (typeof window !== 'undefined') {
            baseUrl = `${window.location.origin}/claim`
        }

        // create linkDetails and save to state
        const linkDetails = {
            chainId: selectedChainID,
            tokenAmount: parseFloat(Number(tokenValue).toFixed(6)),
            tokenType: tokenDetails.tokenType,
            tokenAddress: selectedTokenAddress,
            tokenDecimals: tokenDetails.tokenDecimals,
            baseUrl: baseUrl,
            trackId: 'ui',
        }

        return linkDetails
    }
    const generatePassword = async () => {
        //generate password and save to state
        const password = await getRandomString(16)

        return password
    }
    const makeGaslessDepositPayload = useCallback(
        async ({
            _linkDetails,
            _password,
        }: {
            _linkDetails: peanutInterfaces.IPeanutLinkDetails | undefined
            _password: string | undefined
        }) => {
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
        },
        [address, selectedChainID, selectedTokenAddress, balances]
    )
    const prepareDepositTxs = useCallback(
        async ({
            _linkDetails,
            _password,
        }: {
            _linkDetails: peanutInterfaces.IPeanutLinkDetails | undefined
            _password: string | undefined
        }) => {
            if (!_linkDetails || !_password) return

            const prepareTxsResponse = await peanut.prepareTxs({
                address: address ?? '',
                linkDetails: _linkDetails,
                passwords: [_password],
            })

            return prepareTxsResponse
        },
        [address, selectedChainID, selectedTokenAddress, balances]
    )
    const switchNetwork = async (chainId: string) => {
        if (currentChain?.id.toString() !== chainId.toString()) {
            setLoadingState('allow network switch')
            try {
                await switchChainAsync({ chainId: Number(chainId) })
                setLoadingState('switching network')
                await new Promise((resolve) => setTimeout(resolve, 2000))
                setLoadingState('loading')
            } catch (error) {
                setLoadingState('idle')
                console.error('Error switching network:', error)
                // TODO: handle error, either throw or return error
            }
        }
    }
    const estimateGasFee = async (chainId: string) => {
        const feeOptions = await peanut.setFeeOptions({
            chainId: chainId,
        })

        let transactionCostWei = feeOptions.gasLimit.mul(feeOptions.maxFeePerGas || feeOptions.gasPrice)
        let transactionCostEth = ethers.utils.formatEther(transactionCostWei)
        console.log(`Estimated transaction cost: ${transactionCostEth} ETH`)

        console.log(feeOptions)
    }

    // step 2
    const signTypedData = async ({ gaslessMessage }: { gaslessMessage: peanutInterfaces.IPreparedEIP712Message }) => {
        const signature = await signTypedDataAsync({
            domain: {
                ...gaslessMessage.domain,
                chainId: Number(gaslessMessage.domain.chainId), //TODO: non-evm chains wont work
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
    }
    const makeDepositGasless = async ({
        signature,
        payload,
    }: {
        signature: string
        payload: peanutInterfaces.IGaslessDepositPayload
    }) => {
        const response = await peanut.makeDepositGasless({
            payload: payload,
            signature: signature,
            baseUrl: `${consts.next_proxy_url}/deposit-3009`,
            APIKey: 'doesnt-matter',
        }) //TODO: for safe app, check if this tx hash is correct
        return response.txHash
    }
    const sendTransactions = useCallback(
        async ({ preparedDepositTxs }: { preparedDepositTxs: peanutInterfaces.IPrepareDepositTxsResponse }) => {
            if (!preparedDepositTxs) return

            let idx = 0
            const signedTxsResponse: string[] = []
            for (const tx of preparedDepositTxs.unsignedTxs) {
                setLoadingState('sign in wallet')

                // Set fee options using our SDK
                let txOptions
                try {
                    txOptions = await peanut.setFeeOptions({
                        chainId: selectedChainID,
                    })
                } catch (error: any) {
                    console.log('error setting fee options, fallback to default')
                }
                // Send the transaction using wagmi
                let hash = await sendTransactionAsync({
                    to: (tx.to ? tx.to : '') as `0x${string}`,
                    value: tx.value ? BigInt(tx.value.toString()) : undefined,
                    data: tx.data ? (tx.data as `0x${string}`) : undefined,
                    gas: txOptions?.gas ? BigInt(txOptions.gas.toString()) : undefined,
                    gasPrice: txOptions?.gasPrice ? BigInt(txOptions.gasPrice.toString()) : undefined,
                    maxFeePerGas: txOptions?.maxFeePerGas ? BigInt(txOptions?.maxFeePerGas.toString()) : undefined,
                    maxPriorityFeePerGas: txOptions?.maxPriorityFeePerGas
                        ? BigInt(txOptions?.maxPriorityFeePerGas.toString())
                        : undefined,
                    chainId: Number(selectedChainID), //TODO: chainId as number here
                })

                setLoadingState('executing transaction')

                // if (walletType === 'safe') {
                //     const sdk = new SafeAppsSDK({
                //         allowedDomains: [/app.safe.global$/, /.*\.blockscout\.com$/],
                //         debug: true,
                //     })
                //     while (true) {
                //         const queued = await sdk.txs.getBySafeTxHash(hash)

                //         if (
                //             queued.txStatus === TransactionStatus.AWAITING_CONFIRMATIONS ||
                //             queued.txStatus === TransactionStatus.AWAITING_EXECUTION
                //         ) {
                //             console.log('waiting for safe tx')

                //             await new Promise((resolve) => setTimeout(resolve, 1000))
                //         } else if (queued.txHash) {
                //             hash = queued.txHash as `0x${string}`
                //             break
                //         }
                //     }
                // } // TODO: fix this

                // Wait for the transaction to be mined using wagmi/actions
                // Only doing this for the approval transaction (the first tx)
                // Includes retry logic. If the hash isnt available yet, it retries after .5 seconds for 3 times
                if (preparedDepositTxs.unsignedTxs.length === 2 && idx === 0) {
                    for (let attempt = 0; attempt < 3; attempt++) {
                        try {
                            await waitForTransactionReceipt(config, {
                                confirmations: 4,
                                hash: hash,
                                chainId: Number(selectedChainID),
                            })
                            break
                        } catch (error) {
                            if (attempt < 2) {
                                await new Promise((resolve) => setTimeout(resolve, 500))
                            } else {
                                console.error('Failed to wait for transaction receipt after 3 attempts', error)
                            }
                        }
                    }
                }

                signedTxsResponse.push(hash.toString())
                idx++
            }

            return signedTxsResponse[signedTxsResponse.length - 1]
        },
        [selectedChainID, sendTransactionAsync, config]
    )
    const getLinkFromHash = async ({
        hash,
        linkDetails,
        password,
    }: {
        hash: string
        linkDetails: peanutInterfaces.IPeanutLinkDetails
        password: string
    }) => {
        const getLinksFromTxResponse = await peanut.getLinksFromTx({
            linkDetails,
            txHash: hash,
            passwords: [password],
        })

        return getLinksFromTxResponse.links
    }

    return {
        assertValues,
        generateLinkDetails,
        generatePassword,
        makeGaslessDepositPayload,
        signTypedData,
        makeDepositGasless,
        prepareDepositTxs,
        sendTransactions,
        getLinkFromHash,
        switchNetwork,
        estimateGasFee,
    }
}
