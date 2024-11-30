'use client'

import TokenAmountInput from '@/components/Global/TokenAmountInput'
import TokenSelector from '@/components/Global/TokenSelector/TokenSelector'
import ValidatedInput from '@/components/Global/ValidatedInput'
import { useState, useContext, useEffect, useMemo } from 'react'
import * as _consts from '../Cashout.consts'
import * as context from '@/context'
import { useAuth } from '@/context/authContext'
import { useCreateLink } from '@/components/Create/useCreateLink'
import * as assets from '@/assets'
import { formatIban, validateBankAccount, floorFixed, balanceByToken } from '@/utils'
import { FAQComponent } from './Faq.comp'
import { RecipientInfoComponent } from './RecipientInfo.comp'
import Icon from '@/components/Global/Icon'
import { twMerge } from 'tailwind-merge'
import { MAX_CASHOUT_LIMIT, MIN_CASHOUT_LIMIT } from '@/components/Offramp/Offramp.consts'
import { Button, Card } from '@/components/0_Bruddle'
import { useWallet } from '@/context/walletContext'
import { sanitizeBankAccount } from '@/utils/format.utils'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN } from '@/constants'

export const InitialCashoutView = ({
    onNext,
    tokenValue,
    usdValue,
    setUsdValue,
    setTokenValue,
    setPreparedCreateLinkWrapperResponse,
    setInitialKYCStep,
    setOfframpForm,
    crossChainDetails,
}: _consts.ICashoutScreenProps) => {
    const {
        selectedTokenPrice,
        inputDenomination,
        selectedChainID,
        setSelectedChainID,
        selectedTokenAddress,
        setSelectedTokenAddress,
    } = useContext(context.tokenSelectorContext)

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
    }, [selectedChainID, crossChainDetails])

    const { setLoadingState, loadingState, isLoading } = useContext(context.loadingStateContext)
    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })
    // TODO: @Hugo0 value is ambigous with price - it should be tokenAmount and tokenPrice. But this means changes across a bunch of files.
    const [_tokenValue, _setTokenValue] = useState<string | undefined>(
        inputDenomination === 'TOKEN' ? tokenValue : usdValue
    )
    const [bankAccountNumber, setBankAccountNumber] = useState<string>('')
    const [isValidBankAccountNumber, setIsValidBankAccountNumber] = useState<boolean>(false)
    const [isValidatingBankAccountNumber, setIsValidatingBankAccountNumber] = useState<boolean>(false)

    const { prepareCreateLinkWrapper } = useCreateLink()

    const { isConnected, signInModal, selectedWallet, isExternalWallet, isPeanutWallet } = useWallet()

    const isBelowMinLimit = useMemo(() => {
        if (!usdValue) return false
        const numericValue = parseFloat(usdValue)
        return !isNaN(numericValue) && numericValue < MIN_CASHOUT_LIMIT
    }, [usdValue])

    const isExceedingMaxLimit = useMemo(() => {
        if (!usdValue) return false
        const numericValue = parseFloat(usdValue)
        return !isNaN(numericValue) && numericValue > MAX_CASHOUT_LIMIT
    }, [usdValue])

    const isDisabled = useMemo(() => {
        return (
            !_tokenValue ||
            !isValidBankAccountNumber ||
            isValidatingBankAccountNumber ||
            !xchainAllowed ||
            isBelowMinLimit ||
            isExceedingMaxLimit
        )
    }, [
        _tokenValue,
        isValidBankAccountNumber,
        isValidatingBankAccountNumber,
        xchainAllowed,
        isBelowMinLimit,
        isExceedingMaxLimit,
    ])

    const handleOnNext = async (_inputValue?: string) => {
        setLoadingState('Loading')
        setErrorState({ showError: false, errorMessage: '' })
        try {
            if (!bankAccountNumber) {
                setErrorState({ showError: true, errorMessage: 'Please select a bank account.' })
                setLoadingState('Idle')
                return
            }
            if (!_tokenValue) return

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
                        accountIdentifier: bankAccountNumber,
                    }),
                })

                if (userIdResponse.status === 404 || userIdResponse.status === 400) {
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
                    recipient: bankAccountNumber,
                })
                setInitialKYCStep(0)
            } else {
                setOfframpForm({
                    email: user?.user?.email ?? '',
                    name: user?.user?.full_name ?? '',
                    recipient: bankAccountNumber,
                    password: '',
                })
                if (user?.user.kycStatus == 'verified') {
                    const account = user.accounts.find(
                        (account: any) =>
                            account.account_identifier.replaceAll(/\s/g, '').toLowerCase() ===
                            bankAccountNumber.replaceAll(/\s/g, '').toLowerCase()
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
        } catch (error: any) {
            console.error('Error:', error)
            setErrorState({
                showError: true,
                errorMessage: error.message || 'An error occurred. Please try again.',
            })
        } finally {
            setLoadingState('Idle')
        }
    }

    const maxValue = useMemo(() => {
        if (!selectedWallet?.balances) return ''
        const balance = balanceByToken(selectedWallet.balances, selectedChainID, selectedTokenAddress)
        if (!balance) return ''
        // 6 decimal places, prettier
        return floorFixed(balance.amount, 6)
    }, [selectedChainID, selectedTokenAddress, selectedWallet?.balances])

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

    useEffect(() => {
        if (isPeanutWallet) {
            setSelectedChainID(PEANUT_WALLET_CHAIN.id.toString())
            setSelectedTokenAddress(PEANUT_WALLET_TOKEN)
        }
    }, [isPeanutWallet])

    // Update the bank account selection handler
    const handleBankAccountSelect = (accountIdentifier: string) => {
        if (!xchainAllowed) return
        const sanitizedIdentifier = sanitizeBankAccount(accountIdentifier)
        setBankAccountNumber(sanitizedIdentifier)
        setIsValidBankAccountNumber(true)
        setIsValidatingBankAccountNumber(false)
    }

    // Add this helper function near the top of the component
    const formatBankAccountDisplay = (value: string) => {
        return value
            .toUpperCase()
            .replace(/(.{4})/g, '$1 ')
            .trim()
    }

    // Update the account comparison in the mapping section
    const matchAccount = (storedAccount: any, inputAccount: string) => {
        const sanitizedInput = sanitizeBankAccount(inputAccount)
        const sanitizedStored = sanitizeBankAccount(storedAccount.account_identifier)

        if (storedAccount.account_type === 'iban') {
            return sanitizedInput === sanitizedStored
        } else if (storedAccount.account_type === 'us') {
            // For US accounts, only match against the account number part (after routing number)
            const storedAccountNumber = sanitizedStored.slice(9)
            return sanitizedInput === storedAccountNumber
        }
        return false
    }

    return (
        <Card className="shadow-none sm:shadow-primary-4">
            <Card.Header>
                <Card.Title>Cash Out</Card.Title>
                <Card.Description>
                    Cash out your crypto to your bank account. Works best with popular stablecoins and other commonly
                    traded tokens.
                </Card.Description>
                <FAQComponent />
            </Card.Header>
            <Card.Content className="col gap-2">
                <TokenAmountInput
                    className="w-full max-w-[100%]"
                    tokenValue={_tokenValue}
                    setTokenValue={_setTokenValue}
                    maxValue={maxValue}
                    onSubmit={() => {
                        if (!isConnected) signInModal.open()
                        else handleOnNext()
                    }}
                />
                {isBelowMinLimit && (
                    <div className="w-full text-left text-red">
                        <Icon name="warning" className="-mt-0.5 mr-1" />
                        Minimum amount is ${MIN_CASHOUT_LIMIT}
                    </div>
                )}
                {isExternalWallet && (
                    <>
                        <TokenSelector classNameButton="max-w-[100%]" />
                        {selectedWallet!.balances!.length === 0 && (
                            <div
                                onClick={() => {
                                    open()
                                }}
                                className="cursor-pointer text-h9 underline"
                            >
                                ( Buy Tokens )
                            </div>
                        )}
                    </>
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
                                                        'flex w-full items-center  justify-between text-nowrap border border-black p-2',
                                                        matchAccount(account, bankAccountNumber)
                                                            ? 'bg-purple-1'
                                                            : 'hover:bg-gray-100',
                                                        xchainAllowed && 'cursor-pointer',
                                                        !xchainAllowed && 'opacity-60'
                                                    )}
                                                    onClick={() => handleBankAccountSelect(account.account_identifier)}
                                                >
                                                    <div className="flex flex-grow items-center overflow-hidden">
                                                        <Icon
                                                            name={'bank'}
                                                            className="mr-2 h-4 flex-shrink-0 fill-gray-1"
                                                        />
                                                        <label
                                                            htmlFor={`bank-${index}`}
                                                            className="overflow-hidden text-ellipsis whitespace-nowrap text-right uppercase"
                                                        >
                                                            {formatIban(account.account_identifier)}
                                                        </label>
                                                    </div>
                                                    <div className="flex w-6 justify-center">
                                                        {sanitizeBankAccount(bankAccountNumber) ===
                                                            sanitizeBankAccount(account.account_identifier) && (
                                                            <button
                                                                className="text-lg text-black"
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    setBankAccountNumber('')
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
                            </>
                        ) : null}
                        <div className="flex w-full flex-col items-start justify-center gap-2">
                            <label className="text-left text-h8 font-light">Cash out to a bank account:</label>
                            <ValidatedInput
                                placeholder="IBAN / US account number"
                                label="To"
                                value={bankAccountNumber}
                                className="uppercase"
                                debounceTime={750}
                                validate={validateBankAccount}
                                onUpdate={({ value, isValid, isChanging }) => {
                                    // Store lowercase internally
                                    setBankAccountNumber(value.toLowerCase())
                                    setIsValidBankAccountNumber(isValid)
                                    setIsValidatingBankAccountNumber(isChanging)
                                    if (!isChanging && value && !isValid) {
                                        setErrorState({
                                            showError: true,
                                            errorMessage:
                                                'Invalid bank account. For US bank accounts, enter your routing number and account number separately.',
                                        })
                                    } else {
                                        setErrorState({
                                            showError: false,
                                            errorMessage: '',
                                        })
                                    }
                                }}
                                autoComplete="on"
                                name="bank-account"
                                formatDisplayValue={formatBankAccountDisplay}
                            />
                        </div>
                    </div>
                </div>
                <Button
                    onClick={() => {
                        if (!isConnected) signInModal.open()
                        else handleOnNext()
                    }}
                    loading={isLoading}
                    // Only allow the user to proceed if they are connected and the form is valid
                    disabled={isConnected && isDisabled}
                >
                    {!isConnected ? 'Connect Wallet' : isLoading ? loadingState : 'Proceed'}
                </Button>
                {errorState.showError && (
                    <div className="text-center">
                        <label className=" text-h8 font-normal text-red ">{errorState.errorMessage}</label>
                    </div>
                )}
                {isBelowMinLimit && (
                    <span className="text-h8 font-normal">
                        <Icon name="warning" className="-mt-0.5" /> Minimum cashout amount is ${MIN_CASHOUT_LIMIT}.
                    </span>
                )}
                {isExceedingMaxLimit && (
                    <span className=" text-h8 font-normal ">
                        <Icon name="warning" className="-mt-0.5" /> Maximum cashout amount is $
                        {MAX_CASHOUT_LIMIT.toLocaleString()}.
                    </span>
                )}
                {!xchainAllowed && (
                    <span className=" text-h8 font-normal ">
                        <Icon name="warning" className="-mt-0.5" /> You cannot cashout on this chain.
                    </span>
                )}
            </Card.Content>
        </Card>
    )
}
