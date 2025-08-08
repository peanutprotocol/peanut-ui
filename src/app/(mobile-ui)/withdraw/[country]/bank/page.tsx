'use client'

import { Button } from '@/components/0_Bruddle'
import { countryCodeMap } from '@/components/AddMoney/consts'
import Card from '@/components/Global/Card'
import ErrorAlert from '@/components/Global/ErrorAlert'
import NavHeader from '@/components/Global/NavHeader'
import PeanutActionDetailsCard from '@/components/Global/PeanutActionDetailsCard'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN_SYMBOL } from '@/constants'
import { useWithdrawFlow } from '@/context/WithdrawFlowContext'
import { useWallet } from '@/hooks/wallet/useWallet'
import { AccountType, Account } from '@/interfaces'
import { formatIban, shortenAddressLong, isTxReverted } from '@/utils/general.utils'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import DirectSuccessView from '@/components/Payment/Views/Status.payment.view'
import { ErrorHandler, getBridgeChainName } from '@/utils'
import { getOfframpCurrencyConfig } from '@/utils/bridge.utils'
import { createOfframp, confirmOfframp } from '@/app/actions/offramp'
import { useAuth } from '@/context/authContext'
import ExchangeRate from '@/components/ExchangeRate'

type View = 'INITIAL' | 'SUCCESS'

