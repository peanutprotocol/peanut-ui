'use client'

import { IClaimScreenProps } from '../../Claim.consts'
import { DynamicBankAccountForm, IBankAccountDetails } from '@/components/AddWithdraw/DynamicBankAccountForm'
import { useGuestFlow } from '@/context/GuestFlowContext'
import { ClaimCountryListView } from './ClaimCountryList.view'
import { useCallback, useContext, useState } from 'react'
import { loadingStateContext } from '@/context'
import { createBridgeExternalAccountForGuest } from '@/app/actions/external-accounts'
import { confirmOfframp, createOfframpForGuest } from '@/app/actions/offramp'
import { Address, formatUnits } from 'viem'
import { ErrorHandler, formatTokenAmount } from '@/utils'
import * as Sentry from '@sentry/nextjs'
import useClaimLink from '../../useClaimLink'
import { ConfirmBankClaimView } from './Confirm.bank-claim.view'
import { AddBankAccountPayload } from '@/app/actions/types/users.types'
import { TCreateOfframpRequest, TCreateOfframpResponse } from '@/services/services.types'
import { getOfframpCurrencyConfig } from '@/utils/bridge.utils'
import { getBridgeChainName, getBridgeTokenName } from '@/utils/bridge-accounts.utils'
import peanut from '@squirrel-labs/peanut-sdk'
import { getUserById } from '@/app/actions/users'
import NavHeader from '@/components/Global/NavHeader'
import { getCountryCodeForWithdraw } from '@/utils/withdraw.utils'

