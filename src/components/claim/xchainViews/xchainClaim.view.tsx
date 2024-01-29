import { useWeb3Modal } from '@web3modal/wagmi/react'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { WalletClient, useAccount, useNetwork } from 'wagmi'
import peanut from '@squirrel-labs/peanut-sdk'
import { switchNetwork, getWalletClient } from '@wagmi/core'

import * as global_components from '@/components/global'
import * as _consts from '../claim.consts'
import * as consts from '@/consts'
import * as utils from '@/utils'
import * as store from '@/store/'
import dropdown_svg from '@/assets/dropdown.svg'
import { useAtom } from 'jotai'
import { Transition, Dialog } from '@headlessui/react'
import { BigNumber, providers } from 'ethers'
import { isMobile } from 'react-device-detect'

export function xchainClaimView({
    onNextScreen,
    claimDetails,
    setTxHash,
    tokenPrice,
    crossChainDetails,
    setCrossChainSuccess,
}: _consts.IClaimScreenProps) {
    const verbose = process.env.NODE_ENV === 'development' ? true : false

    const { isConnected, address } = useAccount()
    const { open } = useWeb3Modal()
    const { chain: currentChain } = useNetwork()

    const [chainDetails] = useAtom(store.defaultChainDetailsAtom)

    const [chainList, setChainList] = useState<{ chainId: string; chainName: string; chainIconURI: string }[]>([])
    const [selectedChain, setSelectedChain] = useState<{ chainId: string; chainName: string; chainIconURI: string }>({
        chainId: claimDetails[0].chainId,
        chainName: chainDetails.find((chain) => chain.chainId == claimDetails[0].chainId)?.name,
        chainIconURI: chainDetails.find((chain) => chain.chainId == claimDetails[0].chainId)?.icon.url,
    })
    const [tokenList, setTokenList] = useState<any[] | undefined>(undefined)
    const [selectedToken, setSelectedToken] = useState<any | undefined>(undefined)

    const [isChainSelectorOpen, setIsChainSelectorOpen] = useState(false)
    const [isTokenSelectorOpen, setIsTokenSelectorOpen] = useState(false)

    const [possibleRoutesArray, setPossibleRoutesArray] = useState<any[]>([])
    const [isRouteLoading, setIsRouteLoading] = useState(false)

    const [listIsLoading, setListIsLoading] = useState(true)
    const [loadingStates, setLoadingStates] = useState<consts.LoadingStates>('idle')
    const isLoading = useMemo(() => loadingStates !== 'idle', [loadingStates])
    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })

    const initializeLoadingStatesUpdating = () => {
        let counter = 0
        const messages = ['preparing transaction', 'executing transaction']

        setLoadingStates('fetching route')
        const intervalId = setInterval(() => {
            if (counter < messages.length) {
                setLoadingStates(messages[counter % messages.length] as consts.LoadingStates)
                counter++
            } else {
                // Once the last message is reached, clear the interval
                clearInterval(intervalId)
            }
        }, 2000)
    }

    const getWalletClientAndUpdateSigner = async ({
        chainId,
    }: {
        chainId: string
    }): Promise<providers.JsonRpcSigner> => {
        const walletClient = await getWalletClient({ chainId: Number(chainId) })
        if (!walletClient) {
            throw new Error('Failed to get wallet client')
        }
        const signer = utils.walletClientToSigner(walletClient)
        return signer
    }

    const checkNetwork = async (chainId: string) => {
        //check if the user is on the correct chain
        if (currentChain?.id.toString() !== chainId.toString()) {
            setLoadingStates('allow network switch')

            await utils.waitForPromise(switchNetwork({ chainId: Number(chainId) })).catch((error) => {
                setErrorState({
                    showError: true,
                    errorMessage: 'Something went wrong while switching networks',
                })
                setLoadingStates('idle')
                throw error
            })
            setLoadingStates('switching network')
            isMobile && (await new Promise((resolve) => setTimeout(resolve, 4000))) // wait a sec after switching chain before making other deeplink
            setLoadingStates('loading')
        }
    }

    const claim = async () => {
        try {
            setErrorState({
                showError: false,
                errorMessage: '',
            })
            if (
                !possibleRoutesArray.find((route) => route.route?.params.toToken == selectedToken.address) &&
                selectedToken
            ) {
                setErrorState({
                    showError: true,
                    errorMessage: 'No route found for the chosen chain and token',
                })
                return
            }

            if (selectedToken) {
                initializeLoadingStatesUpdating()
            } else {
                setLoadingStates('executing transaction')
            }

            let claimTx
            if (!selectedToken) {
                verbose && console.log('claiming non-cross chain')

                if (claimDetails[0].chainId == '1') {
                    await checkNetwork(claimDetails[0].chainId)

                    const signer = await getWalletClientAndUpdateSigner({ chainId: claimDetails[0].chainId })

                    claimTx = await peanut.claimLink({
                        recipient: address,
                        link: claimDetails[0].link,
                        structSigner: {
                            signer,
                        },
                    })
                } else {
                    claimTx = await peanut.claimLinkGasless({
                        link: claimDetails[0].link,
                        recipientAddress: address ?? '',
                        APIKey: process.env.PEANUT_API_KEY ?? '',
                        baseUrl: `${consts.peanut_api_url}/claim-v2`,
                    })
                }
            } else {
                verbose && console.log('claiming cross chain')
                const isTestnet = !Object.keys(peanut.CHAIN_DETAILS)
                    .map((key) => peanut.CHAIN_DETAILS[key as keyof typeof peanut.CHAIN_DETAILS])
                    .find((chain) => chain.chainId == claimDetails[0].chainId.toString())?.mainnet

                if (claimDetails[0].chainId == '1') {
                    await checkNetwork(claimDetails[0].chainId)

                    const signer = await getWalletClientAndUpdateSigner({ chainId: claimDetails[0].chainId })

                    claimTx = await peanut.claimLink({
                        recipient: address,
                        link: claimDetails[0].link,
                        structSigner: {
                            signer,
                        },
                    })
                } else {
                    claimTx = await peanut.claimLinkXChainGasless({
                        link: claimDetails[0].link,
                        recipientAddress: address ?? '',
                        APIKey: process.env.PEANUT_API_KEY ?? '',
                        destinationChainId: selectedChain.chainId,
                        destinationToken: selectedToken.address,
                        isMainnet: !isTestnet,
                        squidRouterUrl: `${consts.peanut_api_url}/get-squid-route`,
                        baseUrl: `${consts.peanut_api_url}/claim-x-chain`,
                    })
                }
            }
            verbose && console.log(claimTx)

            setTxHash([claimTx.txHash])
            if (selectedToken) {
                setCrossChainSuccess({
                    chainName: selectedChain.chainName,
                    tokenName: selectedToken.name,
                    chainId: selectedChain.chainId,
                })
            } else {
                setCrossChainSuccess(undefined)
            }
            onNextScreen()
        } catch (error) {
            setErrorState({
                showError: true,
                errorMessage: 'Something went wrong while claiming.',
            })
            console.error(error)
        } finally {
            setLoadingStates('idle')
        }
    }

    const getSquidRoute = async () => {
        const tokenAmount = Math.floor(
            Number(claimDetails[0].tokenAmount) * Math.pow(10, claimDetails[0].tokenDecimals)
        ).toString()

        try {
            if (
                !possibleRoutesArray.find(
                    (route) =>
                        route.route?.params.toToken === selectedToken?.address &&
                        route.route?.params.toChain === selectedChain?.chainId
                )
            ) {
                const x = await peanut.getSquidRouteRaw({
                    squidRouterUrl: 'https://v2.api.squidrouter.com/v2/route',
                    fromChain: claimDetails[0].chainId.toString(),
                    fromToken: claimDetails[0].tokenAddress,
                    fromAmount: tokenAmount,
                    toChain: selectedChain.chainId.toString(),
                    toToken: selectedToken.address,
                    slippage: 1,
                    fromAddress: address ?? '',
                    toAddress: address ?? '',
                })
                setPossibleRoutesArray([...possibleRoutesArray, { route: x.route }])
                verbose && console.log(x)
            }
        } catch (error: any) {
            if (error.toString().includes('Please increase your input amount')) {
                setErrorState({
                    showError: true,
                    errorMessage: 'This link can not be claimed cross-chain, it does not meet the minimum amount.',
                })
            } else {
                setErrorState({
                    showError: true,
                    errorMessage: 'No route found for the chosen chain and token',
                })
            }

            setIsRouteLoading(false)
        }
    }

    useEffect(() => {
        if (crossChainDetails && listIsLoading) {
            const _chainList = crossChainDetails.map((chain) => {
                return { chainId: chain.chainId, chainName: chain.axelarChainName, chainIconURI: chain.chainIconURI }
            })
            const currentChainName = chainDetails.find((chain) => chain.chainId == claimDetails[0].chainId)?.name
            setSelectedChain({
                chainId: claimDetails[0].chainId,
                chainName: currentChainName,
                chainIconURI: chainDetails.find((chain) => chain.chainId == claimDetails[0].chainId)?.icon.url,
            })
            _chainList.unshift({
                chainId: claimDetails[0].chainId,
                chainName: currentChainName,
                chainIconURI: chainDetails.find((chain) => chain.chainId == claimDetails[0].chainId)?.icon.url,
            })
            setChainList(_chainList)
            setListIsLoading(false)
        }
    }, [crossChainDetails])

    useEffect(() => {
        if (selectedChain) {
            setErrorState({
                showError: false,
                errorMessage: '',
            })
            const _tokenList = crossChainDetails.find((chain) => chain.chainId == selectedChain.chainId)?.tokens
            if (_tokenList) {
                setTokenList(_tokenList)
                setSelectedToken(_tokenList[0])
            } else {
                setTokenList(undefined)
                setSelectedToken(undefined)
            }
        }
    }, [selectedChain])

    useEffect(() => {
        if (selectedToken) {
            setIsRouteLoading(true)
            getSquidRoute()
            setErrorState({
                showError: false,
                errorMessage: '',
            })
        } else {
            setIsRouteLoading(false)
        }
    }, [selectedToken])

    useEffect(() => {
        if (
            possibleRoutesArray.find(
                (route) =>
                    route.route?.params.toToken === selectedToken?.address &&
                    route.route?.params.toChain === selectedChain?.chainId
            )
        ) {
            setIsRouteLoading(false)
        }
    }, [possibleRoutesArray])

    return (
        <>
            <div className={'mt-4 flex w-full flex-col items-center text-center  '}>
                <h2 className=" title-font bold my-0 text-2xl lg:text-5xl">
                    Claim{' '}
                    {tokenPrice
                        ? '$' + utils.formatAmount(Number(tokenPrice) * Number(claimDetails[0].tokenAmount))
                        : utils.formatTokenAmount(Number(claimDetails[0].tokenAmount)) +
                          ' in ' +
                          claimDetails[0].tokenSymbol}
                </h2>
            </div>

            {isRouteLoading ? (
                <h2 className="my-2 mb-4 flex items-center justify-center gap-2 text-center text-base font-medium sm:text-xl">
                    fetching your route{' '}
                    <span className="bouncing-dots flex">
                        <span className="dot">
                            <div className="mr-1 h-1 w-1 bg-black" />
                        </span>
                        <span className="dot">
                            <div className="mr-1 h-1 w-1 bg-black" />
                        </span>
                        <span className="dot">
                            <div className="h-1 w-1 bg-black" />
                        </span>
                    </span>
                </h2>
            ) : (
                possibleRoutesArray.length > 0 &&
                possibleRoutesArray.find(
                    (route) =>
                        route.route?.params.toToken === selectedToken?.address &&
                        route.route?.params.toChain === selectedChain?.chainId
                ) && (
                    <h2 className="my-2 mb-4 text-center text-base font-medium sm:text-xl  ">
                        You will be claiming{' '}
                        {utils.formatTokenAmount(
                            utils.formatAmountWithDecimals({
                                amount: possibleRoutesArray.find(
                                    (route) => route.route.params.toToken === selectedToken.address
                                ).route.estimate.toAmountMin,
                                decimals: possibleRoutesArray.find(
                                    (route) => route.route.params.toToken === selectedToken.address
                                ).route.estimate.toToken.decimals,
                            })
                        )}{' '}
                        {
                            possibleRoutesArray.find((route) => route.route.params.toToken === selectedToken.address)
                                .route.estimate.toToken.name
                        }
                        {/* {utils.formatAmount(
                            utils.formatAmountWithDecimals({
                                amount: possibleRoutesArray.find(
                                    (route) => route.route.params.toToken === selectedToken.address
                                ).route.estimate.toAmountMin,
                                decimals: possibleRoutesArray.find(
                                    (route) => route.route.params.toToken === selectedToken.address
                                ).route.estimate.toToken.decimals,
                            }) /
                                possibleRoutesArray.find(
                                    (route) => route.route.params.toToken === selectedToken.address
                                ).route.estimate.exchangeRate
                        )}{' '}
                        in{' '}
                        {
                            possibleRoutesArray.find((route) => route.route.params.toToken === selectedToken.address)
                                .route.estimate.toToken.name
                        }{' '} */}{' '}
                        on {chainList.find((chain) => chain.chainId == selectedChain.chainId)?.chainName}
                    </h2>
                )
            )}

            <div
                className={
                    'mb-0 mt-8 flex h-full w-full items-center justify-center gap-2 ' +
                    (selectedChain.chainId == claimDetails[0].chainId && ' mb-8')
                }
            >
                <label>on</label>
                <div
                    className={'brutalborder flex cursor-pointer items-center justify-center self-center'}
                    onClick={() => {
                        setIsChainSelectorOpen(!isChainSelectorOpen)
                    }}
                >
                    <h3 className="text-md my-0 ml-3 font-black sm:text-lg lg:text-xl">{selectedChain?.chainName}</h3>
                    <img
                        style={{
                            transform: isChainSelectorOpen ? 'scaleY(-1)' : 'none',
                            transition: 'transform 0.3s ease-in-out',
                        }}
                        src={dropdown_svg.src}
                        className={' h-10 '}
                    />
                </div>
                <label>in</label>{' '}
                <div
                    className={
                        'brutalborder flex items-center justify-center ' +
                        (selectedChain.chainId == claimDetails[0].chainId
                            ? ' cursor-not-allowed opacity-50 '
                            : ' cursor-pointer')
                    }
                    onClick={() => {
                        if (selectedChain.chainId != claimDetails[0].chainId) {
                            setIsTokenSelectorOpen(!isTokenSelectorOpen)
                        }
                    }}
                >
                    <h3 className="text-md my-0 ml-3 font-black sm:text-lg lg:text-xl">
                        {selectedToken ? selectedToken.symbol : claimDetails[0].tokenSymbol}
                    </h3>
                    <img
                        style={{
                            transform: isTokenSelectorOpen ? 'scaleY(-1)' : 'none',
                            transition: 'transform 0.3s ease-in-out',
                        }}
                        src={dropdown_svg.src}
                        className={' h-10 '}
                    />
                </div>
            </div>

            {selectedChain.chainId != claimDetails[0].chainId && (
                <div
                    className="mb-8 mt-1 cursor-pointer font-medium underline"
                    onClick={() => {
                        if (!isLoading) {
                            setSelectedChain({
                                chainId: claimDetails[0].chainId,
                                chainName: chainDetails.find((chain) => chain.chainId == claimDetails[0].chainId)?.name,
                                chainIconURI: chainDetails.find((chain) => chain.chainId == claimDetails[0].chainId)
                                    ?.icon.url,
                            })
                            setSelectedToken(undefined)
                            setIsRouteLoading(false)
                        }
                    }}
                >
                    Reset to origin chain
                </div>
            )}

            <button
                type={isConnected ? 'submit' : 'button'}
                className="mx-auto mb-8 block w-full cursor-pointer bg-white p-5 px-2 text-2xl font-black sm:w-2/5 lg:w-1/2"
                id="cta-btn"
                onClick={() => {
                    !isConnected ? open() : claim()
                }}
                disabled={isLoading || isRouteLoading}
            >
                {isLoading ? (
                    <div className="flex items-center justify-center gap-1">
                        <label>{loadingStates} </label>
                        <span className="bouncing-dots flex">
                            <span className="dot">.</span>
                            <span className="dot">.</span>
                            <span className="dot">.</span>
                        </span>
                    </div>
                ) : isConnected ? (
                    'Claim'
                ) : (
                    'Connect Wallet'
                )}
            </button>
            {errorState.showError && (
                <div className="text-center">
                    <label className="font-bold text-red ">{errorState.errorMessage}</label>
                </div>
            )}

            <global_components.PeanutMan type="presenting" />

            <Transition.Root show={isChainSelectorOpen} as={Fragment}>
                <Dialog
                    as="div"
                    className="relative z-10 "
                    onClose={() => {
                        setIsChainSelectorOpen(false)
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
                                <Dialog.Panel className="brutalborder relative w-full transform  overflow-hidden rounded-lg rounded-none bg-white py-5 text-left text-black shadow-xl transition-all  sm:w-auto sm:min-w-[420px] sm:max-w-[420px] ">
                                    <div className="mb-8 flex items-center justify-center sm:hidden">
                                        <svg width="128" height="6">
                                            <rect width="128" height="6" />
                                        </svg>
                                    </div>
                                    <div className="mb-8 ml-4 mr-4  sm:mb-2">
                                        <div
                                            className={`flex max-h-[none] w-full flex-wrap gap-2 overflow-hidden text-black`}
                                        >
                                            {chainList.map((chain) => (
                                                <div
                                                    key={chain.chainId}
                                                    className={
                                                        'brutalborder flex h-full w-1/5 min-w-max grow cursor-pointer flex-row justify-center gap-2 px-2 py-1 sm:w-[12%] ' +
                                                        (selectedChain?.chainId == chain.chainId
                                                            ? 'bg-black text-white'
                                                            : '')
                                                    }
                                                    onClick={() => {
                                                        setSelectedChain(chain)
                                                        setIsChainSelectorOpen(false)
                                                        console.log(chain.chainIconURI)
                                                    }}
                                                >
                                                    <img
                                                        src={chain.chainIconURI}
                                                        loading="eager"
                                                        className="h-6 cursor-pointer"
                                                    />

                                                    <label className="flex cursor-pointer items-center">
                                                        {chain.chainName.toUpperCase()}
                                                    </label>
                                                    {/* {claimDetails[0].chainId == chain.chainId && <label>ORIGIN</label>} */}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </Dialog.Panel>
                            </Transition.Child>
                        </div>
                    </div>
                </Dialog>
            </Transition.Root>

            <Transition.Root show={isTokenSelectorOpen} as={Fragment}>
                <Dialog
                    as="div"
                    className="relative z-10 "
                    onClose={() => {
                        setIsTokenSelectorOpen(false)
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
                                <Dialog.Panel className="brutalborder relative w-full transform overflow-hidden rounded-lg rounded-none bg-white text-left text-black shadow-xl transition-all  sm:w-auto sm:min-w-[420px] sm:max-w-[420px] ">
                                    <div className="brutalscroll flex max-h-96 flex-col overflow-auto overflow-x-hidden">
                                        {tokenList?.map((token) => (
                                            <div
                                                key={token.address}
                                                className={
                                                    'flex cursor-pointer flex-row justify-between px-2 py-2  ' +
                                                    (selectedToken?.address == token.address
                                                        ? ' bg-black text-white'
                                                        : '')
                                                }
                                                onClick={() => {
                                                    setSelectedToken(token)
                                                    setIsTokenSelectorOpen(false)
                                                }}
                                            >
                                                <div className="flex items-center gap-2 ">
                                                    <img src={token.logoURI} className="h-6" loading="eager" />
                                                    <div>{token.name}</div>
                                                </div>
                                                <div className="flex items-center gap-2">
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