export default function WithdrawBankPage() {
    const { amountToWithdraw, selectedBankAccount: bankAccount, error, setError } = useWithdrawFlow()
    const { user, fetchUser } = useAuth()
    const { address, sendMoney } = useWallet()
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    const [view, setView] = useState<View>('INITIAL')

    useEffect(() => {
        if (!bankAccount) {
            router.replace('/withdraw')
        }
    }, [bankAccount, router])

    const destinationDetails = (account: Account) => {
        let countryId: string

        switch (account.type) {
            case AccountType.US:
                countryId = 'US'
                break
            case AccountType.IBAN:
                // Default to a European country that uses EUR/SEPA
                countryId = 'DE' // Germany as default EU country
                break
            case AccountType.CLABE:
                countryId = 'MX'
                break
            default:
                return {
                    currency: '',
                    paymentRail: '',
                    externalAccountId: null,
                }
        }

        const { currency, paymentRail } = getOfframpCurrencyConfig(countryId)

        return {
            currency,
            paymentRail,
            externalAccountId: account.bridgeAccountId,
        }
    }

    const getBicAndRoutingNumber = () => {
        if (bankAccount && bankAccount.type === AccountType.IBAN) {
            return bankAccount.bic?.toUpperCase() ?? 'N/A'
        } else if (bankAccount && bankAccount.type === AccountType.US) {
            return bankAccount.routingNumber?.toUpperCase() ?? 'N/A'
        } else if (bankAccount && bankAccount.type === AccountType.CLABE) {
            return bankAccount.identifier?.toUpperCase() ?? 'N/A'
        }

        return 'N/A'
    }

    const handleCreateAndInitiateOfframp = async () => {
        setIsLoading(true)
        setError({ showError: false, errorMessage: '' })

        if (!bankAccount || !user?.user.bridgeCustomerId || !address) {
            setError({ showError: true, errorMessage: 'User details, bridge account, or wallet address not found.' })
            setIsLoading(false)
            return
        }

        if (!bankAccount.bridgeAccountId) {
            setError({ showError: true, errorMessage: 'Bank account is missing.' })
            setIsLoading(false)
            return
        }

        try {
            // Step 1: create the transfer to get deposit instructions
            const destination = destinationDetails(bankAccount)
            if (!destination.externalAccountId) {
                throw new Error('External account ID is missing.')
            }

            const createPayload = {
                // note: for bank withdrawals, minimum $1 is required
                // reference: https://apidocs.bridge.xyz/docs/transaction-costs
                amount: amountToWithdraw,
                developer_fee: '0',
                onBehalfOf: user.user.bridgeCustomerId,
                source: {
                    currency: PEANUT_WALLET_TOKEN_SYMBOL.toLowerCase(),
                    paymentRail: getBridgeChainName(PEANUT_WALLET_CHAIN.id.toString()) ?? 'arbitrum', // source blockchain, bridge expects this to be arbitrum not arbitrum one
                    fromAddress: address,
                },
                destination: {
                    ...destination,
                    externalAccountId: destination.externalAccountId,
                },
            }
            const { data, error } = await createOfframp(createPayload)

            if (error) {
                setError({ showError: true, errorMessage: error })
                throw new Error(error)
            }

            if (!data?.depositInstructions?.toAddress || !data.transferId) {
                setError({ showError: true, errorMessage: 'Failed to get deposit address from the backend.' })
                throw new Error('Failed to get deposit address from the backend.')
            }

            // Step 2: prepare and send the transaction from peanut wallet to the deposit address
            const receipt = await sendMoney(data.depositInstructions.toAddress as `0x${string}`, createPayload.amount)

            if (isTxReverted(receipt)) {
                throw new Error('Transaction reverted by the network.')
            }

            // Step 3: Confirm the transfer with the backend to make it visible in history
            const confirmResult = await confirmOfframp(data.transferId, receipt.transactionHash)

            if (confirmResult.error) {
                // This is a tricky state. The on-chain tx succeeded, but the backend failed to record it.
                // For now, we'll show a detailed error. A more robust solution could involve a retry mechanism
                // or flagging this for support.
                setError({
                    showError: true,
                    errorMessage: `Your funds were sent, but there was an issue confirming the transfer. Please contact support.`,
                })
                throw new Error(confirmResult.error)
            }

            setView('SUCCESS')
        } catch (e: any) {
            const error = ErrorHandler(e)
            if (error.includes('Something failed. Please try again.')) {
                setError({ showError: true, errorMessage: e.message })
            } else {
                setError({ showError: true, errorMessage: error })
            }
        } finally {
            setIsLoading(false)
        }
    }

    const countryCodeForFlag = () => {
        if (!bankAccount?.details?.countryCode) return ''
        const code = countryCodeMap[bankAccount.details.countryCode ?? ''] ?? bankAccount.details.countryCode
        return code.toLowerCase()
    }

    useEffect(() => {
        fetchUser()
    }, [])

    if (!bankAccount) {
        return null
    }

    return (
        <div className="flex h-full w-full flex-col justify-start gap-8 self-start">
            <NavHeader
                title="Withdraw"
                icon={view === 'SUCCESS' ? 'cancel' : undefined}
                onPrev={view === 'SUCCESS' ? () => router.push('/home') : () => router.back()}
            />

            {view === 'INITIAL' && (
                <div className="my-auto flex h-full w-full flex-col justify-center space-y-4 pb-5">
                    <PeanutActionDetailsCard
                        countryCodeForFlag={countryCodeForFlag()}
                        avatarSize="small"
                        transactionType={'WITHDRAW_BANK_ACCOUNT'}
                        recipientType={'BANK_ACCOUNT'}
                        recipientName={bankAccount?.identifier ?? 'Bank Account'}
                        amount={amountToWithdraw}
                        tokenSymbol={PEANUT_WALLET_TOKEN_SYMBOL}
                    />

                    <Card className="rounded-sm">
                        <PaymentInfoRow label={'Full name'} value={user?.user.fullName} />
                        {bankAccount?.type === AccountType.IBAN ? (
                            <>
                                <PaymentInfoRow
                                    label={'IBAN'}
                                    value={
                                        bankAccount?.identifier
                                            ? formatIban(bankAccount.identifier)
                                            : '' /* fallback to empty string to avoid runtime error */
                                    }
                                />
                                <PaymentInfoRow label="BIC" value={getBicAndRoutingNumber()} />
                            </>
                        ) : bankAccount?.type === AccountType.CLABE ? (
                            <>
                                <PaymentInfoRow label={'CLABE'} value={bankAccount?.identifier.toUpperCase()} />
                            </>
                        ) : (
                            <>
                                <PaymentInfoRow label={'Account Number'} value={bankAccount?.identifier} />
                                <PaymentInfoRow label={'Routing Number'} value={getBicAndRoutingNumber()} />
                            </>
                        )}
                        <ExchangeRate accountType={bankAccount.type} />
                        <PaymentInfoRow hideBottomBorder label="Fee" value={`$ 0.00`} />
                    </Card>
                    {error.showError ? (
                        <Button
                            disabled={isLoading}
                            onClick={handleCreateAndInitiateOfframp}
                            loading={isLoading}
                            shadowSize="4"
                            className="w-full"
                            icon="retry"
                            iconSize={14}
                        >
                            Retry
                        </Button>
                    ) : (
                        <Button
                            icon="arrow-up"
                            loading={isLoading}
                            iconSize={12}
                            shadowSize="4"
                            onClick={handleCreateAndInitiateOfframp}
                            disabled={isLoading || !bankAccount}
                            className="w-full"
                        >
                            Withdraw
                        </Button>
                    )}
                    {error.showError && <ErrorAlert description={error.errorMessage} />}
                </div>
            )}

            {view === 'SUCCESS' && (
                <DirectSuccessView
                    isWithdrawFlow
                    currencyAmount={`$${amountToWithdraw}`}
                    message={bankAccount ? shortenAddressLong(bankAccount.identifier.toUpperCase()) : ''}
                />
            )}
        </div>
    )
}
