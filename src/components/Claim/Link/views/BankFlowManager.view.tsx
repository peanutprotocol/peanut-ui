'use client'

import { IClaimScreenProps } from '../../Claim.consts'
import { DynamicBankAccountForm, IBankAccountDetails } from '@/components/AddWithdraw/DynamicBankAccountForm'
import { ClaimBankFlowStep, useClaimBankFlow } from '@/context/ClaimBankFlowContext'
import { useCallback, useContext, useState, useRef, useEffect } from 'react'
import { loadingStateContext } from '@/context'
import { createBridgeExternalAccountForGuest } from '@/app/actions/external-accounts'
import { confirmOfframp, createOfframp, createOfframpForGuest } from '@/app/actions/offramp'
import { Address, formatUnits } from 'viem'
import { ErrorHandler, formatTokenAmount } from '@/utils'
import * as Sentry from '@sentry/nextjs'
import useClaimLink from '../../useClaimLink'
import { AddBankAccountPayload } from '@/app/actions/types/users.types'
import { useAuth } from '@/context/authContext'
import { TCreateOfframpRequest, TCreateOfframpResponse } from '@/services/services.types'
import { getOfframpCurrencyConfig } from '@/utils/bridge.utils'
import { getBridgeChainName, getBridgeTokenName } from '@/utils/bridge-accounts.utils'
import peanut from '@squirrel-labs/peanut-sdk'
import { addBankAccount, getUserById, updateUserById } from '@/app/actions/users'
import SavedAccountsView from '../../../Common/SavedAccountsView'
import { BankClaimType, useDetermineBankClaimType } from '@/hooks/useDetermineBankClaimType'
import useSavedAccounts from '@/hooks/useSavedAccounts'
import { ConfirmBankClaimView } from './Confirm.bank-claim.view'
import { CountryListRouter } from '@/components/Common/CountryListRouter'
import NavHeader from '@/components/Global/NavHeader'
import { useWebSocket } from '@/hooks/useWebSocket'
import { BridgeKycStatus } from '@/utils/bridge-accounts.utils'
import { getCountryCodeForWithdraw } from '@/utils/withdraw.utils'
import { useAppDispatch } from '@/redux/hooks'
import { bankFormActions } from '@/redux/slices/bank-form-slice'
import { sendLinksApi } from '@/services/sendLinks'
import { InitiateBridgeKYCModal } from '@/components/Kyc/InitiateBridgeKYCModal'

type BankAccountWithId = IBankAccountDetails &
    (
        | { id: string; bridgeAccountId: string }
        | { id: string; bridgeAccountId?: string }
        | { id?: string; bridgeAccountId: string }
    )

/**
 * @name BankFlowManager
 * @description This component manages the entire bank claim flow, acting as a state machine.
 * It determines which view to show based on the user's KYC status, saved accounts, and progress.
 * It handles creating off-ramps, adding bank accounts, and orchestrating the KYC process.
 */
