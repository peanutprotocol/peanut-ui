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

export const InitialCashoutView = ({
    onNext,
    tokenValue,
    usdValue,
    setUsdValue,
    setRecipient,
}: _consts.ICashoutScreenProps) => {
    const bankAccounts = [
        { name: 'Bank 1', address: 'PL1298391283912' },
        { name: 'Bank 2', address: 'DE12983912839121332432' },
        { name: 'Bank 3', address: 'US1298392339124234' },
    ]
    const { selectedTokenPrice, inputDenomination } = useContext(context.tokenSelectorContext)
    const { balances, hasFetchedBalances } = useBalance()

    const { setLoadingState, loadingState, isLoading } = useContext(context.loadingStateContext)
    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })
    const [_tokenValue, _setTokenValue] = useState<string | undefined>(
        inputDenomination === 'TOKEN' ? tokenValue : usdValue
    )

    const { isConnected } = useAccount()
    const { open } = useWeb3Modal()

    const handleConnectWallet = async () => {
        open()
    }

    const [selectedBankAccount, setSelectedBankAccount] = useState<string | undefined>(undefined)

    const handleOnNext = async (_inputValue?: string) => {
        setLoadingState('Loading')
        try {
            if (!selectedBankAccount) {
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
            setRecipient({ name: '', address: selectedBankAccount })
            setLoadingState('Idle')
            onNext()
        } catch (error) {
            setErrorState({ showError: true, errorMessage: 'An error occurred. Please try again.' })
            setLoadingState('Idle')
        }
    }

    return (
        <div className="flex w-full flex-col items-center justify-center gap-6 text-center">
            <label className="text-h2">Cash Out</label>
            <label className="max-w-96 text-start text-h8 font-light">
                Cash out your crypto to your bank account. From any token, any chain, directly to your bank account.
            </label>
            <label className="max-w-96 text-start text-h9 font-light">
                Fees: $0.50. Requires KYC. Only US & Europe
            </label>

            <div className="flex w-full flex-col items-center justify-center gap-3">
                <TokenAmountInput
                    className="w-full"
                    tokenValue={_tokenValue}
                    setTokenValue={_setTokenValue}
                    onSubmit={() => {
                        if (!isConnected) handleConnectWallet()
                        else handleOnNext()
                    }}
                />
                <TokenSelector classNameButton="w-full" />
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
            <div className="flex w-full flex-col items-center justify-center gap-3">
                {bankAccounts.map((account, index) => (
                    <div key={index} className="flex w-[96%] border border-black p-2">
                        <input
                            type="checkbox"
                            id={`bank-${index}`}
                            name="bankAccount"
                            value={account.address}
                            checked={selectedBankAccount === account.address}
                            onChange={(e) => setSelectedBankAccount(e.target.value)}
                        />
                        <label htmlFor={`bank-${index}`} className="ml-2 text-right">
                            {account.address}
                        </label>
                    </div>
                ))}
                <label className="text-left text-h8 font-light">Add new Bank Account:</label>
                <div className="flex w-[96%] w-full cursor-pointer border border-black p-2">
                    <label className="ml-2 text-right">To: IBAN / ACH</label>
                </div>
                <button
                    className="wc-disable-mf btn-purple btn-xl "
                    onClick={() => {
                        if (!isConnected) handleConnectWallet()
                        else handleOnNext()
                    }}
                    disabled={_tokenValue === undefined || selectedBankAccount === undefined}
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
