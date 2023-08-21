import { useEffect, useState, useCallback, useMemo, Fragment } from 'react'
import { useWeb3Modal } from '@web3modal/react'
import { useAtom } from 'jotai'
import { useAccount, useNetwork } from 'wagmi'
import { switchNetwork, getWalletClient } from '@wagmi/core'
import { providers } from 'ethers'
import { useForm } from 'react-hook-form'
import peanutman_logo from '@/assets/peanutman-logo.svg'
const peanut = require('@squirrel-labs/peanut-sdk')
import { Dialog, Transition } from '@headlessui/react'
import axios from 'axios'

import * as store from '@/store'
import * as consts from '@/consts'
import * as _consts from '../send.consts'
import * as utils from '@/utils'
import * as _utils from '../send.utils'
import * as hooks from '@/hooks'
import * as global_components from '@/components/global'
import switch_svg from '@/assets/switch.svg'

export function SendInitialView({ onNextScreen, setClaimLink, setTxReceipt, setChainId }: _consts.ISendScreenProps) {
    //hooks
    const { open } = useWeb3Modal()
    const { isConnected, address, isDisconnected } = useAccount()
    const { chain: currentChain } = useNetwork()

    //local states
    const [signer, setSigner] = useState<providers.JsonRpcSigner | undefined>(undefined)
    const [tokenList, setTokenList] = useState<_consts.ITokenListItem[]>([])
    const [formHasBeenTouched, setFormHasBeenTouched] = useState(false)
    const [prevChainId, setPrevChainId] = useState<number | undefined>(undefined)
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

    //global states
    const [userBalances] = useAtom(store.userBalancesAtom)
    const [chainDetails] = useAtom(store.defaultChainDetailsAtom)
    const [supportedChainsSocketTech] = useAtom(store.supportedChainsSocketTechAtom)
    const [tokenDetails] = useAtom(store.defaultTokenDetailsAtom)

    //memo
    const isLoading = useMemo(() => loadingStates !== 'idle', [loadingStates])
    hooks.useConfirmRefresh(enableConfirmation)

    //form and modalform states
    const sendForm = useForm<_consts.ISendFormData>({
        mode: 'onChange',
        defaultValues: {
            chainId: 1,
            amount: 0,
            token: '',
        },
    })
    const formwatch = sendForm.watch()
    const [modalState, setModalState] = useState<{
        chainId: number
        token: string
    }>({
        chainId: formwatch.chainId,
        token: formwatch.token,
    })

    const getWalletClientAndUpdateSigner = async ({ chainId }: { chainId: number }) => {
        const walletClient = await getWalletClient({ chainId: Number(chainId) })
        if (walletClient) {
            const signer = _utils.walletClientToSigner(walletClient)
            setSigner(signer)
        }
    }

    const fetchTokenPrice = async (tokenAddress: string, chainId: number) => {
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
        } catch (error) {
            console.log('error fetching token price for token ' + tokenAddress)
            setTokenPrice(undefined)
            setInputDenomination('TOKEN')
        }
    }

    const checkForm = (sendFormData: _consts.ISendFormData) => {
        //check that the token and chainid are defined
        if (sendFormData.chainId == null || sendFormData.token == '') {
            setErrorState({
                showError: true,
                errorMessage: 'Please select a chain and token',
            })
            return { succes: 'false' }
        }

        //check if the amount is less than or equal to zero
        if (sendFormData.amount <= 0) {
            setErrorState({
                showError: true,
                errorMessage: 'Please put an amount that is greater than zero',
            })
            return { succes: 'false' }
        }

        //check if the token is in the userBalances
        if (
            userBalances.some(
                (balance) => balance.symbol == sendFormData.token && balance.chainId == sendFormData.chainId
            )
        ) {
            //check that the user has enough funds
            const balance = userBalances.find((balance) => balance.symbol === sendFormData.token)?.amount
            if (balance && sendFormData.amount > balance) {
                setErrorState({
                    showError: true,
                    errorMessage: "You don't have enough funds",
                })

                return { succes: 'false' }
            }

            if (!signer) {
                getWalletClientAndUpdateSigner({ chainId: sendFormData.chainId })
                setErrorState({
                    showError: true,
                    errorMessage: 'Signer undefined, please refresh',
                })

                return { succes: 'false' }
            }
        }
        return { succes: 'true' }
    }

    const createLink = useCallback(
        async (sendFormData: _consts.ISendFormData) => {
            if (isLoading) return
            try {
                setLoadingStates('checking inputs...')

                if (checkForm(sendFormData).succes === 'false') {
                    return
                }
                setEnableConfirmation(true)

                const { tokenAddress, tokenDecimals, tokenType } = _utils.getTokenDetails(
                    sendFormData,
                    userBalances,
                    tokenDetails,
                    chainDetails
                )

                console.log(
                    'sending ' +
                        sendFormData.amount +
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

                setLoadingStates('allow network switch...')
                //check if the user is on the correct chain
                if (currentChain?.id.toString() !== sendFormData.chainId.toString()) {
                    await utils
                        .waitForPromise(switchNetwork({ chainId: Number(sendFormData.chainId) }))
                        .catch((error) => {
                            setErrorState({
                                showError: true,
                                errorMessage: 'Something went wrong while switching networks',
                            })
                            return
                        })
                    setLoadingStates('switching network...')
                    await new Promise((resolve) => setTimeout(resolve, 4000)) // wait a sec after switching chain before making other deeplink
                    setLoadingStates('loading...')
                }

                //when the user tries to refresh, show an alert
                setEnableConfirmation(true)
                setLoadingStates('executing transaction...')

                const { link, txReceipt } = await peanut.createLink({
                    signer: signer,
                    chainId: sendFormData.chainId,
                    tokenAddress: tokenAddress ?? null,
                    tokenAmount: Number(sendFormData.amount),
                    tokenType: tokenType,
                    tokenDecimals: tokenDecimals,
                    verbose: true,
                })
                console.log('Created link:', link)
                utils.saveToLocalStorage(address + ' - ' + txReceipt.hash, link)

                setClaimLink(link)
                setTxReceipt(txReceipt)
                setChainId(sendFormData.chainId)

                onNextScreen()
            } catch (error: any) {
                if (error.toString().includes('insufficient funds')) {
                    setErrorState({
                        showError: true,
                        errorMessage: "You don't have enough funds",
                    })
                } else {
                    setErrorState({
                        showError: true,
                        errorMessage: 'Something failed while creating your link. Please try again',
                    })
                    console.error(error)
                }
            } finally {
                setLoadingStates('idle')
                setEnableConfirmation(false)
            }
        },
        [signer, currentChain, userBalances, onNextScreen, isLoading, address]
    )

    //update the tokenlist when the user changes the chain or when the userBalances change
    useEffect(() => {
        if (isConnected) {
            userBalances.some((balance) => balance.chainId == formwatch.chainId)
                ? setTokenList(
                      userBalances
                          .filter((balance) => balance.chainId == formwatch.chainId)
                          .map((balance) => {
                              return {
                                  symbol: balance.symbol,
                                  chainId: balance.chainId,
                                  amount: balance.amount,
                                  address: balance.address,
                                  decimals: balance.decimals,
                                  logo: balance.logoURI,
                              }
                          })
                  )
                : setTokenList([])
        }
    }, [formwatch.chainId, userBalances, supportedChainsSocketTech, isConnected])

    // useEffect(() => {
    //     if (!isConnected) {
    //         console.log('hierzo')

    //         chainDetails.map((chain) => {
    //             console.log({
    //                 symbol: chain.nativeCurrency.symbol,
    //                 chainId: chain.chainId,
    //                 amount: 0,
    //                 address: '',
    //                 decimals: 18,
    //                 logo: '',
    //             })
    //             setTokenList((prev) => [
    //                 ...prev,
    //                 {
    //                     symbol: chain.nativeCurrency.symbol,
    //                     chainId: chain.chainId,
    //                     amount: 0,
    //                     address: '',
    //                     decimals: 18,
    //                     logo: '',
    //                 },
    //             ])
    //         })
    //     }
    // }, [isConnected])

    //update the chain to the current chain when the user changes the chain
    //TODO: add formhasbeenTouched functionality
    useEffect(() => {
        if (currentChain && !formHasBeenTouched) {
            sendForm.setValue('chainId', currentChain.id)
        }
    }, [currentChain])

    //update the token to the first available token when the user changes the chain
    useEffect(() => {
        if (tokenList && !isTokenSelectorOpen) {
            sendForm.setValue('token', tokenList.find((token) => token.chainId == formwatch.chainId)?.symbol ?? '')
        }
    }, [tokenList])

    //update the signer when the user changes the chain
    useEffect(() => {
        if (formwatch.chainId != prevChainId) {
            setPrevChainId(formwatch.chainId)
            setTimeout(() => {
                getWalletClientAndUpdateSigner({ chainId: formwatch.chainId })
            }, 2000)
        }
    }, [formwatch.chainId, isConnected])

    //when the chain has changed in the modal, set the tokenlist to the tokens of the chain and set the token to the first token of the chain
    useEffect(() => {
        setModalState({
            chainId: modalState.chainId,
            token: userBalances.find((token) => token.chainId == modalState.chainId)?.symbol ?? '',
        })
        if (isConnected) {
            userBalances.some((balance) => balance.chainId == modalState.chainId)
                ? setTokenList(
                      userBalances
                          .filter((balance) => balance.chainId == modalState.chainId)
                          .map((balance) => {
                              return {
                                  symbol: balance.symbol,
                                  chainId: balance.chainId,
                                  amount: balance.amount,
                                  address: balance.address,
                                  decimals: balance.decimals,
                                  logo: balance.logoURI,
                              }
                          })
                  )
                : setTokenList([])
        }
    }, [modalState.chainId])

    //when the token has changed in the modal, fetch the tokenprice and display it
    useEffect(() => {
        if (modalState.token && modalState.chainId) {
            const tokenAddress = tokenList.find((token) => token.symbol == modalState.token)?.address ?? ''
            fetchTokenPrice(tokenAddress, modalState.chainId)
            // const tokenAmount = formwatch.amount * tokenPrice.;
        }
    }, [modalState.token])

    useEffect(() => {
        if (formwatch.token) {
            setModalState({
                chainId: modalState.chainId,
                token: formwatch.token,
            })
        }
    }, [formwatch.token])

    return (
        <>
            <div className="mb-3 mt-6 flex w-full  flex-col gap-5 text-center sm:mb-6 ">
                <h2 className="title-font bold m-0 text-2xl lg:text-4xl">
                    Send crypto with a link
                    <span className="ml-2 text-lg font-bold text-teal lg:text-2xl">BETA</span>
                </h2>
            </div>
            <form className="w-full" onSubmit={sendForm.handleSubmit(createLink)}>
                <div className="flex w-full flex-col items-center gap-0 sm:gap-5">
                    <div className="hidden flex-row items-center justify-center gap-6 p-4 sm:flex sm:w-3/4">
                        <div className="flex flex-col justify-end gap-0 pt-2 ">
                            <div className="flex h-16 items-center">
                                {inputDenomination == 'USD' && <label className={'font-bold ' + textFontSize}>$</label>}
                                <div className="w-full max-w-[160px] ">
                                    <input
                                        className={
                                            'no-spin block w-full appearance-none border-none font-black tracking-wide outline-none placeholder:font-black placeholder:text-black ' +
                                            textFontSize
                                        }
                                        placeholder="0.00"
                                        {...sendForm.register('amount', {
                                            required: true,
                                            onChange: (e) => {
                                                setTextFontSize(_utils.textHandler(e.target.value))
                                                sendForm.setValue('amount', e.target.value)
                                            },
                                        })}
                                        type="number"
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
                                            className="h-4 cursor-pointer"
                                        />
                                        <label className="ml-4 w-max pr-2 text-sm font-bold">
                                            {tokenPrice && formwatch.amount && formwatch.amount > 0
                                                ? inputDenomination == 'USD'
                                                    ? utils.formatTokenAmount(formwatch.amount / tokenPrice) +
                                                      ' ' +
                                                      formwatch.token
                                                    : '$ ' + utils.formatTokenAmount(formwatch.amount * tokenPrice)
                                                : '0.00 ...'}
                                        </label>
                                    </div>
                                ) : (
                                    <div className="h-5"></div>
                                )}
                            </div>
                        </div>
                        <div
                            className="flex h-max w-[136px] cursor-pointer flex-col gap-2 border-4 border-solid !px-8 !py-1"
                            id="cta-div"
                            onClick={() => setIsTokenSelectorOpen(true)}
                        >
                            <label className="overflow-hidden overflow-ellipsis whitespace-nowrap break-all text-sm font-bold">
                                {' '}
                                {chainDetails.find((chain) => chain.chainId == formwatch.chainId)?.name}
                            </label>{' '}
                            <label className="overflow-hidden overflow-ellipsis whitespace-nowrap break-all text-xl font-bold">
                                {' '}
                                {formwatch.token}
                            </label>
                        </div>
                    </div>
                    <div className="flex w-full flex-col items-center justify-center gap-6 p-4 sm:hidden ">
                        <div
                            className=" w-124 flex flex h-max flex-col gap-2 border-4 border-solid !px-8 !py-1"
                            id="cta-div"
                            onClick={() => setIsTokenSelectorOpen(true)}
                        >
                            <label className="self-center overflow-hidden overflow-ellipsis whitespace-nowrap break-all text-sm font-bold">
                                {chainDetails.find((chain) => chain.chainId == formwatch.chainId)?.name}
                            </label>{' '}
                            <label className="self-center overflow-hidden overflow-ellipsis whitespace-nowrap break-all text-xl font-bold">
                                {formwatch.token}
                            </label>
                        </div>
                        <div className="flex flex-col justify-end gap-0 pt-2">
                            <div className="flex max-w-[280px] items-center self-end rounded border border-gray-400 px-2 ">
                                <span className={'font-bold ' + textFontSize}>$</span>
                                <input
                                    autoFocus
                                    type="number"
                                    className={
                                        'no-spin block w-full appearance-none border-none font-black tracking-wide outline-none placeholder:font-black placeholder:text-black ' +
                                        textFontSize
                                    }
                                    placeholder="0.00"
                                    onChange={(e) => {
                                        setTextFontSize(_utils.textHandler(e.target.value))
                                    }}
                                />
                            </div>

                            <label className="ml-4 w-max pr-2 text-sm font-bold">{tokenPrice && tokenPrice}</label>
                        </div>
                    </div>

                    <div
                        className={
                            errorState.showError
                                ? 'mx-auto my-8 mb-0 flex w-full flex-col items-center gap-10 '
                                : 'mx-auto my-8 mb-14 flex w-full flex-col items-center '
                        }
                    >
                        <button
                            type={isConnected ? 'submit' : 'button'}
                            className="block w-full cursor-pointer bg-white p-5 px-2  text-2xl font-black sm:w-2/5 lg:w-1/2"
                            id="cta-btn"
                            onClick={!isConnected ? open : undefined}
                            disabled={isLoading ? true : false}
                        >
                            {isLoading ? loadingStates : isConnected ? 'Send' : 'Connect Wallet'}
                        </button>
                        {errorState.showError && (
                            <div className="text-center">
                                <label className="font-bold text-red ">{errorState.errorMessage}</label>
                            </div>
                        )}
                    </div>
                </div>
            </form>

            <global_components.PeanutMan type="presenting" />
            <Transition.Root show={isTokenSelectorOpen} as={Fragment}>
                <Dialog
                    as="div"
                    className="relative z-10"
                    onClose={() => {
                        sendForm.setValue('token', modalState.token)
                        sendForm.setValue('chainId', modalState.chainId)
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
                        <div className="flex min-h-full items-end justify-center text-center sm:items-center ">
                            <Transition.Child
                                as={Fragment}
                                enter="ease-out duration-300"
                                enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                                enterTo="opacity-100 translate-y-0 sm:scale-100"
                                leave="ease-in duration-200"
                                leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                                leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                            >
                                <Dialog.Panel className="brutalborder relative min-h-[240px] transform overflow-hidden rounded-lg rounded-none bg-white pb-4 pt-5 text-left text-black shadow-xl transition-all	sm:my-8 sm:w-full sm:max-w-sm">
                                    <div className="mb-8 flex items-center justify-center">
                                        <svg width="128" height="6">
                                            <rect width="128" height="6" />
                                        </svg>
                                    </div>
                                    <div className="mb-8 ml-4 mr-4 sm:mb-2">
                                        <div className="flex w-full flex-wrap gap-2 text-black   ">
                                            {isConnected
                                                ? chainDetails.map(
                                                      (chain) =>
                                                          chain.chainId ==
                                                              userBalances.find(
                                                                  (balance) => balance.chainId == chain.chainId
                                                              )?.chainId && (
                                                              <div
                                                                  key={chain.chainId}
                                                                  className={
                                                                      'align-center brutalborder flex w-max cursor-pointer flex-row gap-2 px-2 py-1 ' +
                                                                      (modalState.chainId == chain.chainId
                                                                          ? 'bg-black text-white'
                                                                          : '')
                                                                  }
                                                                  onClick={() => {
                                                                      setModalState({
                                                                          chainId: chain.chainId,
                                                                          token: modalState.token,
                                                                      })
                                                                  }}
                                                              >
                                                                  <img src={peanutman_logo.src} className="h-6" />
                                                                  <label>{chain.shortName}</label>
                                                              </div>
                                                          )
                                                  )
                                                : chainDetails.map((chain) => (
                                                      <div
                                                          key={chain.chainId}
                                                          className={
                                                              'align-center brutalborder flex w-max cursor-pointer flex-row gap-2 px-2 py-1 ' +
                                                              (modalState.chainId == chain.chainId
                                                                  ? 'bg-black text-white'
                                                                  : '')
                                                          }
                                                          onClick={() => {
                                                              setModalState({
                                                                  chainId: chain.chainId,
                                                                  token: modalState.token,
                                                              })
                                                          }}
                                                      >
                                                          <img src={peanutman_logo.src} className="h-6" />
                                                          <label>{chain.shortName}</label>
                                                      </div>
                                                  ))}
                                        </div>
                                    </div>

                                    <div className="mb-8 ml-4 mr-4 sm:mb-4">
                                        <input
                                            placeholder="Search"
                                            className="brutalborder w-full px-1 py-2 text-lg focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal"
                                        />
                                    </div>

                                    <div className="min-h-32 mb-8 flex max-h-64 flex-col overflow-scroll  sm:mt-2 ">
                                        {tokenList.map((token) => (
                                            <div
                                                key={token.symbol}
                                                className={
                                                    'flex cursor-pointer flex-row justify-between px-2 py-2  ' +
                                                    (modalState.token == token.symbol ? ' bg-black text-white' : '')
                                                }
                                                onClick={() => {
                                                    setModalState({
                                                        chainId: modalState.chainId,
                                                        token: token.symbol,
                                                    })
                                                }}
                                            >
                                                <div className="flex items-center gap-2 ">
                                                    <img src={token.logo} className="h-6" alt="..." loading="eager" />
                                                    <div>{token.symbol}</div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div>{utils.formatTokenAmount(token.amount)}</div>{' '}
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
