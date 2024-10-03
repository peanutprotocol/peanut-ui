'use client'

import TokenAmountInput from '@/components/Global/TokenAmountInput'
import TokenSelector from '@/components/Global/TokenSelector/TokenSelector'
import { useAccount } from 'wagmi'
import { useWeb3Modal } from '@web3modal/wagmi/react'
import { useState, useContext, useEffect, useMemo } from 'react'
import * as _consts from '../Cashout.consts'
import * as context from '@/context'
import Loading from '@/components/Global/Loading'
import { useBalance } from '@/hooks/useBalance'
import { useAuth } from '@/context/authContext'
import { useCreateLink } from '@/components/Create/useCreateLink'
import { Icon as ChakraIcon } from '@chakra-ui/react'
import * as assets from '@/assets'
import * as utils from '@/utils'
import { FAQComponent } from './Faq.comp'
import { RecipientInfoComponent } from './RecipientInfo.comp'
import { motion, AnimatePresence } from 'framer-motion'
import Icon from '@/components/Global/Icon'
import { twMerge } from 'tailwind-merge'

export const InitialCashoutView = ({
    onNext,
    tokenValue,
    usdValue,
    setUsdValue,
    setTokenValue,
    setRecipient,
    recipient,
    setPreparedCreateLinkWrapperResponse,
    setInitialKYCStep,
    setOfframpForm,
    crossChainDetails,
}: _consts.ICashoutScreenProps) => {
    const { selectedTokenPrice, inputDenomination, selectedChainID } = useContext(context.tokenSelectorContext)

    const cannotCashoutOnSelectedChain =
        !Boolean(crossChainDetails.find((chain: any) => chain.chainId.toString() === selectedChainID.toString())) ||
        selectedChainID === '1'

    const { balances, hasFetchedBalances } = useBalance()
    const { user, fetchUser, isFetchingUser } = useAuth()
    const [, setUserType] = useState<'NEW' | 'EXISTING' | undefined>(undefined)

    const xchainAllowed = useMemo((): boolean => {
        /**
         * Checks to validate if the chain we want to cash out from allows cross-chain operations.
         *
         * This is necessary because the current flow for offramping is:
         * (any token, any chain) -> (usdc, optimism) with Squid's router in between.
         * There may be chains that are not supported to conduct that cross-chain operation (e.g., due to gas costs,
         * business strategy, etc.), so we'd like to block user action in that case.
         */
        return (
            crossChainDetails.find((chain: any) => chain.chainId.toString() === selectedChainID.toString()) != undefined
        )
    }, [selectedChainID])

    const { setLoadingState, loadingState, isLoading } = useContext(context.loadingStateContext)
    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })
    const [_tokenValue, _setTokenValue] = useState<string | undefined>(
        inputDenomination === 'TOKEN' ? tokenValue : usdValue
    )

    const { prepareCreateLinkWrapper } = useCreateLink()

    const { isConnected } = useAccount()
    const { open } = useWeb3Modal()

    const handleConnectWallet = async () => {
        open()
    }

    const [selectedBankAccount, setSelectedBankAccount] = useState<string | undefined>(undefined)
    const [newBankAccount, setNewBankAccount] = useState<string>('')
    const [activeInput, setActiveInput] = useState<'newBankAccount' | 'selectedBankAccount'>()

    const MIN_CASHOUT_LIMIT = 10 // $10 minimum
    const MAX_CASHOUT_LIMIT = 101000 // $101,000 maximum

    const isBelowMinLimit = useMemo(() => {
        return usdValue && parseFloat(usdValue) < MIN_CASHOUT_LIMIT
    }, [usdValue])

    const isExceedingMaxLimit = useMemo(() => {
        return usdValue && parseFloat(usdValue) > MAX_CASHOUT_LIMIT
    }, [usdValue])

    const handleOnNext = async (_inputValue?: string) => {
        setLoadingState('Loading')
        setErrorState({ showError: false, errorMessage: '' })
        try {
            if (!selectedBankAccount && !newBankAccount) {
                setErrorState({ showError: true, errorMessage: 'Please select a bank account.' })
                setLoadingState('Idle')
                return
            }
            if (!_tokenValue) return

            const recipientBankAccount = selectedBankAccount || newBankAccount

            const validAccount = await utils.validateBankAccount(recipientBankAccount)
            if (!validAccount) {
                console.error('Invalid bank account')
                setErrorState({
                    showError: true,
                    errorMessage: 'Invalid bank account. Please make sure your account is supported',
                })
                return
            }

            if (!user) {
                await fetchUser()
            }

            const preparedCreateLinkWrapperResponse = await prepareCreateLinkWrapper({
                tokenValue: tokenValue ?? '',
            })
            setPreparedCreateLinkWrapperResponse(preparedCreateLinkWrapperResponse)

            if (!user) {
                const userIdResponse = await fetch('/api/peanut/user/get-user-id', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        accountIdentifier: recipientBankAccount,
                    }),
                })

                if (userIdResponse.status === 404) {
                    setUserType('NEW')
                } else {
                    const response = await userIdResponse.json()
                    if (response.isNewUser) {
                        setUserType('NEW')
                    } else {
                        setUserType('EXISTING')
                    }
                }

                setOfframpForm({
                    name: '',
                    email: '',
                    password: '',
                    recipient: recipientBankAccount,
                })
                setInitialKYCStep(0)
            } else {
                setOfframpForm({
                    email: user?.user?.email ?? '',
                    name: user?.user?.full_name ?? '',
                    recipient: recipientBankAccount,
                    password: '',
                })
                if (user?.user.kycStatus == 'verified') {
                    const account = user.accounts.find(
                        (account: any) =>
                            account.account_identifier.toLowerCase() ===
                            recipientBankAccount.replaceAll(' ', '').toLowerCase()
                    )

                    if (account) {
                        onNext()
                        setInitialKYCStep(4)
                    } else {
                        setInitialKYCStep(3)
                    }
                } else {
                    if (!user?.user.email || !user?.user.full_name) {
                        setInitialKYCStep(0)
                    } else {
                        setInitialKYCStep(1)
                    }
                }
            }
            onNext()
        } catch (error) {
            console.error('Error:', error)
            setErrorState({ showError: true, errorMessage: 'An error occurred. Please try again.' })
        } finally {
            setLoadingState('Idle')
        }
    }

    const [showNewBankAccount, setShowNewBankAccount] = useState(true)

    useEffect(() => {
        setShowNewBankAccount(!selectedBankAccount)
    }, [selectedBankAccount])

    useEffect(() => {
        if (activeInput === 'newBankAccount') {
            setSelectedBankAccount(undefined)
        } else if (activeInput === 'selectedBankAccount') {
            setNewBankAccount('')
        }
    }, [newBankAccount, selectedBankAccount])

    useEffect(() => {
        if (!_tokenValue) return
        if (inputDenomination === 'TOKEN') {
            setTokenValue(_tokenValue)
            if (selectedTokenPrice) {
                setUsdValue((parseFloat(_tokenValue) * selectedTokenPrice).toString())
            }
        } else if (inputDenomination === 'USD') {
            setUsdValue(_tokenValue)
            if (selectedTokenPrice) {
                setTokenValue((parseFloat(_tokenValue) / selectedTokenPrice).toString())
            }
        }
    }, [_tokenValue, inputDenomination])

    return (
        <div className="mx-auto flex max-w-[96%] flex-col items-center justify-center gap-4 text-center">
            <label className="text-h2">Cash Out</label>
            <div className="flex flex-col justify-center gap-3">
                <label className="text-start text-h8 font-light">
                    Convert your crypto to FIAT. From any token, any chain, directly to your bank account.
                </label>
                <FAQComponent />
            </div>
            <div className="flex w-full flex-col items-center justify-center gap-3">
                <TokenAmountInput
                    className="w-full max-w-[100%]"
                    tokenValue={_tokenValue}
                    setTokenValue={_setTokenValue}
                    onSubmit={() => {
                        if (!isConnected) handleConnectWallet()
                        else handleOnNext()
                    }}
                />
                <TokenSelector classNameButton="max-w-[100%]" />
                {hasFetchedBalances && balances.length === 0 && (
                    <div
                        onClick={() => {
                            open()
                        }}
                        className="cursor-pointer text-h9 underline"
                    >
                        ( Buy Tokens )
                    </div>
                )}
                <div className="flex w-full flex-col justify-center gap-3">
                    <RecipientInfoComponent />
                    <div className="space-y-4">
                        {!user && isFetchingUser ? (
                            <div className="relative flex h-16 w-full items-center justify-center">
                                <div className="animate-spin">
                                    <img src={assets.PEANUTMAN_LOGO.src} alt="logo" className="h-6 sm:h-10" />
                                    <span className="sr-only">Loading...</span>
                                </div>
                            </div>
                        ) : user ? (
                            <>
                                {user.accounts.length > 0 && (
                                    <div className="flex w-full flex-col items-start justify-center gap-2">
                                        <label className="text-left text-h8 font-light">
                                            Your linked bank accounts:
                                        </label>
                                        {user.accounts
                                            .filter(
                                                (account) =>
                                                    account.account_type === 'iban' || account.account_type === 'us'
                                            )
                                            ?.map((account, index) => (
                                                <div
                                                    key={index}
                                                    className={twMerge(
                                                        'flex w-full cursor-pointer items-center justify-between border border-black p-2',
                                                        selectedBankAccount === account.account_identifier
                                                            ? 'bg-purple-1'
                                                            : 'hover:bg-gray-100',
                                                        cannotCashoutOnSelectedChain && 'opacity-60'
                                                    )}
                                                    onClick={() => {
                                                        if (cannotCashoutOnSelectedChain) return
                                                        if (selectedBankAccount === account.account_identifier) {
                                                            setSelectedBankAccount(undefined)
                                                        } else {
                                                            setSelectedBankAccount(account.account_identifier)
                                                            setActiveInput('selectedBankAccount')
                                                        }
                                                    }}
                                                >
                                                    <div className="flex flex-grow items-center">
                                                        <Icon name={'bank'} className="mr-2 h-4 fill-gray-1" />
                                                        <label htmlFor={`bank-${index}`} className="text-right">
                                                            {utils.formatIban(account.account_identifier)}
                                                        </label>
                                                    </div>
                                                    <div className="flex w-6 justify-center">
                                                        {selectedBankAccount === account.account_identifier && (
                                                            <button
                                                                className="text-lg text-black"
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    setSelectedBankAccount(undefined)
                                                                }}
                                                            >
                                                                ✕
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                )}
                                <AnimatePresence>
                                    {showNewBankAccount && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            transition={{ duration: 0.3 }}
                                            className="flex w-full flex-col items-start justify-center gap-2 overflow-hidden"
                                        >
                                            <label className="text-left text-h8 font-light">
                                                Cashout to a new bank account:
                                            </label>
                                            <div
                                                className={twMerge(
                                                    'flex w-full cursor-pointer border border-black p-2',
                                                    cannotCashoutOnSelectedChain && 'opacity-60'
                                                )}
                                            >
                                                <label className="ml-2 text-right">To:</label>
                                                <input
                                                    type="text"
                                                    className={twMerge(
                                                        cannotCashoutOnSelectedChain && 'bg-transparent',
                                                        'ml-2 w-full border-none outline-none'
                                                    )}
                                                    placeholder="IBAN / US account number"
                                                    value={newBankAccount}
                                                    onChange={(e) => setNewBankAccount(e.target.value)}
                                                    onFocus={() => setActiveInput('newBankAccount')}
                                                    spellCheck="false"
                                                    autoComplete="iban"
                                                    disabled={cannotCashoutOnSelectedChain}
                                                />
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </>
                        ) : (
                            <div className="flex w-full flex-col items-start justify-center gap-2">
                                <label className="text-left text-h8 font-light">Cashout to a new bank account:</label>
                                <div
                                    className={twMerge(
                                        'flex w-full cursor-pointer border border-black p-2',
                                        cannotCashoutOnSelectedChain && 'cursor-not-allowed opacity-60'
                                    )}
                                >
                                    <label className="ml-2 text-right">To:</label>
                                    <input
                                        type="text"
                                        className={twMerge(
                                            cannotCashoutOnSelectedChain && 'cursor-not-allowed bg-transparent',
                                            'ml-2 w-full border-none outline-none'
                                        )}
                                        placeholder="IBAN / US account number"
                                        value={newBankAccount}
                                        onChange={(e) => setNewBankAccount(e.target.value)}
                                        onFocus={() => setActiveInput('newBankAccount')}
                                        spellCheck="false"
                                        autoComplete="iban"
                                        disabled={cannotCashoutOnSelectedChain}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <button
                className="wc-disable-mf btn-purple btn-xl w-full max-w-[100%]"
                onClick={() => {
                    if (!isConnected) handleConnectWallet()
                    else handleOnNext()
                }}
                disabled={
                    !_tokenValue ||
                    (!selectedBankAccount && !newBankAccount) ||
                    !xchainAllowed ||
                    !!isBelowMinLimit ||
                    !!isExceedingMaxLimit ||
                    cannotCashoutOnSelectedChain
                }
            >
                {!isConnected ? (
                    'Create or Connect Wallet'
                ) : isLoading ? (
                    <div className="flex w-full flex-row items-center justify-center gap-2">
                        <Loading /> {loadingState}
                    </div>
                ) : (
                    'Proceed'
                )}
            </button>
            {errorState.showError && (
                <div className="text-center">
                    <label className=" text-h8 font-normal text-red ">{errorState.errorMessage}</label>
                </div>
            )}
            {isBelowMinLimit && (
                <span className=" text-h8 font-normal ">
                    <ChakraIcon name="warning" className="-mt-0.5" /> Minimum cashout amount is ${MIN_CASHOUT_LIMIT}.
                </span>
            )}
            {isExceedingMaxLimit && (
                <span className=" text-h8 font-normal ">
                    <ChakraIcon name="warning" className="-mt-0.5" /> Maximum cashout amount is $
                    {MAX_CASHOUT_LIMIT.toLocaleString()}.
                </span>
            )}
            {cannotCashoutOnSelectedChain && (
                <span className=" text-h8 font-normal ">
                    <ChakraIcon name="warning" className="-mt-0.5" /> You cannot cashout on this chain.
                </span>
            )}
        </div>
    )
}
