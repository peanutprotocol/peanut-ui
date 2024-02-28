import { useEffect, useState, useCallback, useMemo, Fragment } from 'react'
import { useWeb3Modal } from '@web3modal/wagmi/react'
import { useAtom } from 'jotai'
import { useAccount, useConfig, useSendTransaction, useSwitchChain } from 'wagmi'
import { waitForTransactionReceipt } from 'wagmi/actions'
import { useForm } from 'react-hook-form'
import { Dialog, Transition } from '@headlessui/react'
import axios from 'axios'
import { Switch } from '@headlessui/react'
import peanut, { getRaffleLinkFromTx, setFeeOptions, validateUserName } from '@squirrel-labs/peanut-sdk'

import * as store from '@/store'
import * as consts from '@/consts'
import * as _consts from '../send.consts'
import * as utils from '@/utils'
import * as _utils from '../send.utils'
import * as hooks from '@/hooks'
import * as global_components from '@/components/global'

import dropdown_svg from '@/assets/dropdown.svg'

export function RaffleInitialView({
    onNextScreen,
    setClaimLink,
    setTxHash,
    setChainId,
    ensName,
}: _consts.ISendScreenProps) {
    //hooks
    const { open } = useWeb3Modal()
    const { isConnected, address, chain: currentChain } = useAccount()
    const { switchChainAsync } = useSwitchChain()
    const { sendTransactionAsync } = useSendTransaction()
    const config = useConfig()

    //local states
    const [filteredTokenList, setFilteredTokenList] = useState<_consts.ITokenListItem[] | undefined>(undefined)
    const [formHasBeenTouched, setFormHasBeenTouched] = useState(false)
    const [isTokenSelectorOpen, setIsTokenSelectorOpen] = useState(false)
    const [enableConfirmation, setEnableConfirmation] = useState(false)
    const [loadingStates, setLoadingStates] = useState<consts.LoadingStates>('idle')
    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })
    const [tokenPrice, setTokenPrice] = useState<number | undefined>(undefined)
    const [unfoldChains, setUnfoldChains] = useState(false)
    const [showTestnets, setShowTestnets] = useState(false)
    const [showModal, setShowModal] = useState(false)
    const [enteredEmail, setEnteredEmail] = useState('')
    const [sentEmail, setSentEmail] = useState(false)
    const mantleCheck = utils.isMantleInUrl()
    const verbose = true

    //global states
    const [userBalances] = useAtom(store.userBalancesAtom)
    const [chainDetails] = useAtom(store.defaultChainDetailsAtom)
    const [supportedChainsSocketTech] = useAtom(store.supportedChainsSocketTechAtom)
    const [tokenDetails] = useAtom(store.defaultTokenDetailsAtom)
    hooks.useConfirmRefresh(enableConfirmation)

    //form and modalform states
    const sendForm = useForm<_consts.ISendFormData>({
        mode: 'onChange',
        defaultValues: {
            chainId: mantleCheck ? '5000' : '10',
            amount: null,
            token: mantleCheck ? 'MNT' : 'ETH',
            numberOfrecipients: undefined,
            senderName: undefined,
        },
    })
    const formwatch = sendForm.watch()

    //memo
    const isLoading = useMemo(() => loadingStates !== 'idle', [loadingStates])
    const chainsToShow = useMemo(() => {
        if (mantleCheck) {
            return chainDetails.filter((chain) => chain.chainId == '5000' || chain.chainId == '5001')
        }
        if (isConnected && userBalances.length > 0) {
            const filteredChains = chainDetails.filter(
                (chain) => chain.chainId === userBalances.find((balance) => balance.chainId === chain.chainId)?.chainId
            )
            return filteredChains.concat(
                chainDetails.filter(
                    (item1) => !supportedChainsSocketTech.some((item2) => item2.chainId === item1.chainId)
                )
            )
        } else {
            return chainDetails
        }
    }, [isConnected, chainDetails, userBalances, supportedChainsSocketTech])

    const tokenList = useMemo(() => {
        if (isConnected) {
            if (userBalances.some((balance) => balance.chainId == formwatch.chainId)) {
                return userBalances
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
            return chainDetails
                .filter((chain) => chain.chainId == formwatch.chainId)
                .map((chain) => {
                    return {
                        symbol: chain.nativeCurrency.symbol,
                        chainId: chain.chainId.toString(),
                        amount: 0,
                        address: '',
                        decimals: 18,
                        logo: '',
                        name: chain.nativeCurrency.name,
                    }
                })
        }
    }, [isConnected, userBalances, tokenDetails, formwatch.chainId, chainDetails])

    const fetchTokenPrice = async (tokenAddress: string, chainId: string) => {
        try {
            const response = await axios.get('https://api.socket.tech/v2/token-price', {
                params: {
                    tokenAddress: tokenAddress,
                    chainId: chainId,
                },
                headers: {
                    accept: 'application/json',
                    'API-KEY': process.env.SOCKET_API_KEY,
                },
            })
            setTokenPrice(response.data.result.tokenPrice)
            return Number(response.data.result.tokenPrice)
        } catch (error) {
            console.log('error fetching token price for token ' + tokenAddress)
            setTokenPrice(undefined)
        }
    }

    const checkForm = (sendFormData: _consts.ISendFormData, tokenAddress: string) => {
        //check that the token and chainid are defined
        if (sendFormData.chainId == null || sendFormData.token == '') {
            setErrorState({
                showError: true,
                errorMessage: 'Please select a chain and token',
            })
            return { succes: 'false' }
        }

        //check if the amount is less than or equal to zero
        if (!sendFormData.amount || (sendFormData.amount && Number(sendFormData.amount) <= 0)) {
            setErrorState({
                showError: true,
                errorMessage: 'Please put an amount that is greater than zero',
            })
            return { succes: 'false' }
        }

        if (!sendFormData.numberOfrecipients || Number(sendFormData.numberOfrecipients) < 2) {
            setErrorState({
                showError: true,
                errorMessage: 'Minimum amount of recipients has to be larger than two',
            })

            return { succes: 'false' }
        }

        if (Number(sendFormData.numberOfrecipients) > 250) {
            setErrorState({
                showError: true,
                errorMessage: 'Maximum amount of recipients is 250',
            })

            return { succes: 'false' }
        }

        if (userBalances) {
            const amount = userBalances.find(
                (balance) => balance.chainId == sendFormData.chainId && balance.address == tokenAddress
            )?.amount

            if (amount && Number(sendFormData.amount) > amount) {
                setErrorState({
                    showError: true,
                    errorMessage: 'Insufficient funds to complete this transaction.',
                })

                return { succes: 'false' }
            }
        }

        return { succes: 'true' }
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

    const createLink = useCallback(
        async (sendFormData: _consts.ISendFormData) => {
            try {
                if (isLoading) return

                if (sendFormData.senderName) {
                    try {
                        sendFormData.senderName = validateUserName(sendFormData.senderName)
                    } catch (error) {
                        setErrorState({
                            showError: true,
                            errorMessage: 'Please make sure the username is valid.',
                        })
                        return
                    }
                }

                await checkNetwork(sendFormData.chainId)

                //get the token details
                const { tokenAddress, tokenDecimals, tokenType } = _utils.getTokenDetails(
                    sendFormData,
                    userBalances,
                    tokenDetails,
                    chainsToShow
                )

                setLoadingStates('checking inputs')
                setErrorState({
                    showError: false,
                    errorMessage: '',
                })

                //check if the formdata is correct
                if (checkForm(sendFormData, tokenAddress).succes === 'false') {
                    return
                }
                setEnableConfirmation(true)

                //Calculate the token amount
                const tokenAmount = Number(sendFormData.amount)

                console.log(
                    `creating raffle ${tokenAmount} ${sendFormData.token} on chain with id ${sendFormData.chainId} with token address: ${tokenAddress} with tokenType: ${tokenType} with tokenDecimals: ${tokenDecimals}`
                )
                //when the user tries to refresh, show an alert
                setEnableConfirmation(true)

                const password = await peanut.getRandomString(16)

                const baseUrl = `${window.location.origin}/raffle/claim`

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

                const currentDateTime = new Date()
                const tempLocalstorageKey =
                    'saving temp raffle link without depositindex for address: ' + address + ' at ' + currentDateTime

                const latestContractVersion = peanut.getLatestContractVersion({
                    chainId: sendFormData.chainId.toString(),
                    type: 'normal',
                    experimental: true,
                })
                const prepareTxsResponse = await peanut.prepareRaffleDepositTxs({
                    userAddress: address ?? '',
                    linkDetails,
                    password,
                    withMFA: true,
                    numberOfLinks: Number(sendFormData.numberOfrecipients),
                })

                const tempLink =
                    '/raffle/claim?c=' +
                    linkDetails.chainId +
                    '&v=' +
                    latestContractVersion +
                    '&i=?&p=' +
                    password +
                    '&t=ui'
                utils.saveToLocalStorage(tempLocalstorageKey, tempLink)

                // Array of txHashes
                const signedTxsResponse: string[] = []

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
                    const hash = await sendTransactionAsync({
                        to: (tx.to ? tx.to : '') as `0x${string}`,
                        value: tx.value ? BigInt(tx.value.toString()) : undefined,
                        data: tx.data ? (tx.data as `0x${string}`) : undefined,
                        gas: txOptions?.gas ? BigInt(txOptions.gas.toString()) : undefined,
                        gasPrice: txOptions?.gasPrice ? BigInt(txOptions.gasPrice.toString()) : undefined,
                        maxFeePerGas: txOptions?.maxFeePerGas ? BigInt(txOptions?.maxFeePerGas.toString()) : undefined,
                        maxPriorityFeePerGas: txOptions?.maxPriorityFeePerGas
                            ? BigInt(txOptions?.maxPriorityFeePerGas.toString())
                            : undefined,
                    })

                    setLoadingStates('executing transaction')

                    // Wait for the transaction to be mined using wagmi/actions
                    await waitForTransactionReceipt(config, {
                        confirmations: 2,
                        hash: hash,
                        chainId: Number(sendFormData.chainId),
                    })
                    signedTxsResponse.push(hash.toString())
                }

                setLoadingStates('creating link')

                const { link: fullCreatedLink } = await getRaffleLinkFromTx({
                    linkDetails,
                    txHash: signedTxsResponse[signedTxsResponse.length - 1],
                    password: password,
                    numberOfLinks: Number(sendFormData.numberOfrecipients),
                    name: sendFormData.senderName ?? '',
                    withMFA: true,
                    withCaptcha: true,
                    baseUrl: `${consts.next_proxy_url}/submit-raffle-link`,
                    APIKey: 'doesnt-matter',
                })
                // Remove indices since they are stored on the API anyway
                const fullCreatedURL = new URL(fullCreatedLink)
                fullCreatedURL.searchParams.delete('i')
                const minimizedLink = fullCreatedURL.toString()

                const txHash = signedTxsResponse[signedTxsResponse.length - 1]

                verbose && console.log('Created raffle link:', { fullCreatedLink, minimizedLink })
                verbose && console.log('Transaction hash:', txHash)

                utils.delteFromLocalStorage(tempLocalstorageKey)

                utils.saveToLocalStorage(address + ' - raffle - ' + txHash, minimizedLink)

                setClaimLink([minimizedLink])
                setTxHash(txHash)
                setChainId(sendFormData.chainId)
                onNextScreen()
            } catch (error: any) {
                console.error(error)
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
                            errorMessage:
                                'Creating a raffle is not possible on this chain yet, please try another chain',
                        })
                    } else if (error.toString().includes('User rejected the request')) {
                        setErrorState({
                            showError: true,
                            errorMessage: 'Please allow the network switch in your wallet',
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
        [currentChain, userBalances, onNextScreen, isLoading, address, tokenPrice]
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
        if (!isConnected) setTokenPrice(undefined)
        else if (formwatch.token && formwatch.chainId) {
            const tokenAddress = tokenList.find((token) => token.symbol == formwatch.token)?.address ?? undefined
            if (tokenAddress) {
                if (tokenAddress == '0x0000000000000000000000000000000000000000') {
                    fetchTokenPrice('0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', formwatch.chainId)
                } else {
                    fetchTokenPrice(tokenAddress, formwatch.chainId)
                }
            }
        }
        if (formwatch.token) {
        }
    }, [formwatch.token, formwatch.chainId, isConnected])

    //update the chain and token when the user changes the chain in the wallet
    useEffect(() => {
        if (mantleCheck) {
            sendForm.setValue('chainId', '5000')
            return
        }
        if (
            currentChain &&
            currentChain?.id.toString() != formwatch.chainId &&
            !formHasBeenTouched &&
            chainDetails.some((chain) => chain.chainId == currentChain.id)
        ) {
            sendForm.setValue(
                'token',
                chainDetails.find((chain) => chain.chainId == currentChain.id)?.nativeCurrency.symbol ?? ''
            )
            sendForm.setValue('chainId', currentChain.id.toString())
        }
    }, [currentChain, chainDetails, chainsToShow, formHasBeenTouched, isConnected])

    useEffect(() => {
        if (!sentEmail && Number(formwatch.numberOfrecipients) > 10) {
            setShowModal(true)
        }
    }, [formwatch.numberOfrecipients])

    useEffect(() => {
        if (ensName) sendForm.setValue('senderName', ensName)
    }, [ensName])

    return (
        <>
            <div className=" mb-6 mt-10 flex w-full flex-col items-center gap-2 text-center">
                <h2 className="title-font bold my-0 text-2xl lg:text-4xl">Raffle</h2>
                <div className="my-0 w-4/5 font-normal">Create a raffle.</div>
            </div>
            <form className="w-full" onSubmit={sendForm.handleSubmit(createLink)}>
                <div className="flex w-full flex-col items-center gap-2 sm:gap-7">
                    <div className="flex w-full flex-col items-center justify-center gap-6 p-4 ">
                        <div
                            className=" flex h-[58px] w-[136px] cursor-pointer flex-col gap-2 border-4 border-solid !px-8 !py-1"
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
                        <div className=" flex h-[58px] w-[248px] flex-col gap-2 border-4 border-solid !px-4 !py-1">
                            <div className="font-normal">${formwatch.token} Amount *</div>
                            <div className="flex flex-row items-center justify-between">
                                <input
                                    onWheel={(e) => {
                                        // @ts-ignore
                                        e.target.blur()
                                    }}
                                    className="items-center overflow-hidden overflow-ellipsis whitespace-nowrap break-all border-none bg-transparent p-0 text-xl font-bold outline-none"
                                    placeholder="100"
                                    onChange={(e) => {
                                        const value = utils.formatAmountWithoutComma(e.target.value)
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

                                {tokenPrice && (
                                    <div className="flex min-w-max items-center text-xs font-normal ">
                                        ${utils.formatTokenAmount(Number(formwatch.amount) * tokenPrice)}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className=" flex h-[58px] w-[248px] flex-col gap-2 border-4 border-solid !px-4 !py-1">
                            <div className="font-normal">№ of Recipients *</div>
                            <div className="flex flex-row items-center justify-between">
                                <input
                                    onWheel={(e) => {
                                        // @ts-ignore
                                        e.target.blur()
                                    }}
                                    className="items-center overflow-hidden overflow-ellipsis whitespace-nowrap break-all border-none bg-transparent p-0 text-xl font-bold outline-none"
                                    placeholder="5"
                                    onChange={(e) => {
                                        sendForm.setValue('numberOfrecipients', e.target.value)
                                    }}
                                    type="number"
                                    inputMode="numeric"
                                    step="any"
                                    min="0"
                                    autoComplete="off"
                                    onFocus={(e) => e.target.select()}
                                    onKeyDown={(event) => {
                                        if (
                                            !/[0-9]/.test(event.key) &&
                                            ![
                                                'Backspace',
                                                'ArrowLeft',
                                                'ArrowRight',
                                                'ArrowUp',
                                                'ArrowDown',
                                                'Delete',
                                                'End',
                                                'Home',
                                                'Tab',
                                            ].includes(event.key)
                                        ) {
                                            event.preventDefault()
                                        }
                                    }}
                                />

                                <label className=" display-block w-12 text-xs font-normal">{'No fee'}</label>
                            </div>
                        </div>
                        <div className=" flex h-[58px] w-[248px] flex-col gap-2 border-4 border-solid !px-4 !py-1">
                            <div className="font-normal">Display Name</div>
                            <div className="flex flex-row items-center justify-between">
                                <input
                                    maxLength={15}
                                    className="items-center overflow-hidden overflow-ellipsis whitespace-nowrap break-all border-none bg-transparent p-0 text-xl font-bold outline-none"
                                    placeholder="Chad"
                                    type="text"
                                    autoComplete="off"
                                    onFocus={(e) => e.target.select()}
                                    {...sendForm.register('senderName')}
                                />
                            </div>
                        </div>
                    </div>
                    <div
                        className={
                            errorState.showError
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
                            ) : (
                                'Create'
                            )}
                        </button>
                        {errorState.showError && (
                            <div className="text-center">
                                <label className="font-bold text-red ">{errorState.errorMessage}</label>
                            </div>
                        )}
                    </div>
                </div>
            </form>

            <global_components.PeanutMan type={'presenting'} />
            <Transition.Root show={isTokenSelectorOpen} as={Fragment}>
                <Dialog
                    as="div"
                    className="relative z-10 "
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

                    <div className="fixed inset-0 z-10 overflow-y-auto">
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
                                    <div className="mb-8 ml-4 mr-4 sm:mb-2">
                                        <div
                                            className={
                                                'flex  w-full flex-wrap gap-2 overflow-hidden text-black ' +
                                                (unfoldChains ? ' max-h-full ' : ' max-h-32 ')
                                            }
                                        >
                                            {chainsToShow.map((chain) =>
                                                !showTestnets ? (
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
                                                                sendForm.setValue('token', chain.nativeCurrency.symbol)
                                                                setFormHasBeenTouched(true)
                                                            }}
                                                        >
                                                            <img
                                                                src={chain.icon.url}
                                                                className="h-6 cursor-pointer bg-white"
                                                            />

                                                            <label className="flex cursor-pointer items-center">
                                                                {chain.name.toUpperCase()}
                                                            </label>
                                                        </div>
                                                    )
                                                ) : (
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
                                                            sendForm.setValue('token', chain.nativeCurrency.symbol)
                                                            setFormHasBeenTouched(true)
                                                        }}
                                                    >
                                                        <img
                                                            src={chain.icon.url}
                                                            className="h-6 cursor-pointer bg-white"
                                                        />

                                                        <label className="flex cursor-pointer items-center">
                                                            {chain.name.toUpperCase()}
                                                        </label>
                                                    </div>
                                                )
                                            )}
                                        </div>
                                        <div className="flex w-full justify-between">
                                            <div className=" cursor-pointer ">
                                                <img
                                                    style={{
                                                        transform: unfoldChains ? 'scaleY(-1)' : 'none',
                                                        transition: 'transform 0.3s ease-in-out',
                                                    }}
                                                    src={dropdown_svg.src}
                                                    alt=""
                                                    className={'h-9 '}
                                                    onClick={() => {
                                                        console.log('unfolded chains')

                                                        setUnfoldChains(!unfoldChains)
                                                    }}
                                                />
                                            </div>

                                            <Switch.Group as="div" className="flex items-center p-0">
                                                <Switch
                                                    checked={showTestnets}
                                                    onChange={setShowTestnets}
                                                    className={classNames(
                                                        showTestnets ? 'bg-teal' : 'bg-gray-200',
                                                        'relative m-0 inline-flex h-4 w-9 flex-shrink-0 cursor-pointer rounded-none border-2 border-black p-0 transition-colors duration-200 ease-in-out '
                                                    )}
                                                >
                                                    <span
                                                        aria-hidden="true"
                                                        className={classNames(
                                                            showTestnets ? 'translate-x-5' : 'translate-x-0',
                                                            'pointer-events-none m-0 inline-block h-3 w-3 transform rounded-none border-2 border-black bg-white shadow ring-0 transition duration-200 ease-in-out'
                                                        )}
                                                    />
                                                </Switch>
                                                <Switch.Label as="span" className="ml-3">
                                                    <span className="text-sm">show testnets</span>
                                                </Switch.Label>
                                            </Switch.Group>
                                        </div>
                                    </div>

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
                                                      key={token.address}
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
                                                              className="h-6 bg-white"
                                                              loading="eager"
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
                                                      key={token.address}
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
                                                              className="h-6 bg-white"
                                                              loading="eager"
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

            <Transition.Root show={showModal} as={Fragment}>
                <Dialog
                    as="div"
                    className="relative z-10 "
                    onClose={() => {
                        setShowModal(false)
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

                    <div className="fixed inset-0 z-10 overflow-y-auto">
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
                                <Dialog.Panel className="brutalborder relative h-max w-full transform overflow-hidden rounded-lg rounded-none bg-white pt-5 text-left text-black shadow-xl transition-all sm:mt-8  sm:w-auto sm:min-w-[420px] sm:max-w-[420px] ">
                                    <div className="flex flex-col items-center justify-center gap-6 p-12 ">
                                        <div>
                                            Henlo! That's a lot of recipients! If you're running a larger campaign, we'd
                                            love to help.{' '}
                                            <a
                                                href={'https://cal.com/kkonrad+hugo0/15min?duration=30'}
                                                target="_blank"
                                                rel="noreferrer noopener"
                                                className=" cursor-pointer text-black underline"
                                            >
                                                book
                                            </a>{' '}
                                            a meeting or share your email and we'll get in touch!
                                        </div>

                                        <input
                                            className="brutalborder  w-3/4 items-center overflow-hidden overflow-ellipsis whitespace-nowrap break-all border-none bg-transparent text-xl font-bold outline-none"
                                            onChange={(e) => {
                                                setEnteredEmail(e.target.value)
                                            }}
                                        />

                                        <button
                                            className="mt-2 block w-[90%] cursor-pointer bg-white p-2 px-2 text-2xl font-black sm:w-2/5 lg:w-1/2"
                                            id="cta-btn-2"
                                            onClick={() => {
                                                setSentEmail(true)
                                                const message = ` 🐿️ Someone has entered their email when creating a raffle link, 
                                                tagging <@480931245107445760> <@833795975080181810>

                                                email: ${enteredEmail}
                                                `
                                                utils.fetchSendDiscordNotification({ message })
                                                setShowModal(false)
                                            }}
                                            disabled={isLoading ? true : false}
                                        >
                                            Continue
                                        </button>
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
