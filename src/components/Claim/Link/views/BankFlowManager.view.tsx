'use client'

import { type IClaimScreenProps } from '../../Claim.consts'
import { DynamicBankAccountForm, type IBankAccountDetails } from '@/components/AddWithdraw/DynamicBankAccountForm'
import { ClaimBankFlowStep, useClaimBankFlow } from '@/context/ClaimBankFlowContext'
import { useCallback, useContext, useMemo, useState, useRef } from 'react'
import { loadingStateContext } from '@/context/loadingStates.context'
import { createBridgeExternalAccountForGuest } from '@/app/actions/external-accounts'
import { confirmOfframp, createOfframp, createOfframpForGuest } from '@/app/actions/offramp'
import { type Address, formatUnits } from 'viem'
import { useFriendlyError } from '@/hooks/useFriendlyError'
import { formatTokenAmount } from '@/utils/general.utils'
import * as Sentry from '@sentry/nextjs'
import useClaimLink from '../../useClaimLink'
import { type AddBankAccountPayload } from '@/app/actions/types/users.types'
import { useAuth } from '@/context/authContext'
import { type TCreateOfframpRequest, type TCreateOfframpResponse } from '@/services/services.types'
import { getOfframpConfigFromAccount } from '@/utils/bridge.utils'
import { getBridgeChainName, getBridgeTokenName } from '@/utils/bridge-accounts.utils'
import { generateKeysFromString, getParamsFromLink } from '@/utils/peanut-link.utils'
import { getContractAddress } from '@/utils/peanut-claim.utils'
import { addBankAccount, getUserById } from '@/app/actions/users'
import SavedAccountsView from '../../../Common/SavedAccountsView'
import { BankClaimType, useDetermineBankClaimType } from '@/hooks/useDetermineBankClaimType'
import useSavedAccounts from '@/hooks/useSavedAccounts'
import { ConfirmBankClaimView } from './Confirm.bank-claim.view'
import { CountryListRouter } from '@/components/Common/CountryListRouter'
import NavHeader from '@/components/Global/NavHeader'
import { getCountryCodeForWithdraw } from '@/utils/withdraw.utils'
import { useAppDispatch } from '@/redux/hooks'
import { bankFormActions } from '@/redux/slices/bank-form-slice'
import { sendLinksApi } from '@/services/sendLinks'
import { useSearchParams } from 'next/navigation'
import { useMultiPhaseKycFlow } from '@/hooks/useMultiPhaseKycFlow'
import { getRegionIntent } from '@/utils/regions.utils'
import { SumsubKycModals } from '@/components/Kyc/SumsubKycModals'
import { useCapabilities } from '@/hooks/useCapabilities'
import { getKycModalVariant, getGateUserMessage } from '@/utils/capability-gate'
import { useTosGuard } from '@/hooks/useTosGuard'
import { BridgeTosStep } from '@/components/Kyc/BridgeTosStep'
import { InitiateKycModal } from '@/components/Kyc/InitiateKycModal'
import { useModalsContext } from '@/context/ModalsContext'
import { useTranslations } from 'next-intl'

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
    const t = useTranslations('claim')
    const toFriendlyError = useFriendlyError()
    // props and basic setup
    const { onCustom, claimLinkData, setTransactionHash } = props
    const { user, fetchUser } = useAuth()

    // get campaign tag from claim link url for badge assignment
    const params = useSearchParams()
    const campaignTag = params.get('campaignTag')

    // state from the centralized context
    const {
        flowStep: claimBankFlowStep,
        setFlowStep: setClaimBankFlowStep,
        selectedCountry,
        setClaimType,
        setBankDetails,
        justCompletedKyc,
        setJustCompletedKyc,
        setShowVerificationModal: setIsKycModalOpen,
    } = useClaimBankFlow()

    // hooks for business logic and data fetching
    const { claimType: bankClaimType } = useDetermineBankClaimType(claimLinkData.sender?.userId ?? '')
    const savedAccounts = useSavedAccounts()
    const { isLoading, setLoadingState } = useContext(loadingStateContext)
    const { claimLink } = useClaimLink()
    const dispatch = useAppDispatch()
    // Provider-blind bank-rail gate via the canonical `useCapabilities().gateFor`
    // primitive. The bank-claim gate only fires for logged-in users (guest claims
    // leverage the sender's KYC and bypass `gate` entirely below), so this reads
    // the *claimer's* own capabilities. See utils/capability-gate.ts.
    const { gateFor } = useCapabilities()
    const gate = useMemo(() => gateFor('deposit', { channel: 'bank' }), [gateFor])
    const { guardWithTos, showBridgeTos, hideTos } = useTosGuard()
    const [showKycModal, setShowKycModal] = useState(false)
    const { setIsSupportModalOpen } = useModalsContext()

    // inline sumsub kyc flow for users who need verification
    // regionIntent is NOT passed here to avoid creating a backend record on mount.
    // intent is passed at call time, derived from the destination country.
    const sumsubFlow = useMultiPhaseKycFlow({
        onKycSuccess: async () => {
            if (justCompletedKyc) return
            setIsKycModalOpen(false)
            await fetchUser()
            setJustCompletedKyc(true)
            setClaimBankFlowStep(ClaimBankFlowStep.BankDetailsForm)
        },
        onManualClose: () => setIsKycModalOpen(false),
    })

    // local states for this component
    const [localBankDetails, setLocalBankDetails] = useState<BankAccountWithId | null>(null)
    const [receiverFullName, setReceiverFullName] = useState<string>('')
    const [error, setError] = useState<string | null>(null)
    const formRef = useRef<{ handleSubmit: () => void }>(null)
    const [isProcessingKycSuccess, setIsProcessingKycSuccess] = useState(false)
    const [_offrampData, setOfframpData] = useState<TCreateOfframpResponse | null>(null)

    /**
     * @name handleConfirmClaim
     * @description claims the link to the deposit address provided by the off-ramp api and confirms the transfer.
     */
    const handleConfirmClaim = useCallback(
        async (details: TCreateOfframpResponse) => {
            // Track whether the on-chain claim already succeeded. Once true, a
            // failure of the subsequent confirmOfframp() must NOT bubble back to
            // ConfirmBankClaimView as a retryable error — `onConfirm` would call
            // claimLink() again and try to send funds twice (Sentry PEANUT-UI-QH9).
            let claimTxSubmitted = false
            try {
                const claimTx = await claimLink({
                    address: details.depositInstructions.toAddress,
                    link: claimLinkData.link,
                    campaignTag: campaignTag ?? undefined, // badge assignment: pass campaign tag
                })

                if (!claimTx) {
                    throw new Error('Failed to claim link - no transaction hash returned')
                }
                claimTxSubmitted = true

                // if a user is logged in, associate the claim with their account.
                // this helps track their activity correctly.
                if (user) {
                    try {
                        await sendLinksApi.associateClaim(claimTx)
                    } catch (e) {
                        Sentry.captureException(e)
                        console.error('Failed to associate claim', e)
                    }
                }
                setTransactionHash(claimTx)

                try {
                    await confirmOfframp(details.transferId, claimTx)
                } catch (confirmErr: any) {
                    // On-chain claim already executed; the BE has the transfer row
                    // and Bridge will process the deposit. Log + fall through to the
                    // SUCCESS view rather than throwing — re-confirming retries are
                    // safe to drop since the BE poller/webhook will reconcile.
                    Sentry.captureException(confirmErr)
                    console.error('confirmOfframp failed after on-chain claim succeeded', confirmErr)
                }

                if (setClaimType) setClaimType('claim-bank')
                onCustom('SUCCESS')
            } catch (e: any) {
                if (claimTxSubmitted) {
                    // Defensive: even if a post-claim step throws (e.g.
                    // setClaimType), do not surface a retryable error — the funds
                    // are already on-chain. Log + show SUCCESS.
                    Sentry.captureException(e)
                    onCustom('SUCCESS')
                    return
                }
                const errorString = toFriendlyError(e)
                setError(errorString)
                Sentry.captureException(e)
                throw e
            }
        },
        [claimLink, claimLinkData.link, setTransactionHash, setClaimType, onCustom, user, campaignTag, toFriendlyError]
    )

    /**
     * @name handleCreateOfframpAndClaim
     * @description creates an off-ramp transfer for the user, either as a guest or a logged-in user.
     */
    const handleCreateOfframpAndClaim = async (account: BankAccountWithId) => {
        try {
            setError(null)

            // for logged-in users, check bank-rail readiness before proceeding
            const isGuestFlow = bankClaimType === BankClaimType.GuestBankClaim
            if (!isGuestFlow && gate.kind !== 'ready') {
                // capabilities still loading OR provider doing internal review —
                // silently return; the CTA that triggered this should be disabled
                // too, but defend against double-click races. `waiting-on-provider`
                // means there's no user action to take (Bridge KYC review,
                // post_processing), so opening the KYC modal would falsely imply
                // the user has something to do.
                if (gate.kind === 'loading' || gate.kind === 'waiting-on-provider') return
                if (gate.kind === 'accept-tos') {
                    guardWithTos()
                } else {
                    setShowKycModal(true)
                }
                return
            }

            setLoadingState('Executing transaction')
            // Guest flow off-ramps on the link SENDER's behalf — fetch the counterparty
            // and check the provider-agnostic capability the BE exposes for them
            // (`canReceiveBankOfframp`, i.e. an enabled Bridge bank rail). Replaces the
            // raw `bridgeKycStatus === 'approved'` read; the FE never sees provider KYC.
            // Logged-in flow uses the current user, whose readiness is already enforced
            // above via `gate.kind !== 'ready'` (capability model).
            const guestSender = isGuestFlow
                ? await getUserById(claimLinkData.sender?.userId ?? claimLinkData.senderAddress)
                : null
            if (isGuestFlow) {
                if (!guestSender) throw new Error('Failed to get user info')
                if (!guestSender.canReceiveBankOfframp) throw new Error('Sender cannot receive a bank off-ramp')
            }

            const userForOfframp = isGuestFlow ? guestSender : user?.user
            if (!userForOfframp) throw new Error('Failed to get user info')
            if (!userForOfframp.bridgeCustomerId) throw new Error('User bridge customer ID not found')

            // get payment rail and currency for the offramp
            const paymentRail = getBridgeChainName(claimLinkData.chainId)
            const currency = getBridgeTokenName(claimLinkData.chainId, claimLinkData.tokenAddress)
            if (!paymentRail || !currency) throw new Error('Chain or token not supported for bank withdrawal')

            // get params from send link
            const params = getParamsFromLink(claimLinkData.link)
            const { address: pubKey } = generateKeysFromString(params.password)
            const chainId = params.chainId
            const contractVersion = params.contractVersion
            const peanutContractAddress = getContractAddress(chainId, contractVersion) as Address

            const externalAccountId = (account.bridgeAccountId ?? account.id) as string

            // Derive destination currency + rail from the SELECTED ACCOUNT's
            // type, not from `selectedCountry`. Pairing a GB/GBP account with
            // a SEPA destination is semantically impossible — Bridge rejects
            // with "country is not supported for SEPA" (PEANUT-API-5P/5M/5N
            // on 2026-06-02). The account's `type` already carries the right
            // answer for every Bridge destination we support.
            const destination = getOfframpConfigFromAccount(account)

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
                // travel rule: pass claimer details for third-party guest claims
                ...(isGuestFlow &&
                    account.firstName &&
                    account.lastName && {
                        beneficiaryName: `${account.firstName} ${account.lastName}`,
                        ...(account.street &&
                            account.city &&
                            account.country && {
                                beneficiaryAddress: {
                                    street: account.street,
                                    city: account.city,
                                    country: account.country,
                                    state: account.state || undefined,
                                    postalCode: account.postalCode || undefined,
                                },
                            }),
                    }),
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
            const errorString = toFriendlyError(e)
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
        // name and email are now collected by sumsub sdk — no need to save them beforehand
        if (bankClaimType === BankClaimType.ReceiverKycNeeded && !justCompletedKyc) {
            await sumsubFlow.handleInitiateKyc(
                getRegionIntent(selectedCountry?.region ?? 'rest-of-the-world'),
                undefined,
                undefined,
                selectedCountry?.id
            )
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
                        // carry the account type so getOfframpConfigFromAccount() derives
                        // the rail from it (GB→GBP) instead of falling back to country
                        type: addBankAccountResponse.data.type,
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
                            addBankAccountResponse.data.type === 'us' || addBankAccountResponse.data.type === 'gb'
                                ? addBankAccountResponse.data.identifier || ''
                                : '',
                        country: addBankAccountResponse.data.details?.countryCode ?? '',
                        id: addBankAccountResponse.data.id,
                        bridgeAccountId: addBankAccountResponse.data.bridgeAccountId,
                        bic: addBankAccountResponse.data.bic ?? '',
                        routingNumber: addBankAccountResponse.data.routingNumber ?? '',
                        sortCode: addBankAccountResponse.data.sortCode ?? '',
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
                } else {
                    return { error: t('bank.processAccountFailed') }
                }
            } finally {
                setIsProcessingKycSuccess(false)
            }
            return {}
        }
        // scenario 3: guest user is claiming (using sender's KYC)
        else if (bankClaimType === BankClaimType.GuestBankClaim) {
            if (!selectedCountry) {
                const err = t('bank.countryNotSelected')
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
                    // The backend returns a curated, user-facing message for bank-account
                    // validation failures (e.g. an unverifiable billing address). Surface it
                    // verbatim — routing it through the friendly-error mapper would collapse it into the
                    // generic "contact support" fallback, hiding the actionable detail. (TASK-20194)
                    const accountError = String(externalAccountResponse.error)
                    Sentry.captureException(new Error(`External account creation failed: ${accountError}`))
                    return { error: accountError }
                }
                if (!('id' in externalAccountResponse)) {
                    throw new Error('Failed to create external account')
                }

                // merge the external account details with the user's details
                const finalBankDetails = {
                    // derive the account type from the response shape so
                    // getOfframpConfigFromAccount() routes by rail (GB sort_code → gb)
                    // instead of falling back to country
                    type: externalAccountResponse?.iban
                        ? 'iban'
                        : externalAccountResponse?.clabe
                          ? 'clabe'
                          : externalAccountResponse?.account?.sort_code
                            ? 'gb'
                            : externalAccountResponse?.account
                              ? 'us'
                              : undefined,
                    id: externalAccountResponse.id,
                    bridgeAccountId: externalAccountResponse.id,
                    name: externalAccountResponse.bank_name ?? rawData.name,
                    firstName: externalAccountResponse.first_name ?? rawData.firstName,
                    lastName: externalAccountResponse.last_name ?? rawData.lastName,
                    email: rawData.email,
                    accountNumber: externalAccountResponse.account_number ?? rawData.accountNumber,
                    bic: externalAccountResponse?.iban?.bic ?? rawData.bic,
                    routingNumber: externalAccountResponse?.account?.routing_number ?? rawData.routingNumber,
                    sortCode: externalAccountResponse?.account?.sort_code ?? rawData.sortCode ?? '',
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
                const errorString = toFriendlyError(e)
                Sentry.captureException(e)
                return { error: errorString }
            } finally {
                setLoadingState('Idle')
            }
        }
        return {}
    }

    // main render logic based on the current flow step
    switch (claimBankFlowStep) {
        case ClaimBankFlowStep.SavedAccountsList:
            return (
                <SavedAccountsView
                    pageTitle={t('receive')}
                    onPrev={() => setClaimBankFlowStep(null)}
                    savedAccounts={savedAccounts}
                    onAccountClick={async (account) => {
                        // for saved accounts, use the user's full name (these are assumed to be user's own accounts)
                        const fullNameToUse = user?.user.fullName || ''
                        const [firstName, ...lastNameParts] = fullNameToUse.split(' ')
                        const lastName = lastNameParts.join(' ')

                        const bankDetails = {
                            // carry the account type so getOfframpConfigFromAccount()
                            // derives the rail from it instead of falling back to country
                            type: account.type,
                            name: account.details?.accountOwnerName || user?.user.fullName || '',
                            iban: account.type === 'iban' ? account.identifier || '' : '',
                            clabe: account.type === 'clabe' ? account.identifier || '' : '',
                            accountNumber:
                                account.type === 'us' || account.type === 'gb' ? account.identifier || '' : '',
                            country: account.details?.countryCode ?? '',
                            id: account.id,
                            bridgeAccountId: account.bridgeAccountId,
                            bic: account.bic ?? '',
                            routingNumber: account.routingNumber ?? '',
                            sortCode: account.sortCode ?? '',
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
            return <CountryListRouter claimLinkData={claimLinkData} inputTitle={t('bank.selectCountry')} />
        case ClaimBankFlowStep.BankDetailsForm:
            return (
                <div className="flex min-h-[inherit] flex-col justify-between gap-8 md:min-h-fit">
                    <div>
                        <NavHeader
                            title={t('receive')}
                            onPrev={() => {
                                dispatch(bankFormActions.clearFormData()) // clear DynamicBankAccountForm data
                                if (savedAccounts.length > 0) {
                                    setClaimBankFlowStep(ClaimBankFlowStep.SavedAccountsList)
                                } else {
                                    setClaimBankFlowStep(ClaimBankFlowStep.BankCountryList)
                                }
                            }}
                        />
                    </div>
                    <DynamicBankAccountForm
                        ref={formRef}
                        key={selectedCountry?.id}
                        country={getCountryCodeForWithdraw(selectedCountry?.id ?? '')}
                        countryName={selectedCountry?.path ?? ''}
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
                    <SumsubKycModals flow={sumsubFlow} />
                </div>
            )
        case ClaimBankFlowStep.BankConfirmClaim:
            if (localBankDetails) {
                return (
                    <>
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
                        <BridgeTosStep
                            visible={showBridgeTos}
                            onComplete={() => {
                                hideTos()
                                handleCreateOfframpAndClaim(localBankDetails)
                            }}
                            onSkip={hideTos}
                            reasonCode={gate.kind === 'accept-tos' ? gate.reason?.code : undefined}
                        />
                        <InitiateKycModal
                            visible={showKycModal}
                            onClose={() => setShowKycModal(false)}
                            onVerify={async () => {
                                if (gate.kind === 'restart-identity') {
                                    await sumsubFlow.handleRestartIdentity()
                                } else if (gate.kind === 'fixable-rejection') {
                                    await sumsubFlow.handleSelfHealResubmit('BRIDGE')
                                } else {
                                    await sumsubFlow.handleInitiateKyc(
                                        getRegionIntent(selectedCountry?.region ?? 'rest-of-the-world'),
                                        undefined,
                                        gate.kind === 'needs-enrollment' || undefined,
                                        selectedCountry?.id
                                    )
                                }
                                // only close if sdk opened — if it errored, keep modal open to show error
                                if (sumsubFlow.showWrapper) setShowKycModal(false)
                            }}
                            onContactSupport={() => {
                                setShowKycModal(false)
                                setIsSupportModalOpen(true)
                            }}
                            isLoading={sumsubFlow.isLoading}
                            error={sumsubFlow.error}
                            variant={getKycModalVariant(gate.kind)}
                            providerMessage={getGateUserMessage(gate)}
                        />
                    </>
                )
            }
            return null
        default:
            return null
    }
}