export const BankFlowManager = (props: IClaimScreenProps) => {
    // props and basic setup
    const { onCustom, claimLinkData, setTransactionHash } = props
    const { user, fetchUser } = useAuth()

    // state from the centralized context
    const {
        flowStep: claimBankFlowStep,
        setFlowStep: setClaimBankFlowStep,
        selectedCountry,
        setClaimType,
        setBankDetails,
        justCompletedKyc,
        setJustCompletedKyc,
        showVerificationModal: isKycModalOpen,
        setShowVerificationModal: setIsKycModalOpen,
    } = useClaimBankFlow()

    // hooks for business logic and data fetching
    const { claimType: bankClaimType } = useDetermineBankClaimType(claimLinkData.sender?.userId ?? '')
    const savedAccounts = useSavedAccounts()
    const { isLoading, setLoadingState } = useContext(loadingStateContext)
    const { claimLink } = useClaimLink()
    const dispatch = useAppDispatch()

    // local states for this component
    const [localBankDetails, setLocalBankDetails] = useState<BankAccountWithId | null>(null)
    const [receiverFullName, setReceiverFullName] = useState<string>('')
    const [error, setError] = useState<string | null>(null)
    const formRef = useRef<{ handleSubmit: () => void }>(null)
    const [liveKycStatus, setLiveKycStatus] = useState<BridgeKycStatus | undefined>(
        user?.user?.bridgeKycStatus as BridgeKycStatus
    )
    const [isProcessingKycSuccess, setIsProcessingKycSuccess] = useState(false)
    const [offrampData, setOfframpData] = useState<TCreateOfframpResponse | null>(null)

    // websocket for real-time KYC status updates
    useWebSocket({
        username: user?.user.username ?? undefined,
        autoConnect: !!user?.user.username,
        onKycStatusUpdate: (newStatus) => {
            setLiveKycStatus(newStatus as BridgeKycStatus)
        },
    })

    // effect to update live KYC status from user object
    useEffect(() => {
        if (user?.user.bridgeKycStatus) {
            setLiveKycStatus(user.user.bridgeKycStatus as BridgeKycStatus)
        }
    }, [user?.user.bridgeKycStatus])

    /**
     * @name handleConfirmClaim
     * @description claims the link to the deposit address provided by the off-ramp api and confirms the transfer.
     */
    const handleConfirmClaim = useCallback(
        async (details: TCreateOfframpResponse) => {
            try {
                const claimTx = await claimLink({
                    address: details.depositInstructions.toAddress,
                    link: claimLinkData.link,
                })
                // if a user is logged in, associate the claim with their account.
                // this helps track their activity correctly.
                if (user && claimTx) {
                    try {
                        await sendLinksApi.associateClaim(claimTx)
                    } catch (e) {
                        Sentry.captureException(e)
                        console.error('Failed to associate claim', e)
                    }
                }
                setTransactionHash(claimTx)
                await confirmOfframp(details.transferId, claimTx)
                if (setClaimType) setClaimType('claim-bank')
                onCustom('SUCCESS')
            } catch (e: any) {
                const errorString = ErrorHandler(e)
                setError(errorString)
                Sentry.captureException(e)
                throw e
            }
        },
        [claimLink, claimLinkData.link, setTransactionHash, setClaimType, onCustom, user]
    )

    /**
     * @name handleCreateOfframpAndClaim
     * @description creates an off-ramp transfer for the user, either as a guest or a logged-in user.
     */
    const handleCreateOfframpAndClaim = async (account: BankAccountWithId) => {
        try {
            setLoadingState('Executing transaction')
            setError(null)

            // determine user for offramp based on the bank claim type
            const isGuestFlow = bankClaimType === BankClaimType.GuestBankClaim
            const userForOfframp = isGuestFlow
                ? await getUserById(claimLinkData.sender?.userId ?? claimLinkData.senderAddress)
                : user?.user

            // handle error if user for offramp is not found
            if (!userForOfframp || ('error' in userForOfframp && userForOfframp.error)) {
                throw new Error(
                    (userForOfframp && typeof userForOfframp.error === 'string' && userForOfframp.error) ||
                        'Failed to get user info'
                )
            }

            // handle error if user is not KYC approved
            if (userForOfframp.bridgeKycStatus !== 'approved') throw new Error('User not KYC approved')
            if (!userForOfframp?.bridgeCustomerId) throw new Error('User bridge customer ID not found')

            // get payment rail and currency for the offramp
            const paymentRail = getBridgeChainName(claimLinkData.chainId)
            const currency = getBridgeTokenName(claimLinkData.chainId, claimLinkData.tokenAddress)
            if (!paymentRail || !currency) throw new Error('Chain or token not supported for bank withdrawal')

            // get params from send link
            const params = peanut.getParamsFromLink(claimLinkData.link)
            const { address: pubKey } = peanut.generateKeysFromString(params.password)
            const chainId = params.chainId
            const contractVersion = params.contractVersion
            const peanutContractAddress = peanut.getContractAddress(chainId, contractVersion) as Address

            const externalAccountId = (account.bridgeAccountId ?? account.id) as string

            const destination = getOfframpCurrencyConfig(account.country ?? selectedCountry!.id)

            // handle offramp request creation
            const offrampRequestParams: TCreateOfframpRequest = {
                onBehalfOf: userForOfframp.bridgeCustomerId,
                amount: formatUnits(claimLinkData.amount, claimLinkData.tokenDecimals),
                userId: userForOfframp.userId,
                sendLinkPubKey: pubKey,
                source: {
                    paymentRail: paymentRail,
                    currency: currency,
                    fromAddress: peanutContractAddress,
                },
                destination: {
                    ...destination,
                    externalAccountId,
                },
                features: { allowAnyFromAddress: true },
            }

            const offrampResponse = isGuestFlow
                ? await createOfframpForGuest(offrampRequestParams)
                : await createOfframp(offrampRequestParams)

            if (offrampResponse.error || !offrampResponse.data) {
                throw new Error(offrampResponse.error || 'Failed to create offramp')
            }
            const offrampData = offrampResponse.data as TCreateOfframpResponse
            setLocalBankDetails(account)
            setBankDetails(account)
            setOfframpData(offrampData)

            // claim send link to deposit address received from offramp response
            await handleConfirmClaim(offrampData)
        } catch (e: any) {
            const errorString = ErrorHandler(e)
            setError(errorString)
            Sentry.captureException(e)
        } finally {
            setLoadingState('Idle')
        }
    }

    /**
     * @name handleSuccess
     * @description Callback for when the DynamicBankAccountForm is successfully submitted.
     * It handles different logic based on the bank claim type (guest, user, kyc needed).
     */
    const handleSuccess = async (
        payload: AddBankAccountPayload,
        rawData: IBankAccountDetails
    ): Promise<{ error?: string }> => {
        //clean any error from previous step
        setError(null)

        // scenario 1: receiver needs KYC
        if (bankClaimType === BankClaimType.ReceiverKycNeeded && !justCompletedKyc) {
            // update user's name and email if they are not present
            const hasNameOnLoad = !!user?.user.fullName
            const hasEmailOnLoad = !!user?.user.email
            if (!hasNameOnLoad || !hasEmailOnLoad) {
                if (user?.user.userId && rawData.firstName && rawData.lastName && rawData.email) {
                    const result = await updateUserById({
                        userId: user.user.userId,
                        fullName: `${rawData.firstName} ${rawData.lastName}`.trim(),
                        email: rawData.email,
                    })
                    if (result.error) return { error: result.error }
                    await fetchUser()
                }
            }

            setIsKycModalOpen(true)
            return {}
        }

        // scenario 2: logged-in user is claiming
        if (
            bankClaimType === BankClaimType.UserBankClaim ||
            (bankClaimType === BankClaimType.ReceiverKycNeeded && justCompletedKyc)
        ) {
            if (isProcessingKycSuccess) return {}
            setIsProcessingKycSuccess(true)

            try {
                const addBankAccountResponse = await addBankAccount(payload)
                if (addBankAccountResponse.error) {
                    return { error: addBankAccountResponse.error }
                }
                if (addBankAccountResponse.data?.id) {
                    const bankDetails = {
                        name: addBankAccountResponse.data.details.accountOwnerName || user?.user.fullName || '',
                        iban:
                            addBankAccountResponse.data.type === 'iban'
                                ? addBankAccountResponse.data.identifier || ''
                                : '',
                        clabe:
                            addBankAccountResponse.data.type === 'clabe'
                                ? addBankAccountResponse.data.identifier || ''
                                : '',
                        accountNumber:
                            addBankAccountResponse.data.type === 'us'
                                ? addBankAccountResponse.data.identifier || ''
                                : '',
                        country: addBankAccountResponse.data.details.countryCode,
                        id: addBankAccountResponse.data.id,
                        bridgeAccountId: addBankAccountResponse.data.bridgeAccountId,
                        bic: addBankAccountResponse.data.bic ?? '',
                        routingNumber: addBankAccountResponse.data.routingNumber ?? '',
                        firstName: addBankAccountResponse.data.firstName || rawData.firstName,
                        lastName: addBankAccountResponse.data.lastName || rawData.lastName,
                        email: user?.user.email ?? '',
                        street: '',
                        city: '',
                        state: '',
                        postalCode: '',
                    }
                    setLocalBankDetails(bankDetails)
                    setBankDetails(bankDetails)
                    setReceiverFullName(`${bankDetails.firstName} ${bankDetails.lastName}`)
                    setClaimBankFlowStep(ClaimBankFlowStep.BankConfirmClaim)
                }
            } finally {
                setIsProcessingKycSuccess(false)
            }
            return {}
        }
        // scenario 3: guest user is claiming (using sender's KYC)
        else if (bankClaimType === BankClaimType.GuestBankClaim) {
            if (!selectedCountry) {
                const err = 'Country not selected'
                setError(err)
                return { error: err }
            }

            try {
                setLoadingState('Executing transaction')
                setError(null)
                const senderInfo = await getUserById(claimLinkData.sender?.userId ?? claimLinkData.senderAddress)
                if (!senderInfo || ('error' in senderInfo && senderInfo.error)) {
                    throw new Error(
                        (senderInfo && typeof senderInfo.error === 'string' && senderInfo.error) ||
                            'Failed to get sender info'
                    )
                }
                if (!senderInfo.bridgeCustomerId) throw new Error('Sender bridge customer ID not found')

                const threeLetterCountryCode = getCountryCodeForWithdraw(selectedCountry.id)
                const payloadWithCountry = {
                    ...payload,
                    countryCode: threeLetterCountryCode,
                    address: {
                        ...payload.address,
                        country: threeLetterCountryCode,
                    },
                    country: threeLetterCountryCode,
                }

                const externalAccountResponse = await createBridgeExternalAccountForGuest(
                    senderInfo.bridgeCustomerId,
                    payloadWithCountry
                )
                if ('error' in externalAccountResponse && externalAccountResponse.error) {
                    throw new Error(String(externalAccountResponse.error))
                }
                if (!('id' in externalAccountResponse)) {
                    throw new Error('Failed to create external account')
                }

                // merge the external account details with the user's details
                const finalBankDetails = {
                    id: externalAccountResponse.id,
                    bridgeAccountId: externalAccountResponse.id,
                    name: externalAccountResponse.bank_name ?? rawData.name,
                    firstName: externalAccountResponse.first_name ?? rawData.firstName,
                    lastName: externalAccountResponse.last_name ?? rawData.lastName,
                    email: rawData.email,
                    accountNumber: externalAccountResponse.account_number ?? rawData.accountNumber,
                    bic: externalAccountResponse?.iban?.bic ?? rawData.bic,
                    routingNumber: externalAccountResponse?.account?.routing_number ?? rawData.routingNumber,
                    clabe: externalAccountResponse?.clabe?.account_number ?? rawData.clabe,
                    street: externalAccountResponse?.address?.street_line_1 ?? rawData.street,
                    city: externalAccountResponse?.address?.city ?? rawData.city,
                    state: externalAccountResponse?.address?.state ?? rawData.state,
                    postalCode: externalAccountResponse?.address?.postal_code ?? rawData.postalCode,
                    iban: externalAccountResponse?.iban?.account_number ?? rawData.iban,
                    country: externalAccountResponse?.iban?.country ?? rawData.country,
                }
                setLocalBankDetails(finalBankDetails)
                setBankDetails(finalBankDetails)
                setReceiverFullName(payload.accountOwnerName.firstName + ' ' + payload.accountOwnerName.lastName)
                setClaimBankFlowStep(ClaimBankFlowStep.BankConfirmClaim)
                return {}
            } catch (e: any) {
                const errorString = ErrorHandler(e)
                Sentry.captureException(e)
                return { error: errorString }
            } finally {
                setLoadingState('Idle')
            }
        }
        return {}
    }

    /**
     * @name handleKycSuccess
     * @description callback for when the KYC process is successfully completed.
     */
    const handleKycSuccess = useCallback(async () => {
        if (justCompletedKyc) return

        setIsKycModalOpen(false)
        await fetchUser()
        setJustCompletedKyc(true)
        setClaimBankFlowStep(ClaimBankFlowStep.BankDetailsForm)
    }, [fetchUser, setClaimBankFlowStep, setIsKycModalOpen, setJustCompletedKyc, justCompletedKyc])

    // main render logic based on the current flow step
    switch (claimBankFlowStep) {
        case ClaimBankFlowStep.SavedAccountsList:
            return (
                <SavedAccountsView
                    pageTitle="Receive"
                    onPrev={() => setClaimBankFlowStep(null)}
                    savedAccounts={savedAccounts}
                    onAccountClick={async (account) => {
                        const [firstName, ...lastNameParts] = (
                            account.details.accountOwnerName ||
                            user?.user.fullName ||
                            ''
                        ).split(' ')
                        const lastName = lastNameParts.join(' ')

                        const bankDetails = {
                            name: account.details.accountOwnerName || user?.user.fullName || '',
                            iban: account.type === 'iban' ? account.identifier || '' : '',
                            clabe: account.type === 'clabe' ? account.identifier || '' : '',
                            accountNumber: account.type === 'us' ? account.identifier || '' : '',
                            country: account.details.countryCode,
                            id: account.id,
                            bridgeAccountId: account.bridgeAccountId,
                            bic: account.bic ?? '',
                            routingNumber: account.routingNumber ?? '',
                            firstName: firstName,
                            lastName: lastName,
                            email: user?.user.email ?? '',
                            street: '',
                            city: '',
                            state: '',
                            postalCode: '',
                        }

                        setLocalBankDetails(bankDetails)
                        setBankDetails(bankDetails)

                        const isGuestFlow = bankClaimType === BankClaimType.GuestBankClaim
                        const userForOfframp = isGuestFlow
                            ? await getUserById(claimLinkData.sender?.userId ?? claimLinkData.senderAddress)
                            : user?.user
                        if (userForOfframp && !('error' in userForOfframp) && !isGuestFlow) {
                            setReceiverFullName(userForOfframp.fullName ?? '')
                        }

                        setClaimBankFlowStep(ClaimBankFlowStep.BankConfirmClaim)
                    }}
                    onSelectNewMethodClick={() => {
                        setClaimBankFlowStep(ClaimBankFlowStep.BankCountryList)
                    }}
                />
            )
        case ClaimBankFlowStep.BankCountryList:
            return (
                <CountryListRouter
                    flow="claim"
                    claimLinkData={claimLinkData}
                    inputTitle="Which country do you want to receive to?"
                />
            )
        case ClaimBankFlowStep.BankDetailsForm:
            return (
                <div className="flex min-h-[inherit] flex-col justify-between gap-8 md:min-h-fit">
                    <div>
                        <NavHeader
                            title="Receive"
                            onPrev={() => {
                                dispatch(bankFormActions.clearFormData()) // clear DynamicBankAccountForm data
                                savedAccounts.length > 0
                                    ? setClaimBankFlowStep(ClaimBankFlowStep.SavedAccountsList)
                                    : setClaimBankFlowStep(ClaimBankFlowStep.BankCountryList)
                            }}
                        />
                    </div>
                    <DynamicBankAccountForm
                        ref={formRef}
                        key={selectedCountry?.id}
                        country={getCountryCodeForWithdraw(selectedCountry?.id ?? '')}
                        countryName={selectedCountry?.title ?? ''}
                        onSuccess={handleSuccess}
                        flow={'claim'}
                        hideEmailInput={bankClaimType === BankClaimType.GuestBankClaim}
                        actionDetailsProps={{
                            transactionType: 'CLAIM_LINK_BANK_ACCOUNT',
                            recipientType: 'BANK_ACCOUNT',
                            amount: formatTokenAmount(
                                Number(formatUnits(claimLinkData.amount, claimLinkData.tokenDecimals))
                            )!,
                            tokenSymbol: claimLinkData.tokenSymbol,
                        }}
                        initialData={{}}
                        error={error}
                    />
                    <InitiateBridgeKYCModal
                        isOpen={isKycModalOpen}
                        onClose={() => setIsKycModalOpen(false)}
                        onKycSuccess={handleKycSuccess}
                    />
                </div>
            )
        case ClaimBankFlowStep.BankConfirmClaim:
            if (localBankDetails) {
                return (
                    <ConfirmBankClaimView
                        claimLinkData={claimLinkData}
                        onConfirm={() => handleCreateOfframpAndClaim(localBankDetails)}
                        onBack={() => {
                            setClaimBankFlowStep(
                                savedAccounts.length > 0
                                    ? ClaimBankFlowStep.SavedAccountsList
                                    : ClaimBankFlowStep.BankDetailsForm
                            )
                            setError(null)
                        }}
                        isProcessing={isLoading}
                        error={error}
                        bankDetails={localBankDetails}
                        fullName={receiverFullName}
                    />
                )
            }
            return null
        default:
            return null
    }
}
