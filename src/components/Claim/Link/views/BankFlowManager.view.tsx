'use client'

import { IClaimScreenProps } from '../../Claim.consts'
import { DynamicBankAccountForm, IBankAccountDetails } from '@/components/AddWithdraw/DynamicBankAccountForm'
import { useGuestFlow } from '@/context/GuestFlowContext'
import { ClaimCountryListView } from './ClaimCountryList.view'
import { useContext, useState } from 'react'
import { loadingStateContext } from '@/context'
import { createBridgeExternalAccountForGuest } from '@/app/actions/external-accounts'
import { confirmOfframp, createOfframpForGuest } from '@/app/actions/offramp'
import { Address, formatUnits } from 'viem'
import { ErrorHandler, formatTokenAmount } from '@/utils'
import * as Sentry from '@sentry/nextjs'
import useClaimLink from '../../useClaimLink'
import { ConfirmBankClaimView } from './ConfirmBankClaim.view'
import { AddBankAccountPayload } from '@/app/actions/types/users.types'
import { TCreateOfframpRequest, TCreateOfframpResponse } from '@/services/services.types'
import { getOfframpCurrencyConfig } from '@/utils/bridge.utils'
import { getBridgeChainName, getBridgeTokenName } from '@/utils/bridge-accounts.utils'
import peanut from '@squirrel-labs/peanut-sdk'

export const BankFlowManager = (props: IClaimScreenProps) => {
    const { onCustom, claimLinkData, setTransactionHash } = props
    const { guestFlowStep, setGuestFlowStep, selectedCountry, setClaimType, senderDetails } = useGuestFlow()
    const { isLoading, setLoadingState } = useContext(loadingStateContext)
    const { claimLink } = useClaimLink()
    const [offrampDetails, setOfframpDetails] = useState<TCreateOfframpResponse | null>(null)
    const [bankDetails, setBankDetails] = useState<IBankAccountDetails | null>(null)
    const [error, setError] = useState<string | null>(null)

    const handleSuccess = async (payload: AddBankAccountPayload, rawData: IBankAccountDetails) => {
        if (!selectedCountry) {
            const err = 'Country not selected'
            setError(err)
            return { error: err }
        }

        if (!senderDetails) {
            const err = 'Sender details not found'
            setError(err)
            return { error: err }
        }

        try {
            setLoadingState('Executing transaction')
            setError(null)

            const [firstName, ...lastNameParts] = senderDetails.fullName.split(' ')
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

            if (!senderDetails?.bridgeCustomerId) {
                setError('Sender details not found')
                return { error: 'Sender details not found' }
            }

            const externalAccountResponse = await createBridgeExternalAccountForGuest(
                senderDetails.bridgeCustomerId,
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
            const chainId = params.chainId
            const contractVersion = params.contractVersion
            const peanutContractAddress = peanut.getContractAddress(chainId, contractVersion) as Address

            if (!senderDetails?.bridgeCustomerId) {
                setError('Sender details not found')
                return { error: 'Sender details not found' }
            }

            const offrampRequestParams: TCreateOfframpRequest = {
                amount: formatUnits(claimLinkData.amount, claimLinkData.tokenDecimals),
                onBehalfOf: senderDetails.bridgeCustomerId,
                source: {
                    paymentRail: paymentRail,
                    currency: currency,
                    fromAddress: peanutContractAddress,
                },
                destination: {
                    ...getOfframpCurrencyConfig(selectedCountry.id),
                    externalAccountId: externalAccountResponse.id,
                },
                developer_fee: '0',
            }

            const offrampResponse = await createOfframpForGuest(offrampRequestParams)

            if (offrampResponse.error || !offrampResponse.data) {
                setError(offrampResponse.error || 'Failed to create offramp')
                return { error: offrampResponse.error || 'Failed to create offramp' }
            }

            setOfframpDetails(offrampResponse.data as TCreateOfframpResponse)

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

    const handleConfirmClaim = async () => {
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
    }

    if (guestFlowStep === 'bank-confirm-claim' && offrampDetails && bankDetails && senderDetails) {
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
                offrampDetails={offrampDetails}
                bankDetails={bankDetails}
                fullName={senderDetails.fullName}
            />
        )
    }

    if (guestFlowStep === 'bank-country-list' || !selectedCountry) {
        return <ClaimCountryListView {...props} />
    }

    return (
        <DynamicBankAccountForm
            key={selectedCountry.id}
            country={selectedCountry.id}
            onSuccess={handleSuccess}
            flow={'claim'}
            actionDetailsProps={{
                transactionType: 'CLAIM_LINK_BANK_ACCOUNT',
                recipientType: 'BANK_ACCOUNT',
                amount: formatTokenAmount(Number(formatUnits(claimLinkData.amount, claimLinkData.tokenDecimals)))!,
                tokenSymbol: claimLinkData.tokenSymbol,
            }}
        />
    )
}
