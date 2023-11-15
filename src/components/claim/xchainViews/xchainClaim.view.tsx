import { useWeb3Modal } from '@web3modal/wagmi/react'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAccount, useNetwork } from 'wagmi'
import { ethers, providers } from 'ethers'
import peanut, { TOKEN_DETAILS } from '@squirrel-labs/peanut-sdk'
import { useForm } from 'react-hook-form'
import { switchNetwork, getWalletClient } from '@wagmi/core'
import { WalletClient } from 'wagmi'
import { isMobile } from 'react-device-detect'

import * as global_components from '@/components/global'
import * as _consts from '../claim.consts'
import * as consts from '@/consts'
import * as utils from '@/utils'
import * as store from '@/store/'
import dropdown_svg from '@/assets/dropdown.svg'
import { useAtom } from 'jotai'
import { Transition, Dialog } from '@headlessui/react'
import axios from 'axios'

export function xchainClaimView({
    onNextScreen,
    claimDetails,
    claimLink,
    setTxHash,
    tokenPrice,
    crossChainDetails,
    setCrossChainSuccess,
}: _consts.IClaimScreenProps) {
    const { isConnected, address } = useAccount()
    const { open } = useWeb3Modal()
    const [isDropdownOpen, setIsDropdownOpen] = useState(false)
    const [chainDetails] = useAtom(store.defaultChainDetailsAtom)
    const [tokenDetails] = useAtom(store.defaultTokenDetailsAtom)
    const [listIsLoading, setListIsLoading] = useState(true)
    const [chainList, setChainList] = useState<{ chainId: number; chainName: string; chainIconURI: string }[]>([])
    const [selectedChain, setSelectedChain] = useState<{ chainId: number; chainName: string; chainIconURI: string }>({
        chainId: claimDetails[0].chainId,
        chainName: chainDetails.find((chain) => chain.chainId == claimDetails[0].chainId)?.name,
        chainIconURI: chainDetails.find((chain) => chain.chainId == claimDetails[0].chainId)?.icon.url,
    })
    const [tokenList, setTokenList] = useState<any[] | undefined>(undefined)
    const verbose = process.env.NODE_ENV === 'development' ? true : false
    const [isChainSelectorOpen, setIsChainSelectorOpen] = useState(false)
    const [isTokenSelectorOpen, setIsTokenSelectorOpen] = useState(false)
    const [selectedToken, setSelectedToken] = useState<any | undefined>(undefined)
    const [possibleRoutesArray, setPossibleRoutesArray] = useState<any[]>([])
    const [isRouteLoading, setIsRouteLoading] = useState(false)
    const { chain: currentChain } = useNetwork()

    const [loadingStates, setLoadingStates] = useState<consts.LoadingStates>('idle')
    const isLoading = useMemo(() => loadingStates !== 'idle', [loadingStates])
    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })

    function walletClientToSigner(walletClient: WalletClient) {
        const { account, chain, transport } = walletClient
        const network = {
            chainId: chain.id,
            name: chain.name,
            ensAddress: chain.contracts?.ensRegistry?.address,
        }
        const provider = new providers.Web3Provider(transport, network)
        const signer = provider.getSigner(account.address)
        return signer
    }

    const getWalletClientAndUpdateSigner = async ({
        chainId,
    }: {
        chainId: number
    }): Promise<providers.JsonRpcSigner> => {
        const walletClient = await getWalletClient({ chainId: Number(chainId) })
        if (!walletClient) {
            throw new Error('Failed to get wallet client')
        }
        const signer = walletClientToSigner(walletClient)
        return signer
    }

    const checkNetwork = async (chainId: number) => {
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
            setLoadingStates('executing transaction')
            await checkNetwork(claimDetails[0].chainId)

            if (!selectedToken) {
                setSelectedToken({
                    chainId: claimDetails[0].chainId,
                    address: claimDetails[0].tokenAddress,
                    name: claimDetails[0].tokenName,
                    symbol: claimDetails[0].tokenSymbol,
                })
            }

            const isTestnet = !Object.keys(peanut.CHAIN_DETAILS)
                .map((key) => peanut.CHAIN_DETAILS[key as keyof typeof peanut.CHAIN_DETAILS])
                .find((chain) => chain.chainId == claimDetails[0].chainId)?.mainnet

            const signer = await getWalletClientAndUpdateSigner({ chainId: claimDetails[0].chainId })
            // const x = await peanut.claimLinkXChain(
            //     {
            //         signer: signer,
            //     },
            //     claimDetails[0].link,
            //     selectedChain.chainId,
            //     selectedToken?.address,
            //     isTestnet,
            //     1,
            //     address ?? ''
            // )
            // setTxHash([x.txHash])
            setCrossChainSuccess({
                chainName: selectedChain.chainName,
                tokenName: selectedToken.name,
            })
            // verbose && console.log(x)
            onNextScreen()
        } catch (error) {
            setErrorState({
                showError: true,
                errorMessage: 'Something went wrong while claiming',
            })
            console.error(error)
        } finally {
            setLoadingStates('idle')
        }
    }

    const getSquidRoute = async () => {
        const isTestnet = !Object.keys(peanut.CHAIN_DETAILS)
            .map((key) => peanut.CHAIN_DETAILS[key as keyof typeof peanut.CHAIN_DETAILS])
            .find((chain) => chain.chainId == claimDetails[0].chainId)?.mainnet
        const tokenDecimals =
            tokenDetails
                .find((chain) => Number(chain.chainId) == claimDetails[0].chainId)
                ?.tokens.find((token) => token.address == claimDetails[0].tokenAddress)?.decimals ?? 6 // TODO: HIGH PRIO: CHANGE TO GETLINKDETAILS TOKEN DECIMALS
        const tokenAmount = Math.floor(Number(claimDetails[0].tokenAmount) * Math.pow(10, tokenDecimals)).toString()

        try {
            // const x = await peanut.getSquidRoute(
            //     isTestnet,
            //     claimDetails[0].chainId.toString(),
            //     claimDetails[0].tokenAddress,
            //     tokenAmount,
            //     selectedChain.chainId.toString(),
            //     selectedToken.address,
            //     address?.toString() ?? '',
            //     address?.toString() ?? '',
            //     1
            // )
            // setPossibleRoutesArray([...possibleRoutesArray, { route: x }])
            // verbose && console.log(x)
        } catch (error) {
            setErrorState({
                showError: true,
                errorMessage: 'No route found for the chosen chain and token',
            })
            setIsRouteLoading(false)
        }
    }

    useEffect(() => {
        if (crossChainDetails && listIsLoading) {
            const _chainList = crossChainDetails.map((chain) => {
                return { chainId: chain.chainId, chainName: chain.chainName, chainIconURI: chain.chainIconURI }
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
                console.log(_tokenList)
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
        }
    }, [selectedToken])

    useEffect(() => {
        if (possibleRoutesArray.find((route) => route.route?.params.toToken.address == selectedToken.address)) {
            setIsRouteLoading(false)
        }
    }, [possibleRoutesArray])

    return (
        <>
            <div className="flex flex-row items-center justify-center  gap-2">
                <h2 className=" my-0 text-center text-3xl font-black lg:text-6xl ">
                    Claim{' '}
                    {tokenPrice
                        ? '$' + utils.formatAmount(Number(tokenPrice) * Number(claimDetails[0].tokenAmount)) + ' in'
                        : utils.formatTokenAmount(Number(claimDetails[0].tokenAmount))}
                </h2>
                {tokenList ? (
                    <div
                        className="brutalborder flex cursor-pointer items-center justify-center"
                        onClick={() => {
                            setIsTokenSelectorOpen(!isTokenSelectorOpen)
                        }}
                    >
                        <h2 className=" mb-0 ml-2 mt-0 text-center text-3xl font-black lg:text-6xl ">
                            {selectedToken ? selectedToken.symbol : claimDetails[0].tokenSymbol}
                        </h2>
                        <img
                            style={{
                                transform: isDropdownOpen ? 'scaleY(-1)' : 'none',
                                transition: 'transform 0.3s ease-in-out',
                            }}
                            src={dropdown_svg.src}
                            className={' h-16 '}
                        />
                    </div>
                ) : (
                    <h2 className=" mb-0 mt-0 text-center text-3xl font-black lg:text-6xl ">
                        {selectedToken ? selectedToken.symbol : claimDetails[0].tokenSymbol}
                    </h2>
                )}
            </div>

            {isRouteLoading ? (
                <h2 className="my-2 mb-4 flex gap-2 text-center text-base font-black sm:text-xl ">
                    fetching your route{' '}
                    <span className="bouncing-dots">
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
                possibleRoutesArray.find((route) => route.route?.params.toToken.address === selectedToken.address) && (
                    <h2 className="my-2 mb-4 text-center text-base font-black sm:text-xl  ">
                        You will be claiming $
                        {
                            possibleRoutesArray.find(
                                (route) => route.route.params.toToken.address === selectedToken.address
                            ).route.estimate.toAmountUSD
                        }{' '}
                        in{' '}
                        {
                            possibleRoutesArray.find(
                                (route) => route.route.params.toToken.address === selectedToken.address
                            ).route.params.toToken.name
                        }{' '}
                        on {chainList.find((chain) => chain.chainId == selectedChain.chainId)?.chainName}
                    </h2>
                )
            )}

            <div
                className="brutalborder mb-8 mt-8 flex cursor-pointer items-center justify-center"
                onClick={() => {
                    setIsChainSelectorOpen(!isChainSelectorOpen)
                }}
            >
                <h3 className="text-md my-0 ml-3 font-black sm:text-lg lg:text-xl">{selectedChain?.chainName}</h3>
                <img
                    style={{
                        transform: isDropdownOpen ? 'scaleY(-1)' : 'none',
                        transition: 'transform 0.3s ease-in-out',
                    }}
                    src={dropdown_svg.src}
                    className={' h-10 '}
                />
            </div>

            <button
                type={isConnected ? 'submit' : 'button'}
                className="mx-auto mb-6 block w-full cursor-pointer bg-white p-5 px-2 text-2xl font-black sm:w-2/5 lg:w-1/2"
                id="cta-btn"
                onClick={() => {
                    !isConnected ? open() : claim()
                }}
                disabled={isLoading || isRouteLoading}
            >
                {isLoading ? (
                    <div className="flex justify-center gap-1">
                        <label>{loadingStates} </label>
                        <span className="bouncing-dots">
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
