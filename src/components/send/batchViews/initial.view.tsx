'use client'

import { useEffect, useState, useCallback, useMemo, Fragment } from 'react'
import { useWeb3Modal } from '@web3modal/wagmi/react'
import { useAtom } from 'jotai'
import { useAccount, useSendTransaction, useSwitchChain, useSignTypedData, useConfig } from 'wagmi'
import { waitForTransactionReceipt } from 'wagmi/actions'
import peanut, { getTokenBalance, makeDepositGasless, setFeeOptions } from '@squirrel-labs/peanut-sdk'

import { useForm } from 'react-hook-form'
import { Dialog, Transition } from '@headlessui/react'
import { Switch } from '@headlessui/react'
import SafeAppsSDK, { TransactionStatus } from '@safe-global/safe-apps-sdk'

import * as store from '@/store'
import * as consts from '@/consts'
import * as _consts from '../send.consts'
import * as utils from '@/utils'
import * as _utils from '../send.utils'
import * as hooks from '@/hooks'
import * as global_components from '@/components/global'

import switch_svg from '@/assets/icons/switch.svg'

export function batchInitialView({ onNextScreen, setClaimLink, setTxHash, setChainId }: _consts.ISendScreenProps) {
    //hooks
    const { open } = useWeb3Modal()
    const { isConnected, address, chain: currentChain } = useAccount()
    const { switchChainAsync } = useSwitchChain()
    const { sendTransactionAsync } = useSendTransaction()
    const { signTypedDataAsync } = useSignTypedData()
    const config = useConfig()
    const sdk = new SafeAppsSDK()

    const [filteredTokenList, setFilteredTokenList] = useState<_consts.ITokenListItem[] | undefined>(undefined)
    const [formHasBeenTouched, setFormHasBeenTouched] = useState(false)
    const [isTokenSelectorOpen, setIsTokenSelectorOpen] = useState(false)
    const [enableConfirmation, setEnableConfirmation] = useState(false)
    const [textFontSize, setTextFontSize] = useState('text-6xl')
    const [loadingStates, setLoadingStates] = useState<consts.LoadingStates>('idle')
    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })
    const [tokenPrice, setTokenPrice] = useState<number | undefined>(undefined)
    const [inputDenomination, setInputDenomination] = useState<'TOKEN' | 'USD'>('USD')
    const [unfoldChains, setUnfoldChains] = useState(false)
    const [advancedDropdownOpen] = useState(false)
    const [showGaslessAvailable, setShowGaslessAvailable] = useState(false)
    const [createGasless] = useState(true)
    const verbose = true
    const [walletType, setWalletType] = useState<'blockscout' | 'safe' | undefined>(undefined)

    const [tokenBalance, setTokenBalance] = useState<number | undefined>(undefined)

    //global states
    const [userBalances] = useAtom(store.userBalancesAtom)
    const [chainDetails] = useAtom(store.defaultChainDetailsAtom)
    const [supportedWalletconnectChains] = useAtom(store.supportedWalletconnectChainsAtom)
    const [supportedMobulaChains] = useAtom(store.supportedMobulaChainsAtom)
    const [tokenDetails] = useAtom(store.defaultTokenDetailsAtom)
    hooks.useConfirmRefresh(enableConfirmation)

    //form and modalform states
    const sendForm = useForm<_consts.ISendFormData>({
        mode: 'onChange',
        defaultValues: {
            chainId: '10',
            amount: null,
            token: 'ETH',
            bulkAmount: 0,
        },
    })
    const formwatch = sendForm.watch()

    //memo
    const isLoading = useMemo(() => loadingStates !== 'idle', [loadingStates])
    const chainsToShow = useMemo(() => {
        if (isConnected && userBalances.length > 0) {
            const filteredChains = chainDetails
                .filter(
                    (chain) =>
                        chain.chainId === userBalances.find((balance) => balance.chainId === chain.chainId)?.chainId
                )
                .concat(
                    chainDetails.filter(
                        (item1) => !supportedWalletconnectChains.some((item2) => item2.chainId === item1.chainId)
                    )
                )

            return filteredChains
        } else {
            return chainDetails
        }
    }, [isConnected, chainDetails, userBalances, supportedWalletconnectChains])

    const tokenList = useMemo(() => {
        if (isConnected) {
            setFilteredTokenList(undefined)
            if (userBalances.some((balance) => balance.chainId == formwatch.chainId)) {
                const list = userBalances
                    .filter((balance) => balance.chainId == formwatch.chainId)
                    .map((balance) => {
                        return {
                            symbol: balance.symbol,
                            chainId: balance.chainId,
                            amount: balance.amount,
                            address: balance.address,
                            decimals: balance.decimals,
                            logo: balance.logoURI,
                            name: balance.name,
                        }
                    })
                list.push({
                    symbol: 'PNT',
                    chainId: '137',
                    amount: 1,
                    address: '0x9Ae69fDfF2FA97e34B680752D8E70dfD529Ea6ca',
                    decimals: 10,
                    logo: 'https://polygonscan.com/token/images/pintatoken_32.png',
                    name: 'PINTA',
                })
                return list
            } else {
                return (
                    tokenDetails
                        .find((tokendetail) => tokendetail.chainId == formwatch.chainId.toString())
                        ?.tokens.map((token) => {
                            return {
                                symbol: token.symbol,
                                chainId: formwatch.chainId,
                                amount: 0,
                                address: token.address,
                                decimals: token.decimals,
                                logo: token.logoURI,
                                name: token.name,
                            }
                        }) ?? []
                )
            }
        } else {
            return (
                tokenDetails
                    .find((tokendetail) => tokendetail.chainId == formwatch.chainId.toString())
                    ?.tokens.map((token) => {
                        return {
                            symbol: token.symbol,
                            chainId: formwatch.chainId,
                            amount: 0,
                            address: token.address,
                            decimals: token.decimals,
                            logo: token.logoURI,
                            name: token.name,
                        }
                    }) ?? []
            )
        }
    }, [isConnected, userBalances, tokenDetails, formwatch.chainId, chainDetails])

    useEffect(() => {
        ;(async () => {
            try {
                const envInfo = await sdk.safe.getEnvironmentInfo()
                if (envInfo.origin.includes('app.safe.global')) {
                    // If its a safe wallet, we need a sep tx hash handler
                    setWalletType('safe')
                } else if (envInfo.origin.includes('blockscout.com')) {
                    // If its a blockscout, we do not need a sep tx hash handler but should only display the funds on the connected chain
                    setWalletType('blockscout')
                } else {
                    setWalletType(undefined)
                }
            } catch (error) {
                console.log('Failed to get wallet info:', error)
                setWalletType(undefined)
            }
        })()
    }, [address])

    const checkForm = (sendFormData: _consts.ISendFormData) => {
        //check that the token and chainid are defined
        if (sendFormData.chainId == null || sendFormData.token == '') {
            setErrorState({
                showError: true,
                errorMessage: 'Please select a chain and token',
            })
            return { success: 'false' }
        }

        //check if the amount is less than or equal to zero
        if (!sendFormData.amount || (sendFormData.amount && Number(sendFormData.amount) <= 0)) {
            setErrorState({
                showError: true,
                errorMessage: 'Please put an amount that is greater than zero',
            })
            return { success: 'false' }
        }

        //check if the amount is smaller than 0.00001
        if (Number(sendFormData.amount) < 0.00001) {
            setErrorState({
                showError: true,
                errorMessage: 'The amount is too small',
            })
            return { success: 'false' }
        }

        //check if the bulkAmount is less than or equal to zero when bulk is selected
        if (Number(sendFormData.bulkAmount) <= 0) {
            setErrorState({
                showError: true,
                errorMessage: 'Please input the amount of links you want to create',
            })
            return { success: 'false' }
        }

        //check if the bulkAmount is greater than or equal to 2
        if (Number(sendFormData.bulkAmount) >= 250) {
            setErrorState({
                showError: true,
                errorMessage: 'Please input a number less than 250',
            })
            return { success: 'false' }
        }

        //check if the bulkAmount is greater than or equal to 2
        if (Number(sendFormData.bulkAmount) < 2) {
            setErrorState({
                showError: true,
                errorMessage: 'Please input a number greater than 1',
            })
            return { success: 'false' }
        }

        return { success: 'true' }
    }

    const calculateTokenAmount = async (
        sendFormData: _consts.ISendFormData
    ): Promise<{ tokenAmount: number; status: string }> => {
        if (inputDenomination == 'USD') {
            var price: number | undefined = undefined
            try {
                const fetchPriceResponse = await utils.fetchTokenPrice(
                    tokenList.find((token) => token.symbol == sendFormData.token)?.address ?? '',
                    sendFormData.chainId
                )
                price = fetchPriceResponse?.price
            } catch (error) {
                console.error(error)
                setErrorState({
                    showError: true,
                    errorMessage:
                        'Something went wrong while fetching the token price, please change input denomination',
                })
                return { tokenAmount: 0, status: 'ERROR' }
            }

            if (price) {
                if (advancedDropdownOpen) {
                    return {
                        tokenAmount: (Number(sendFormData.amount) * (sendFormData.bulkAmount ?? 0)) / price,
                        status: 'SUCCESS',
                    }
                } else {
                    return { tokenAmount: Number(sendFormData.amount) / price, status: 'SUCCESS' }
                }
            } else {
                return { tokenAmount: 0, status: 'ERROR' }
            }
        } else {
            return { tokenAmount: Number(sendFormData.amount) ?? 0, status: 'SUCCESS' }
        }
    }

    const checkNetwork = async (chainId: string) => {
        //check if the user is on the correct chain
        if (currentChain?.id.toString() !== chainId.toString()) {
            setLoadingStates('allow network switch')

            try {
                await switchChainAsync({ chainId: Number(chainId) })
                setLoadingStates('switching network')
                await new Promise((resolve) => setTimeout(resolve, 2000))
                setLoadingStates('loading')
            } catch (error) {
                setLoadingStates('idle')
                console.error('Error switching network:', error)
                setErrorState({
                    showError: true,
                    errorMessage: 'Error switching network',
                })
            }
        }
    }

    async function checkBalance({
        chainId,
        tokenAddress,
        tokenType,
        tokenDecimals,
        amount,
    }: {
        chainId: string
        tokenAddress: string
        tokenType: number
        tokenDecimals: number
        amount: number
    }) {
        // check if the amount is less than the user balance
        if (userBalances.length > 0) {
            const userBalance = userBalances.find(
                (balance) => balance.chainId == chainId && balance.address == tokenAddress
            )

            if (userBalance) {
                if (Number(amount) > userBalance.amount) {
                    setErrorState({
                        showError: true,
                        errorMessage: "You don't have enough funds",
                    })
                    return { success: 'false' }
                }
            } else {
                let _balance = tokenBalance
                if (_balance == undefined) {
                    _balance = Number(
                        await getTokenBalance({
                            chainId: chainId,
                            tokenAddress: tokenAddress,
                            walletAddress: address ?? '',
                            tokenDecimals: tokenDecimals,
                            tokenType: tokenType,
                        })
                    )
                }
                if (_balance < amount) {
                    setErrorState({
                        showError: true,
                        errorMessage: "You don't have enough funds",
                    })
                    return { success: 'false' }
                }
            }
        } else {
            let _balance = tokenBalance
            if (_balance == undefined) {
                _balance = Number(
                    await getTokenBalance({
                        chainId: chainId,
                        tokenAddress: tokenAddress,
                        walletAddress: address ?? '',
                        tokenDecimals: tokenDecimals,
                        tokenType: tokenType,
                    })
                )
            }

            if (_balance < amount) {
                setErrorState({
                    showError: true,
                    errorMessage: "You don't have enough funds",
                })
                return { success: 'false' }
            }
        }

        return { success: 'true' }
    }

    const createLink = useCallback(
        async (sendFormData: _consts.ISendFormData) => {
            try {
                if (isLoading) return

                setLoadingStates('checking inputs')
                setErrorState({
                    showError: false,
                    errorMessage: '',
                })

                //check if the formdata is correct
                if (checkForm(sendFormData).success === 'false') {
                    return
                }

                await checkNetwork(sendFormData.chainId)
                setEnableConfirmation(true)

                const { tokenAmount, status } = await calculateTokenAmount(sendFormData)
                if (status == 'ERROR') {
                    setErrorState({
                        showError: true,
                        errorMessage: 'Something went wrong while calculating the token amount',
                    })
                    return
                }

                //get the token details
                const { tokenAddress, tokenDecimals, tokenType } = _utils.getTokenDetails(
                    sendFormData,
                    userBalances,
                    tokenDetails,
                    chainsToShow
                )

                //check if the user has enough funds
                const _checkBalance = await checkBalance({
                    chainId: sendFormData.chainId,
                    tokenAddress,
                    tokenType,
                    tokenDecimals,
                    amount: tokenAmount,
                })
                if (_checkBalance.success === 'false') {
                    return
                }

                console.log(
                    'bulk' +
                        'sending ' +
                        tokenAmount +
                        ' ' +
                        sendFormData.token +
                        ' on chain with id ' +
                        sendFormData.chainId +
                        ' with token address: ' +
                        tokenAddress +
                        ' with tokenType: ' +
                        tokenType +
                        ' with tokenDecimals: ' +
                        tokenDecimals
                )

                const passwords = await Promise.all(
                    Array.from({ length: sendFormData.bulkAmount ?? 1 }, async () => peanut.getRandomString(16))
                )

                // TODO: uncomment this once blockscout has made the url params changes
                // let baseUrl = ''
                // if (walletType === 'blockscout') {
                //     const envInfo = await sdk.safe.getEnvironmentInfo()
                //     baseUrl = `${envInfo.origin}/apps/peanut-protocol`
                // } else if (typeof window !== 'undefined') {
                //     baseUrl = `${window.location.origin}/claim`
                // }

                // TODO: remove this once blockscout has made the url params
                let baseUrl = ''
                if (typeof window !== 'undefined') {
                    baseUrl = `${window.location.origin}/claim`
                }

                const linkDetails = {
                    chainId: sendFormData.chainId,
                    tokenAmount: parseFloat(tokenAmount.toFixed(6)),
                    tokenType: tokenType,
                    tokenAddress: tokenAddress,
                    tokenDecimals: tokenDecimals,
                    baseUrl: baseUrl,
                    trackId: 'ui',
                }

                setLoadingStates('preparing transaction')

                let getLinksFromTxResponse
                let txHash: string
                const currentDateTime = new Date()
                const tempLocalstorageKey =
                    'saving temp link without depositindex for address: ' + address + ' at ' + currentDateTime

                const latestContractVersion = peanut.getLatestContractVersion({
                    chainId: sendFormData.chainId.toString(),
                    type: 'normal',
                    experimental: false,
                })

                const latestBatcherVersion = peanut.getLatestContractVersion({
                    chainId: sendFormData.chainId.toString(),
                    type: 'batch',
                })

                console.log('latestContractVersion', latestContractVersion)
                console.log('latestBatcherVersion', latestBatcherVersion)

                const prepareTxsResponse = await peanut.prepareTxs({
                    address: address ?? '',
                    linkDetails,
                    passwords: passwords,
                    numberOfLinks: sendFormData.bulkAmount,
                    batcherContractVersion: latestBatcherVersion,
                    peanutContractVersion: latestContractVersion,
                })

                passwords.map((password, idx) => {
                    const tempLink =
                        '/claim?c=' +
                        linkDetails.chainId +
                        '&v=' +
                        latestContractVersion +
                        '&i=?&p=' +
                        password +
                        '&t=ui'
                    utils.saveToLocalStorage(tempLocalstorageKey + ' - ' + idx, tempLink)
                })

                const signedTxsResponse: string[] = []

                let idx = 0
                for (const tx of prepareTxsResponse.unsignedTxs) {
                    setLoadingStates('sign in wallet')

                    // Set fee options using our SDK
                    let txOptions
                    try {
                        txOptions = await setFeeOptions({
                            chainId: sendFormData.chainId,
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
                        chainId: Number(linkDetails.chainId), //TODO: chainId as number here
                    })
                    setLoadingStates('executing transaction')

                    if (walletType === 'safe') {
                        const sdk = new SafeAppsSDK({
                            allowedDomains: [/app.safe.global$/, /.*\.blockscout\.com$/],
                            debug: true,
                        })
                        while (true) {
                            const queued = await sdk.txs.getBySafeTxHash(hash)

                            if (
                                queued.txStatus === TransactionStatus.AWAITING_CONFIRMATIONS ||
                                queued.txStatus === TransactionStatus.AWAITING_EXECUTION
                            ) {
                                console.log('waiting for safe tx')

                                await new Promise((resolve) => setTimeout(resolve, 1000))
                            } else if (queued.txHash) {
                                hash = queued.txHash as `0x${string}`
                                break
                            }
                        }
                    }

                    // Wait for the transaction to be mined using wagmi/actions
                    // Only doing this for the approval transaction (the first tx)
                    // Includes retry logic. If the hash isnt available yet, it retries after .5 seconds for 3 times
                    if (prepareTxsResponse.unsignedTxs.length === 2 && idx === 0) {
                        for (let attempt = 0; attempt < 3; attempt++) {
                            try {
                                await waitForTransactionReceipt(config, {
                                    confirmations: 4,
                                    hash: hash,
                                    chainId: Number(sendFormData.chainId),
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

                setLoadingStates('creating links')

                getLinksFromTxResponse = await peanut.getLinksFromTx({
                    linkDetails,
                    txHash: signedTxsResponse[signedTxsResponse.length - 1],
                    passwords: passwords,
                })

                txHash = signedTxsResponse[signedTxsResponse.length - 1]

                verbose && console.log('Created links:', getLinksFromTxResponse.links)
                verbose && console.log('Transaction hash:', txHash)

                passwords.map((password, idx) => {
                    utils.delteFromLocalStorage(tempLocalstorageKey + ' - ' + idx)
                })

                getLinksFromTxResponse.links.forEach((link: any, index: any) => {
                    utils.saveToLocalStorage(address + ' - ' + txHash + ' - ' + index, link)
                })

                setClaimLink(getLinksFromTxResponse.links)
                setTxHash(txHash)
                setChainId(sendFormData.chainId)
                onNextScreen()
            } catch (error: any) {
                if (error instanceof peanut.interfaces.SDKStatus && !error.originalError) {
                    const errorMessage = utils.sdkErrorHandler(error)
                    setErrorState({
                        showError: true,
                        errorMessage: errorMessage,
                    })
                } else {
                    console.error(error)
                    if (error.toString().includes('insufficient funds')) {
                        setErrorState({
                            showError: true,
                            errorMessage: "You don't have enough funds",
                        })
                    } else if (error.toString().includes('user rejected transaction')) {
                        setErrorState({
                            showError: true,
                            errorMessage: 'Please confirm the transaction in your wallet',
                        })
                    } else if (error.toString().includes('not deployed on chain')) {
                        setErrorState({
                            showError: true,
                            errorMessage: 'Batch creating links is not possible on this chain.',
                        })
                    } else if (error.toString().includes('User rejected the request')) {
                        setErrorState({
                            showError: true,
                            errorMessage: 'Please confirm the request in your wallet',
                        })
                    } else if (error.toString().includes('NETWORK_ERROR')) {
                        setErrorState({
                            showError: true,
                            errorMessage: 'A network error occured. Please refresh and try again',
                        })
                    } else if (error.toString().includes('NONCE_EXPIRED')) {
                        setErrorState({
                            showError: true,
                            errorMessage: 'Nonce expired, please try again',
                        })
                    } else if (error.toString().includes('Failed to get wallet client')) {
                        setErrorState({
                            showError: true,
                            errorMessage: 'Please make sure your wallet is connected.',
                        })
                    } else if (error.toString().includes('gas required exceeds allowance')) {
                        setErrorState({
                            showError: true,
                            errorMessage: 'Gas required exceeds balance. Please confirm you have enough funds.',
                        })
                    } else {
                        setErrorState({
                            showError: true,
                            errorMessage: 'Something failed while creating your link. Please try again',
                        })
                    }
                }
            } finally {
                setLoadingStates('idle')
                setEnableConfirmation(false)
            }
        },
        [
            currentChain,
            userBalances,
            onNextScreen,
            isLoading,
            address,
            inputDenomination,
            tokenPrice,
            advancedDropdownOpen,
            createGasless,
        ]
    )

    function classNames(...classes: any) {
        return classes.filter(Boolean).join(' ')
    }

    //update the errormessage when the walletAddress has been changed
    useEffect(() => {
        setErrorState({
            showError: false,
            errorMessage: '',
        })
    }, [address])

    //when the token has changed, fetch the tokenprice and display it
    useEffect(() => {
        let isCurrent = true

        async function fetchAndSetTokenPrice(tokenAddress: string, chainId: string) {
            if (!supportedMobulaChains.some((chain) => chain.chainId == chainId)) {
                setTokenPrice(undefined)
                setInputDenomination('TOKEN')
                return
            } else {
                const tokenPriceResponse = await utils.fetchTokenPrice(tokenAddress, chainId)
                if (!isCurrent) {
                    return // if landed here, fetch outdated so discard the result
                }
                if (tokenPriceResponse?.price) {
                    setTokenPrice(tokenPriceResponse.price)
                } else {
                    setTokenPrice(undefined)
                    setInputDenomination('TOKEN')
                }
            }
        }

        async function fetchAndSetTokenBalance(tokenAddress: string, chainId: string) {
            if (isConnected) {
                try {
                    let balance = ''
                    if (userBalances.length > 0) {
                        const userBalance = userBalances.find(
                            (balance) => balance.chainId == chainId && balance.address == tokenAddress
                        )
                        if (userBalance && userBalance.amount > 0) {
                            balance = userBalance.amount.toString()
                        } else {
                            const _balance = await getTokenBalance({
                                chainId: chainId,
                                tokenAddress: tokenAddress,
                                walletAddress: address ?? '',
                            })
                            balance = _balance.toString()
                        }
                    } else {
                        const _balance = await getTokenBalance({
                            chainId: chainId,
                            tokenAddress: tokenAddress,
                            walletAddress: address ?? '',
                        })
                        balance = _balance.toString()
                    }

                    if (!isCurrent) {
                        return // if landed here, fetch outdated so discard the result
                    }

                    setTokenBalance(Number(balance))
                } catch (error) {
                    console.log('error fetching token balance:', error)
                    setTokenBalance(undefined)
                }
            }
        }

        setTokenBalance(undefined)

        if (!isConnected) {
            setTokenPrice(undefined)
            setTokenBalance(undefined)
        } else if (formwatch.token && formwatch.chainId) {
            const tokenAddress = tokenList.find((token) => token.symbol == formwatch.token)?.address ?? undefined
            if (tokenAddress) {
                fetchAndSetTokenPrice(tokenAddress, formwatch.chainId)
                fetchAndSetTokenBalance(tokenAddress, formwatch.chainId)
                return () => {
                    isCurrent = false
                }
            }
        }
    }, [formwatch.token, formwatch.chainId, isConnected])

    useEffect(() => {
        if (
            currentChain &&
            currentChain?.id.toString() != formwatch.chainId &&
            !formHasBeenTouched &&
            chainDetails.some((chain) => chain.chainId == currentChain.id)
        ) {
            // if the user is connected and the forms hasnt been touched by the user, we set the chain to the current chain and the token to native token on that chain
            sendForm.setValue(
                'token',
                chainDetails.find((chain) => chain.chainId == currentChain.id)?.nativeCurrency.symbol ?? ''
            )
            sendForm.setValue('chainId', currentChain.id.toString())
        } else if (
            !formHasBeenTouched &&
            userBalances.length > 0 &&
            !userBalances.some((balance) => balance.chainId == formwatch.chainId)
        ) {
            // if the user has balances but not on the current chain, we switch to the first chain the user has balances on and set the token to the first token on that chain
            sendForm.setValue('chainId', userBalances[0].chainId)
            sendForm.setValue('token', userBalances[0].symbol)
        } else if (!currentChain) {
            // if the user is not connected, we set the chain to the first chain to optimism and token to ETH
            sendForm.setValue('chainId', '10')
            sendForm.setValue('token', 'ETH')
        }
    }, [currentChain, chainDetails, chainsToShow, formHasBeenTouched, isConnected, userBalances])

    return (
        <>
            <div className="flex w-full flex-col items-center text-center  sm:mb-3">
                <h2 className="title-font bold text-2xl lg:text-4xl">Batch Transaction</h2>
                <div className="w-4/5 font-normal">
                    Deposit the funds you want to send to many people. You will get a list of links that you can share
                    via messenger, email or pidgeon post. The recipient will be able to claim the funds on any chain in
                    any token.
                </div>
            </div>
            <form className="w-full" onSubmit={sendForm.handleSubmit(createLink)}>
                <div className="flex w-full flex-col items-center gap-0 sm:gap-5">
                    <div className="hidden flex-row items-center justify-center gap-6 p-4 sm:flex sm:w-3/4">
                        <div className="flex flex-col justify-end gap-0 pt-2 ">
                            <div className="flex h-16 items-center justify-center">
                                <label className={'flex h-full items-center font-bold ' + textFontSize}>
                                    {inputDenomination == 'USD' ? '$' : ' '}
                                </label>
                                <div className="w-full max-w-[160px] ">
                                    <input
                                        className={
                                            'w-full border-none bg-transparent font-black tracking-wide text-black outline-none placeholder:font-black placeholder:text-black ' +
                                            textFontSize
                                        }
                                        placeholder="0.00"
                                        onChange={(e) => {
                                            const value = utils.formatAmountWithoutComma(e.target.value)
                                            setTextFontSize(_utils.textHandler(value))
                                            sendForm.setValue('amount', value)
                                        }}
                                        type="number"
                                        inputMode="decimal"
                                        step="any"
                                        min="0"
                                        autoComplete="off"
                                        onFocus={(e) => e.target.select()}
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div>
                                {tokenPrice ? (
                                    <div>
                                        <img
                                            onClick={() => {
                                                setInputDenomination(inputDenomination == 'TOKEN' ? 'USD' : 'TOKEN')
                                            }}
                                            src={switch_svg.src}
                                            className="relative z-10 h-4 cursor-pointer"
                                        />
                                        <label className="ml-4 w-max pr-2 text-sm font-bold">
                                            {tokenPrice && formwatch.amount && Number(formwatch.amount) > 0
                                                ? inputDenomination == 'USD'
                                                    ? utils.formatTokenAmount(Number(formwatch.amount) / tokenPrice) +
                                                      ' ' +
                                                      formwatch.token
                                                    : '$ ' +
                                                      utils.formatTokenAmount(Number(formwatch.amount) * tokenPrice)
                                                : inputDenomination == 'USD'
                                                  ? '0.00'
                                                  : '$ 0.00'}
                                        </label>
                                    </div>
                                ) : (
                                    <div className="h-5"></div>
                                )}
                            </div>
                        </div>
                        <div
                            className={
                                ' flex w-[136px] cursor-pointer flex-col gap-2 border-4 border-solid !px-8 !py-1 ' +
                                (isConnected ? '  h-[70px] ' : ' h-[58px] ')
                            }
                            onClick={() => {
                                if (isConnected && chainsToShow.length <= 0) {
                                    setErrorState({
                                        showError: true,
                                        errorMessage: 'No funds available',
                                    })
                                } else {
                                    setIsTokenSelectorOpen(true)
                                }
                            }}
                        >
                            {isConnected ? (
                                chainsToShow.length > 0 ? (
                                    <div className="flex cursor-pointer flex-col items-center justify-center">
                                        <label className="cursor-pointer self-center overflow-hidden overflow-ellipsis whitespace-nowrap break-all text-sm font-bold">
                                            {chainsToShow.find((chain) => chain.chainId == formwatch.chainId)?.name}
                                        </label>{' '}
                                        <label className=" cursor-pointer self-center overflow-hidden overflow-ellipsis whitespace-nowrap break-all text-xl font-bold">
                                            {formwatch.token}
                                        </label>
                                        {tokenBalance != undefined ? (
                                            <label className=" cursor-pointer self-center overflow-hidden overflow-ellipsis whitespace-nowrap break-all text-xs font-light">
                                                balance: {utils.formatTokenAmount(tokenBalance, 4)}
                                            </label>
                                        ) : (
                                            <div className="mb-1 flex justify-center gap-1 text-xs font-light">
                                                <label>balance: </label>
                                                <span className="bouncing-dots flex">
                                                    <span className="dot">.</span>
                                                    <span className="dot">.</span>
                                                    <span className="dot">.</span>
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <label className="flex h-full items-center justify-center text-sm font-bold">
                                        No funds available
                                    </label>
                                )
                            ) : (
                                <div className="flex cursor-pointer flex-col items-center justify-center">
                                    <label className="cursor-pointer self-center overflow-hidden overflow-ellipsis whitespace-nowrap break-all text-sm font-bold">
                                        {chainsToShow.find((chain) => chain.chainId == formwatch.chainId)?.name}
                                    </label>{' '}
                                    <label className=" cursor-pointer self-center overflow-hidden overflow-ellipsis whitespace-nowrap break-all text-xl font-bold">
                                        {formwatch.token}
                                    </label>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex w-full flex-col items-center justify-center gap-6 p-4 sm:hidden ">
                        <div
                            className={
                                ' flex w-[136px] cursor-pointer flex-col gap-2 border-4 border-solid !px-8 !py-1 ' +
                                (isConnected ? '  h-[70px] ' : ' h-[58px] ')
                            }
                            onClick={() => {
                                if (isConnected && chainsToShow.length <= 0) {
                                    setErrorState({
                                        showError: true,
                                        errorMessage: 'No funds available',
                                    })
                                } else {
                                    setIsTokenSelectorOpen(true)
                                }
                            }}
                        >
                            {isConnected ? (
                                chainsToShow.length > 0 ? (
                                    <div className="flex cursor-pointer flex-col items-center justify-center">
                                        <label className="self-center overflow-hidden overflow-ellipsis whitespace-nowrap break-all text-sm font-bold">
                                            {chainDetails.find((chain) => chain.chainId == formwatch.chainId)?.name}
                                        </label>{' '}
                                        <label className=" self-center overflow-hidden overflow-ellipsis whitespace-nowrap break-all text-xl font-bold">
                                            {formwatch.token}
                                        </label>
                                        {tokenBalance != undefined ? (
                                            <label className="cursor-pointer self-center overflow-hidden overflow-ellipsis whitespace-nowrap break-all text-xs font-light">
                                                balance: {utils.formatTokenAmount(tokenBalance, 4)}
                                            </label>
                                        ) : (
                                            <div className="flex justify-center gap-1 text-xs font-light">
                                                <label>balance: </label>
                                                <span className="bouncing-dots flex">
                                                    <span className="dot">.</span>
                                                    <span className="dot">.</span>
                                                    <span className="dot">.</span>
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <label className="flex h-full items-center justify-center text-sm font-bold">
                                        No funds available
                                    </label>
                                )
                            ) : (
                                <div className="flex cursor-pointer flex-col items-center justify-center">
                                    <label className="self-center overflow-hidden overflow-ellipsis whitespace-nowrap break-all text-sm font-bold">
                                        {chainDetails.find((chain) => chain.chainId == formwatch.chainId)?.name}
                                    </label>{' '}
                                    <label className=" self-center overflow-hidden overflow-ellipsis whitespace-nowrap break-all text-xl font-bold">
                                        {formwatch.token}
                                    </label>
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col justify-end gap-0 pt-2">
                            <div className="flex max-w-[280px] items-center self-end rounded border border-gray-400 px-2 ">
                                <label className={'flex h-full items-center font-bold ' + textFontSize}>
                                    {inputDenomination == 'USD' ? '$' : ' '}
                                </label>

                                <input
                                    className={
                                        'no-spin block w-full appearance-none border-none bg-none p-0 font-black outline-none placeholder:font-black placeholder:text-black ' +
                                        textFontSize
                                    }
                                    placeholder="0.00"
                                    inputMode="decimal"
                                    step="any"
                                    min="0"
                                    autoComplete="off"
                                    onFocus={(e) => e.target.select()}
                                    autoFocus
                                    onChange={(e) => {
                                        const value = utils.formatAmountWithoutComma(e.target.value)
                                        setTextFontSize(_utils.textHandler(value))
                                        sendForm.setValue('amount', value)
                                    }}
                                    pattern="[0-9]*[.,]?[0-9]*"
                                    size={formwatch.amount ? formwatch.amount.length : 4}
                                />
                            </div>

                            {tokenPrice ? (
                                <div className="flex w-full items-center justify-center">
                                    <img
                                        onClick={() => {
                                            setInputDenomination(inputDenomination == 'TOKEN' ? 'USD' : 'TOKEN')
                                        }}
                                        src={switch_svg.src}
                                        className="h-4 cursor-pointer"
                                    />
                                    <label className="ml-4 w-max pr-2 text-sm font-bold">
                                        {tokenPrice && formwatch.amount && Number(formwatch.amount) > 0
                                            ? inputDenomination == 'USD'
                                                ? utils.formatTokenAmount(Number(formwatch.amount) / tokenPrice) +
                                                  ' ' +
                                                  formwatch.token
                                                : '$ ' + utils.formatTokenAmount(Number(formwatch.amount) * tokenPrice)
                                            : '0.00 '}
                                    </label>
                                </div>
                            ) : (
                                <div className="h-5"></div>
                            )}
                        </div>
                    </div>

                    <div className="my-4 flex w-full flex-col items-center justify-center gap-2 sm:my-0 sm:w-3/5 lg:w-2/3">
                        <div className="relative w-full px-2 sm:w-3/4">
                            <div className="absolute inset-y-0 right-4 box-border flex items-center ">
                                <span className="cursor-pointertext-lg align-center flex h-1/2 ">
                                    <button
                                        type="button"
                                        className={
                                            'relative inline-flex items-center border-none bg-white font-black text-black'
                                        }
                                    >
                                        Links
                                    </button>
                                </span>
                            </div>

                            <input
                                type="number"
                                step="1"
                                min="0"
                                autoComplete="off"
                                className="no-spin brutalborder block w-full appearance-none px-2 py-4 pl-4 text-lg font-bold outline-none placeholder:text-lg placeholder:font-bold placeholder:text-black "
                                placeholder="0"
                                aria-describedby="price-currency"
                                onChange={(e) => {
                                    // if e.target.value isnt a whole number, dont set the value
                                    console.log(e.target.valueAsNumber)
                                    if (!e.target.value.includes('.') || !e.target.value.includes('-')) {
                                        sendForm.setValue('bulkAmount', e.target.valueAsNumber)
                                    }
                                }}
                            />
                        </div>
                        {formwatch.amount && formwatch.token && formwatch.bulkAmount ? (
                            <div>
                                <div className="flex text-center text-base">
                                    {' '}
                                    You will be sending {formwatch.bulkAmount} links. The total value will be{' '}
                                    {inputDenomination == 'USD'
                                        ? utils.formatTokenAmount(
                                              Number(
                                                  tokenPrice &&
                                                      formwatch.amount &&
                                                      (Number(formwatch.amount) / tokenPrice) * formwatch.bulkAmount
                                              )
                                          )
                                        : utils.formatTokenAmount(formwatch.bulkAmount * Number(formwatch.amount))}{' '}
                                    {formwatch.token}
                                </div>
                            </div>
                        ) : (
                            ''
                        )}
                    </div>

                    <div
                        className={
                            errorState.showError || showGaslessAvailable
                                ? 'mx-auto mb-0 mt-4 flex w-full flex-col items-center gap-10 sm:mt-0'
                                : 'mx-auto mb-8 mt-4 flex w-full flex-col items-center sm:mt-0'
                        }
                    >
                        <button
                            type={isConnected ? 'submit' : 'button'}
                            className="mt-2 block w-[90%] cursor-pointer bg-white p-5 px-2  text-2xl font-black sm:w-2/5 lg:w-1/2"
                            id="cta-btn"
                            onClick={() => {
                                if (!isConnected) {
                                    open()
                                }
                            }}
                            disabled={isLoading ? true : false}
                        >
                            {isLoading ? (
                                <div className="flex justify-center gap-1">
                                    <label>{loadingStates} </label>
                                    <span className="bouncing-dots flex">
                                        <span className="dot">.</span>
                                        <span className="dot">.</span>
                                        <span className="dot">.</span>
                                    </span>
                                </div>
                            ) : !isConnected ? (
                                'Connect Wallet'
                            ) : advancedDropdownOpen ? (
                                'Bulk Send'
                            ) : (
                                'Send'
                            )}
                        </button>
                        {errorState.showError ? (
                            <div className="text-center">
                                <label className="font-bold text-red ">{errorState.errorMessage}</label>
                            </div>
                        ) : (
                            showGaslessAvailable && (
                                <div className="flex flex-row items-center justify-center gap-1 text-center">
                                    <label className="font-bold text-black ">
                                        All USDC links are created gaslessly and sponsored by peanut!
                                    </label>
                                </div>
                            )
                        )}
                    </div>
                </div>
            </form>

            <global_components.PeanutMan type={'presenting'} />
            <Transition.Root show={isTokenSelectorOpen} as={Fragment}>
                <Dialog
                    as="div"
                    className="relative z-20 "
                    onClose={() => {
                        setFormHasBeenTouched(true)
                        setIsTokenSelectorOpen(false)
                        setUnfoldChains(false)
                        setFilteredTokenList(undefined)
                    }}
                >
                    <Transition.Child
                        as={Fragment}
                        enter="ease-out duration-300"
                        enterFrom="opacity-0"
                        enterTo="opacity-100"
                        leave="ease-in duration-200"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                    >
                        <div className="fixed inset-0 bg-black bg-opacity-75 transition-opacity" />
                    </Transition.Child>

                    <div className="fixed inset-0 z-20 overflow-y-auto">
                        <div className="flex min-h-full min-w-full items-end justify-center text-center sm:items-center ">
                            <Transition.Child
                                as={Fragment}
                                enter="ease-out duration-300"
                                enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                                enterTo="opacity-100 translate-y-0 sm:scale-100"
                                leave="ease-in duration-200"
                                leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                                leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                            >
                                <Dialog.Panel className="brutalborder relative min-h-[240px] w-full transform overflow-hidden rounded-lg rounded-none bg-white pt-5 text-left text-black shadow-xl transition-all sm:mt-8 sm:min-h-[380px] sm:w-auto sm:min-w-[420px] sm:max-w-[420px] ">
                                    <div className="mb-8 flex items-center justify-center sm:hidden">
                                        <svg width="128" height="6">
                                            <rect width="128" height="6" />
                                        </svg>
                                    </div>
                                    {!walletType && (
                                        <div className="mb-8 ml-4 mr-4 sm:mb-2">
                                            <div
                                                className={
                                                    'flex  w-full flex-wrap gap-2 overflow-hidden text-black ' +
                                                    (unfoldChains ? ' max-h-full ' : ' max-h-32 ')
                                                }
                                            >
                                                {chainsToShow.map(
                                                    (chain) =>
                                                        chain.mainnet && (
                                                            <div
                                                                key={chain.chainId}
                                                                className={
                                                                    'brutalborder flex h-full w-1/5 min-w-max grow cursor-pointer flex-row gap-2 px-2 py-1 sm:w-[12%] ' +
                                                                    (formwatch.chainId == chain.chainId
                                                                        ? 'bg-black text-white'
                                                                        : '')
                                                                }
                                                                onClick={() => {
                                                                    sendForm.setValue('chainId', chain.chainId)
                                                                    sendForm.setValue(
                                                                        'token',
                                                                        chain.nativeCurrency.symbol
                                                                    )
                                                                    setFormHasBeenTouched(true)
                                                                }}
                                                            >
                                                                <img
                                                                    src={chain.icon.url}
                                                                    className="h-6 w-6 cursor-pointer rounded-full bg-white "
                                                                    onError={(e: any) => {
                                                                        e.target.onerror = null
                                                                    }}
                                                                />

                                                                <label className="flex cursor-pointer items-center">
                                                                    {chain.name.toUpperCase()}
                                                                </label>
                                                            </div>
                                                        )
                                                )}
                                                <div className="brutalborder flex w-full"></div>
                                                {chainsToShow.map(
                                                    (chain) =>
                                                        !chain.mainnet && (
                                                            <div
                                                                key={chain.chainId}
                                                                className={
                                                                    'brutalborder flex h-full w-1/5 min-w-max grow cursor-pointer flex-row gap-2 px-2 py-1 sm:w-[12%] ' +
                                                                    (formwatch.chainId == chain.chainId
                                                                        ? 'bg-black text-white'
                                                                        : '')
                                                                }
                                                                onClick={() => {
                                                                    sendForm.setValue('chainId', chain.chainId)
                                                                    sendForm.setValue(
                                                                        'token',
                                                                        chain.nativeCurrency.symbol
                                                                    )
                                                                    setFormHasBeenTouched(true)
                                                                }}
                                                            >
                                                                <img
                                                                    src={chain.icon.url}
                                                                    className="h-6 w-6 cursor-pointer rounded-full bg-white "
                                                                    onError={(e: any) => {
                                                                        e.target.onerror = null
                                                                    }}
                                                                />

                                                                <label className="flex cursor-pointer items-center">
                                                                    {chain.name.toUpperCase()}
                                                                </label>
                                                            </div>
                                                        )
                                                )}
                                            </div>
                                            <div className="flex w-full justify-between">
                                                <Switch.Group
                                                    as="div"
                                                    className={classNames(
                                                        'flex items-center p-0',
                                                        unfoldChains ? 'mt-1' : 'mt-0'
                                                    )}
                                                >
                                                    <Switch
                                                        checked={unfoldChains}
                                                        onChange={setUnfoldChains}
                                                        className={classNames(
                                                            unfoldChains ? 'bg-teal' : 'bg-gray-200',
                                                            'relative m-0 inline-flex h-4 w-9 flex-shrink-0 cursor-pointer rounded-none border-2 border-black p-0 transition-colors duration-200 ease-in-out '
                                                        )}
                                                    >
                                                        <span
                                                            aria-hidden="true"
                                                            className={classNames(
                                                                unfoldChains ? 'translate-x-5' : 'translate-x-0',
                                                                'pointer-events-none m-0 inline-block h-3 w-3 transform rounded-none border-2 border-black bg-white shadow ring-0 transition duration-200 ease-in-out'
                                                            )}
                                                        />
                                                    </Switch>
                                                    <Switch.Label as="span" className="ml-3">
                                                        <span className="text-sm">show all</span>
                                                    </Switch.Label>
                                                </Switch.Group>
                                            </div>
                                        </div>
                                    )}

                                    <div className="mb-8 ml-4 mr-4 sm:mb-4">
                                        <input
                                            placeholder="Search"
                                            className="brutalborder w-full rounded-none px-1 py-2 text-lg focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal"
                                            onKeyUp={(e) => {
                                                //@ts-ignore
                                                const searchValue = e.target.value
                                                if (searchValue == '') {
                                                    setFilteredTokenList(undefined)
                                                } else {
                                                    setFilteredTokenList(
                                                        tokenList.filter((token) =>
                                                            token.symbol
                                                                .toLowerCase()
                                                                .includes(searchValue.toLowerCase())
                                                        )
                                                    )
                                                }
                                            }}
                                        />
                                    </div>

                                    <div className="brutalscroll flex max-h-64 min-h-32 flex-col overflow-auto	 overflow-x-hidden  sm:mt-2 ">
                                        {filteredTokenList
                                            ? filteredTokenList.map((token) => (
                                                  <div
                                                      key={token.address + Math.random()}
                                                      className={
                                                          'flex cursor-pointer flex-row justify-between px-2 py-2  ' +
                                                          (formwatch.token == token.symbol
                                                              ? ' bg-black text-white'
                                                              : '')
                                                      }
                                                      onClick={() => {
                                                          sendForm.setValue('token', token.symbol)
                                                          sendForm.setValue('chainId', token.chainId)
                                                          setFormHasBeenTouched(true)
                                                          setIsTokenSelectorOpen(false)
                                                          setUnfoldChains(false)
                                                          setFilteredTokenList(undefined)
                                                      }}
                                                  >
                                                      <div className="flex items-center gap-2 ">
                                                          <img
                                                              src={token.logo}
                                                              className="h-6 rounded-full bg-white"
                                                              loading="eager"
                                                              onError={(e: any) => {
                                                                  e.target.onerror = null
                                                              }}
                                                          />
                                                          <div>{token.name}</div>
                                                      </div>
                                                      <div className="flex items-center gap-2">
                                                          <div>
                                                              {token.amount > 0 &&
                                                                  utils.formatTokenAmount(token.amount)}
                                                          </div>{' '}
                                                          <div>{token.symbol}</div>
                                                      </div>
                                                  </div>
                                              ))
                                            : tokenList.map((token) => (
                                                  <div
                                                      key={token.address + Math.random()}
                                                      className={
                                                          'flex cursor-pointer flex-row justify-between px-2 py-2  ' +
                                                          (formwatch.token == token.symbol
                                                              ? ' bg-black text-white'
                                                              : '')
                                                      }
                                                      onClick={() => {
                                                          setFormHasBeenTouched(true)
                                                          setIsTokenSelectorOpen(false)
                                                          setUnfoldChains(false)
                                                          setFilteredTokenList(undefined)
                                                          sendForm.setValue('token', token.symbol)
                                                          sendForm.setValue('chainId', token.chainId)
                                                      }}
                                                  >
                                                      <div className="flex items-center gap-2 ">
                                                          <img
                                                              src={token.logo}
                                                              className="h-6 rounded-full bg-white"
                                                              loading="eager"
                                                              onError={(e: any) => {
                                                                  e.target.onerror = null
                                                              }}
                                                          />
                                                          <div>{token.name}</div>
                                                      </div>
                                                      <div className="flex items-center gap-2">
                                                          <div>
                                                              {token.amount > 0 &&
                                                                  utils.formatTokenAmount(token.amount)}
                                                          </div>{' '}
                                                          <div>{token.symbol}</div>
                                                      </div>
                                                  </div>
                                              ))}
                                    </div>
                                </Dialog.Panel>
                            </Transition.Child>
                        </div>
                    </div>
                </Dialog>
            </Transition.Root>
        </>
    )
}
