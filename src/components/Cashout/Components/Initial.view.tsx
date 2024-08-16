'use client'

import TokenAmountInput from '@/components/Global/TokenAmountInput'
import TokenSelector from '@/components/Global/TokenSelector/TokenSelector'
import { useAccount } from 'wagmi'
import { useWeb3Modal } from '@web3modal/wagmi/react'
import { useState, useContext, useEffect } from 'react'
import * as _consts from '../Cashout.consts'
import * as context from '@/context'
import Loading from '@/components/Global/Loading'
import { useBalance } from '@/hooks/useBalance'
import { useAuth } from '@/context/authContext'
import { useForm } from 'react-hook-form'

export const InitialCashoutView = ({
    onNext,
    tokenValue,
    usdValue,
    setUsdValue,
    setRecipient,
}: _consts.ICashoutScreenProps) => {
    const { selectedTokenPrice, inputDenomination } = useContext(context.tokenSelectorContext)
    const { balances, hasFetchedBalances } = useBalance()
    const { user, fetchUser, isFetchingUser, updateUserName, submitProfilePhoto } = useAuth()

    const { setLoadingState, loadingState, isLoading } = useContext(context.loadingStateContext)
    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })
    const [_tokenValue, _setTokenValue] = useState<string | undefined>(
        inputDenomination === 'TOKEN' ? tokenValue : usdValue
    )

    const {
        register: registerLoginForm,
        formState: { errors },
        handleSubmit,
    } = useForm<{
        email: string
        password: string
    }>({
        mode: 'onChange',
        defaultValues: { email: '', password: '' },
    })

    const { isConnected } = useAccount()
    const { open } = useWeb3Modal()

    const handleConnectWallet = async () => {
        open()
    }

    const [selectedBankAccount, setSelectedBankAccount] = useState<string | undefined>(undefined)
    const [newBankAccount, setNewBankAccount] = useState<string>('')
    const [activeInput, setActiveInput] = useState<'newBankAccount' | 'selectedBankAccount'>()

    const handleOnNext = async (_inputValue?: string) => {
        setLoadingState('Loading')
        try {
            if (!selectedBankAccount && !newBankAccount) {
                setErrorState({ showError: true, errorMessage: 'Please select a bank account.' })
                setLoadingState('Idle')
                return
            }
            if (!_tokenValue) return
            if (inputDenomination === 'TOKEN') {
                if (selectedTokenPrice) {
                    setUsdValue((parseFloat(_tokenValue) * selectedTokenPrice).toString())
                }
            } else if (inputDenomination === 'USD') {
                if (selectedTokenPrice) {
                    setUsdValue(parseFloat(_tokenValue).toString())
                }
            }
            setRecipient({ name: '', address: selectedBankAccount || newBankAccount })
            setLoadingState('Idle')
            onNext()
        } catch (error) {
            setErrorState({ showError: true, errorMessage: 'An error occurred. Please try again.' })
            setLoadingState('Idle')
        }
    }

    const handleLogin = async (loginFormData: { email: string; password: string }) => {
        try {
            const userLoginResponse = await fetch('/api/peanut/user/login-user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: loginFormData.email,
                    password: loginFormData.password,
                }),
            })
            const userLogin = await userLoginResponse.json()

            if (userLoginResponse.status !== 200) {
                if (userLogin === 'Invalid email format') {
                    errors.email = {
                        message: 'Invalid email format',
                        type: 'validate',
                    }
                }
                if (userLogin === 'Invalid email, userId') {
                    errors.email = {
                        message: 'Incorrect email',
                        type: 'validate',
                    }
                } else if (userLogin === 'Invalid password') {
                    errors.password = {
                        message: 'Invalid password',
                        type: 'validate',
                    }
                }
                return
            }
            await fetchUser()
        } catch (error) {
            console.error('Error:', error)
            return
        } finally {
        }
    }

    useEffect(() => {
        if (activeInput === 'newBankAccount') {
            setSelectedBankAccount(undefined)
        } else if (activeInput === 'selectedBankAccount') {
            setNewBankAccount('')
        }
    }, [newBankAccount, selectedBankAccount])

    return (
        <div className="mx-auto flex max-w-[96%] flex-col items-center justify-center gap-6 text-center">
            <label className="text-h2">Cash Out</label>
            <div className="flex flex-col justify-center gap-3">
                <label className="text-start text-h8 font-light">
                    Cash out your crypto to your bank account. From any token, any chain, directly to your bank account.
                </label>
                <label className="max-w-[100%] text-left text-h9 font-light">
                    Fees: $0.50. Requires KYC. Only US & Europe
                </label>
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
            </div>
            <div className="flex w-full flex-col justify-center gap-3">
                <div className="max-h-48 space-y-2 overflow-y-scroll">
                    {user ? (
                        user?.accounts &&
                        user?.accounts
                            .filter((account) => account.account_type === 'iban' || account.account_type === 'us')
                            ?.map((account, index) => (
                                <div
                                    key={index}
                                    className="flex w-full cursor-pointer border border-black p-2"
                                    onClick={() => {
                                        setSelectedBankAccount(account.account_identifier)
                                        setActiveInput('selectedBankAccount')
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        id={`bank-${index}`}
                                        name="bankAccount"
                                        value={account.account_identifier}
                                        checked={selectedBankAccount === account.account_identifier}
                                        className="cursor-pointer"
                                    />
                                    <label htmlFor={`bank-${index}`} className="ml-2 cursor-pointer text-right">
                                        {account.account_identifier}
                                    </label>
                                </div>
                            ))
                    ) : (
                        <div>
                            <label>Login to see your bank accounts</label>
                            <form
                                className="flex w-full flex-col items-start justify-center gap-2"
                                onSubmit={handleSubmit(handleLogin)}
                            >
                                <input
                                    {...registerLoginForm('email', { required: 'This field is required' })}
                                    className={`custom-input custom-input-xs ${errors.email ? 'border border-red' : ''}`}
                                    placeholder="Email"
                                    type="email"
                                />
                                {errors.email && (
                                    <span className="text-h9 font-normal text-red">{errors.email.message}</span>
                                )}

                                <input
                                    {...registerLoginForm('password', { required: 'This field is required' })}
                                    className={`custom-input custom-input-xs ${errors.password ? 'border border-red' : ''}`}
                                    placeholder="Password"
                                    type="password"
                                    onKeyDown={(e) => {
                                        // if (e.key === 'Enter') {
                                        //     handleEmail(watchOfframp())
                                        // }
                                    }}
                                />
                                {errors.password && (
                                    <span className="text-h9 font-normal text-red">{errors.password.message}</span>
                                )}
                                <button
                                    className="wc-disable-mf btn-purple btn-xl w-full max-w-[100%]"
                                    // onClick={() => {
                                    //     handleEmail(watchOfframp())
                                    // }}
                                    type="submit"
                                >
                                    Login
                                </button>
                            </form>
                        </div>
                    )}
                </div>

                <label className="text-left text-h8 font-light">Cashout to a new bank account:</label>
                <div className="flex w-full cursor-pointer border border-black p-2">
                    <label className="ml-2 text-right">To:</label>
                    <input
                        type="text"
                        className="ml-2 w-full border border-none outline-none"
                        placeholder="Enter IBAN / ACH"
                        value={newBankAccount}
                        onChange={(e) => setNewBankAccount(e.target.value)}
                        onFocus={() => setActiveInput('newBankAccount')}
                    />
                </div>
                <button
                    className="wc-disable-mf btn-purple btn-xl w-full max-w-[100%]"
                    onClick={() => {
                        if (!isConnected) handleConnectWallet()
                        else handleOnNext()
                    }}
                    disabled={!_tokenValue || (!selectedBankAccount && !newBankAccount)}
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
            </div>
        </div>
    )
}