export const BankFlowManager = (props: IClaimScreenProps) => {
    const { onCustom, claimLinkData, setTransactionHash } = props
    const { guestFlowStep, setGuestFlowStep, selectedCountry, setClaimType, setBankDetails } = useGuestFlow()
    const { isLoading, setLoadingState } = useContext(loadingStateContext)
    const { claimLink } = useClaimLink()
    const [offrampDetails, setOfframpDetails] = useState<TCreateOfframpResponse | null>(null)
    const [localBankDetails, setLocalBankDetails] = useState<IBankAccountDetails | null>(null)
    const [receiverFullName, setReceiverFullName] = useState<string>('')
    const [error, setError] = useState<string | null>(null)

    const handleSuccess = async (payload: AddBankAccountPayload, rawData: IBankAccountDetails) => {
        if (!selectedCountry) {
            const err = 'Country not selected'
            setError(err)
            return { error: err }
        }

        try {
            if (!claimLinkData.sender?.userId) return { error: 'Sender details not found' }
            setLoadingState('Executing transaction')
            setError(null)
            const userResponse = await getUserById(claimLinkData.sender?.userId ?? claimLinkData.senderAddress)

            if (!userResponse || ('error' in userResponse && userResponse.error)) {
                const errorMessage =
                    (userResponse && typeof userResponse.error === 'string' && userResponse.error) ||
                    'Failed to get user info'
                setError(errorMessage)
                return { error: errorMessage }
            }

            if (userResponse.kycStatus !== 'approved') {
                setError('User not KYC approved')
                return { error: 'User not KYC approved' }
            }

            setReceiverFullName(rawData.name ?? '')
            sessionStorage.setItem('receiverFullName', rawData.name ?? '')

            const [firstName, ...lastNameParts] = rawData.name?.split(' ') ?? ['', '']
            const lastName = lastNameParts.join(' ')

            const paymentRail = getBridgeChainName(claimLinkData.chainId)
            const currency = getBridgeTokenName(claimLinkData.chainId, claimLinkData.tokenAddress)

            if (!paymentRail || !currency) {
                const err = 'Chain or token not supported for bank withdrawal'
                setError(err)
                return { error: err }
            }

            const payloadWithCountry = {
                ...payload,
                country: selectedCountry.id,
                accountOwnerName: {
                    firstName: firstName,
                    lastName: lastName,
                },
            }

            if (!userResponse?.bridgeCustomerId) {
                setError('Sender details not found')
                return { error: 'Sender details not found' }
            }

            const externalAccountResponse = await createBridgeExternalAccountForGuest(
                userResponse.bridgeCustomerId,
                payloadWithCountry
            )

            if ('error' in externalAccountResponse && externalAccountResponse.error) {
                setError(externalAccountResponse.error)
                return { error: externalAccountResponse.error }
            }

            if (!('id' in externalAccountResponse)) {
                setError('Failed to create external account')
                return { error: 'Failed to create external account' }
            }

            // note: we pass peanut contract address to offramp as the funds go from, user -> peanut contract -> bridge
            const params = peanut.getParamsFromLink(claimLinkData.link)
            const { address: pubKey } = peanut.generateKeysFromString(params.password)
            const chainId = params.chainId
            const contractVersion = params.contractVersion
            const peanutContractAddress = peanut.getContractAddress(chainId, contractVersion) as Address

            const offrampRequestParams: TCreateOfframpRequest = {
                amount: formatUnits(claimLinkData.amount, claimLinkData.tokenDecimals),
                userId: userResponse.userId,
                sendLinkPubKey: pubKey,
                source: {
                    paymentRail: paymentRail,
                    currency: currency,
                    fromAddress: peanutContractAddress,
                },
                destination: {
                    ...getOfframpCurrencyConfig(selectedCountry.id),
                    externalAccountId: externalAccountResponse.id,
                },
                features: {
                    allowAnyFromAddress: true,
                },
            }

            const offrampResponse = await createOfframpForGuest(offrampRequestParams)

            if (offrampResponse.error || !offrampResponse.data) {
                setError(offrampResponse.error || 'Failed to create offramp')
                return { error: offrampResponse.error || 'Failed to create offramp' }
            }

            setOfframpDetails(offrampResponse.data as TCreateOfframpResponse)

            setLocalBankDetails(rawData)
            setBankDetails(rawData)
            setGuestFlowStep('bank-confirm-claim')
            return {}
        } catch (e: any) {
            const errorString = ErrorHandler(e)
            setError(errorString)
            Sentry.captureException(e)
            return { error: errorString }
        } finally {
            setLoadingState('Idle')
        }
    }

    const handleConfirmClaim = useCallback(async () => {
        try {
            setLoadingState('Executing transaction')
            setError(null)

            if (!offrampDetails) {
                throw new Error('Offramp details not available')
            }

            const claimTx = await claimLink({
                address: offrampDetails.depositInstructions.toAddress,
                link: claimLinkData.link,
            })

            setTransactionHash(claimTx)
            await confirmOfframp(offrampDetails.transferId, claimTx)
            if (setClaimType) setClaimType('claim-bank')
            onCustom('SUCCESS')
        } catch (e: any) {
            const errorString = ErrorHandler(e)
            setError(errorString)
            Sentry.captureException(e)
        } finally {
            setLoadingState('Idle')
        }
    }, [
        offrampDetails,
        claimLink,
        claimLinkData.link,
        setTransactionHash,
        confirmOfframp,
        setClaimType,
        onCustom,
        setLoadingState,
        setError,
    ])

    if (guestFlowStep === 'bank-confirm-claim' && offrampDetails && localBankDetails) {
        return (
            <ConfirmBankClaimView
                claimLinkData={claimLinkData}
                onConfirm={handleConfirmClaim}
                onBack={() => {
                    setGuestFlowStep('bank-details-form')
                    setError(null)
                }}
                isProcessing={isLoading}
                error={error}
                bankDetails={localBankDetails}
                fullName={receiverFullName}
            />
        )
    }

    if (guestFlowStep === 'bank-country-list' || !selectedCountry) {
        return <ClaimCountryListView {...props} />
    }

    return (
        <div className="flex flex-col justify-between gap-8">
            <div className="md:hidden">
                <NavHeader title="Receive" onPrev={() => setGuestFlowStep('bank-country-list')} />
            </div>
            <DynamicBankAccountForm
                key={selectedCountry.id}
                country={getCountryCodeForWithdraw(selectedCountry.id)}
                onSuccess={handleSuccess}
                flow={'claim'}
                actionDetailsProps={{
                    transactionType: 'CLAIM_LINK_BANK_ACCOUNT',
                    recipientType: 'BANK_ACCOUNT',
                    amount: formatTokenAmount(Number(formatUnits(claimLinkData.amount, claimLinkData.tokenDecimals)))!,
                    tokenSymbol: claimLinkData.tokenSymbol,
                }}
            />
        </div>
    )
}
