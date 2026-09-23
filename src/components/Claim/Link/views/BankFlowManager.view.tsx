'use client'

import { type IClaimScreenProps } from '../../Claim.consts'
import { DynamicBankAccountForm, type IBankAccountDetails } from '@/components/AddWithdraw/DynamicBankAccountForm'
import { ClaimBankFlowStep, useClaimBankFlow } from '@/context/ClaimBankFlowContext'
import { useCallback, useContext, useMemo, useState, useRef } from 'react'
import { loadingStateContext } from '@/context/loadingStates.context'
import { createGuestClaimExternalAccount } from '@/app/actions/external-accounts'
import { confirmOfframp, createOfframp, createOfframpForGuest } from '@/app/actions/offramp'
import { type Address, formatUnits } from 'viem'
import { useFriendlyError } from '@/hooks/useFriendlyError'
import { formatTokenAmount } from '@/utils/general.utils'
import * as Sentry from '@sentry/nextjs'
import useClaimLink from '../../useClaimLink'
import { type AddBankAccountPayload } from '@/app/actions/types/users.types'
import { useAuth } from '@/context/authContext'
import {
    type TCreateGuestOfframpRequest,
    type TCreateOfframpRequest,
    type TCreateOfframpResponse,
} from '@/services/services.types'
import {
    getBankRailCountryFromAccount,
    getBridgeRailIdFromAccount,
    getCountryFromAccount,
    getOfframpConfigFromAccount,
} from '@/utils/bridge.utils'
import { getBridgeChainName, getBridgeTokenName } from '@/utils/bridge-accounts.utils'
import { generateKeysFromString, getParamsFromLink } from '@/utils/peanut-link.utils'
import { getContractAddress } from '@/utils/peanut-claim.utils'
import { addBankAccount } from '@/app/actions/users'
import SavedAccountsView from '../../../Common/SavedAccountsView'
import { BankClaimType, useDetermineBankClaimType } from '@/hooks/useDetermineBankClaimType'
import useSavedAccounts from '@/hooks/useSavedAccounts'
import { ConfirmBankClaimView } from './Confirm.bank-claim.view'
import { CountryListRouter } from '@/components/Common/CountryListRouter'
import NavHeader from '@/components/Global/NavHeader'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { getCountryCodeForWithdraw } from '@/utils/withdraw.utils'
import { sendLinksApi } from '@/services/sendLinks'
import { useSearchParams } from 'next/navigation'
import { useMultiPhaseKycFlow } from '@/hooks/useMultiPhaseKycFlow'
import { useBankRegionIntent } from '@/hooks/useBankRegionIntent'
import { useResidenceRestrictions } from '@/hooks/useResidenceRestrictions'
import { SumsubKycModals } from '@/components/Kyc/SumsubKycModals'
import { useCapabilities } from '@/hooks/useCapabilities'
import { getKycModalVariant, getGateUserMessage, getGateReasonCode } from '@/utils/capability-gate'
import { useTosGuard } from '@/hooks/useTosGuard'
import { BridgeTosStep } from '@/components/Kyc/BridgeTosStep'
import { InitiateKycModal } from '@/components/Kyc/InitiateKycModal'
import { useModalsContext } from '@/context/ModalsContext'
import { useTranslations } from 'next-intl'
import { badgeCampaignForLegacyWire } from '@/components/Invites/badge-campaign-context'
import {
    guestBankAccountMessage,
    guestBankClaimMessage,
    accountOwnerNameOf,
    guestClaimErrorKind,
    getSendLinkPubKey,
    signWithLinkKey,
} from '@/utils/guest-claim.utils'

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
    // A refused guest claim has a stable code; show its copy, else the API's message.
    const guestClaimError = (response: { error?: string; code?: string; status?: number }) => {
        const kind = guestClaimErrorKind(response.code, response.status)
        return kind ? t(`bank.guestErrors.${kind}`) : (response.error ?? t('bank.processAccountFailed'))
    }
    // props and basic setup
    const { onCustom, claimLinkData, setTransactionHash } = props
    const { user, fetchUser } = useAuth()
    const campaignTag = badgeCampaignForLegacyWire(useSearchParams())

    // state from the centralized context
    const {
        flowStep: claimBankFlowStep,
        setFlowStep: setClaimBankFlowStep,
        selectedCountry,
        setSelectedCountry,
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
    // Provider-blind bank-rail gate via the canonical `useCapabilities().gateFor`
    // primitive. The bank-claim gate only fires for logged-in users (guest claims
    // leverage the sender's KYC and bypass `gate` entirely below), so this reads
    // the *claimer's* own capabilities. See utils/capability-gate.ts.
    const { gateFor } = useCapabilities()
    const bankRegionIntent = useBankRegionIntent()
    const { banking: isBankRestricted } = useResidenceRestrictions()
    // local states for this component
    const [localBankDetails, setLocalBankDetails] = useState<BankAccountWithId | null>(null)
    const [receiverFullName, setReceiverFullName] = useState<string>('')
    const [error, setError] = useState<string | null>(null)
    const formRef = useRef<{ handleSubmit: () => void }>(null)
    const [isProcessingKycSuccess, setIsProcessingKycSuccess] = useState(false)
    const [_offrampData, setOfframpData] = useState<TCreateOfframpResponse | null>(null)

    const destinationAccount =
        localBankDetails ?? (selectedCountry ? { country: selectedCountry.iso2 ?? selectedCountry.id } : undefined)
    const bankRailCountry = useMemo(
        () => (destinationAccount ? getBankRailCountryFromAccount(destinationAccount) : undefined),
        [destinationAccount]
    )
    const bridgeRailId = useMemo(
        () => (destinationAccount ? getBridgeRailIdFromAccount(destinationAccount) : undefined),
        [destinationAccount]
    )
    const gate = useMemo(
        // Claiming a send link to a bank creates an OFFRAMP. A deposit gate can
        // disagree with withdraw on the same rail and another provider's ready
        // rail must not authorize a Bridge call.
        () => gateFor('withdraw', { railId: bridgeRailId ?? 'bridge.unsupported_bank_rail' }),
        [bridgeRailId, gateFor]
    )
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
                    campaignTag: campaignTag ?? undefined,
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

                // Confirm needs a session, which a guest does not have. The BE
                // poller/webhook completes a guest's transfer from Bridge's side.
                if (bankClaimType !== BankClaimType.GuestBankClaim) {
                    try {
                        await confirmOfframp(details.transferId, claimTx)
                    } catch (confirmErr) {
                        // On-chain claim already executed; the BE has the transfer row
                        // and Bridge will process the deposit. Log + fall through to the
                        // SUCCESS view rather than throwing — re-confirming retries are
                        // safe to drop since the BE poller/webhook will reconcile.
                        Sentry.captureException(confirmErr)
                        console.error('confirmOfframp failed after on-chain claim succeeded', confirmErr)
                    }
                }

                if (setClaimType) setClaimType('claim-bank')
                onCustom('SUCCESS')
            } catch (e) {
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
        [
            claimLink,
            claimLinkData.link,
            setTransactionHash,
            setClaimType,
            onCustom,
            user,
            campaignTag,
            toFriendlyError,
            bankClaimType,
        ]
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
            const destination = { ...getOfframpConfigFromAccount(account), externalAccountId }
            const source = { paymentRail, currency, fromAddress: peanutContractAddress }
            const amount = formatUnits(claimLinkData.amount, claimLinkData.tokenDecimals)

            let offrampResponse: Awaited<ReturnType<typeof createOfframpForGuest>>
            if (isGuestFlow) {
                // Guest flow off-ramps on the link SENDER's behalf. The API finds
                // the sender from the link; the link key's signature is the
                // authorization, so the sender's identity never reaches this device.
                const guestRequest: TCreateGuestOfframpRequest = {
                    amount,
                    sendLinkPubKey: pubKey,
                    signature: await signWithLinkKey(
                        claimLinkData.link,
                        guestBankClaimMessage(pubKey, externalAccountId)
                    ),
                    source,
                    destination,
                    // travel rule: the guest claimer — the account owner — is the beneficiary
                    beneficiaryName: account.accountOwnerName || accountOwnerNameOf(account),
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
                }
                offrampResponse = await createOfframpForGuest(guestRequest)
                if (offrampResponse.error || !offrampResponse.data) {
                    setError(guestClaimError(offrampResponse))
                    return
                }
            } else {
                const userForOfframp = user?.user
                if (!userForOfframp) throw new Error('Failed to get user info')
                if (!userForOfframp.bridgeCustomerId) throw new Error('User bridge customer ID not found')
                const offrampRequestParams: TCreateOfframpRequest = {
                    onBehalfOf: userForOfframp.bridgeCustomerId,
                    amount,
                    userId: userForOfframp.userId,
                    sendLinkPubKey: pubKey,
                    source,
                    destination,
                    features: { allowAnyFromAddress: true },
                }
                offrampResponse = await createOfframp(offrampRequestParams)
            }

            if (offrampResponse.error || !offrampResponse.data) {
                throw new Error(offrampResponse.error || 'Failed to create offramp')
            }
            const offrampData = offrampResponse.data as TCreateOfframpResponse
            setLocalBankDetails(account)
            setBankDetails(account)
            setOfframpData(offrampData)

            // claim send link to deposit address received from offramp response
            await handleConfirmClaim(offrampData)
        } catch (e) {
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
    // Defined once and rendered by both the form and confirm steps: the direct
    // claim path refuses inside handleSuccess, and the modal has to exist where
    // that refusal happens or the submit is a silent no-op.
    const kycModal = (
        <>
            <InitiateKycModal
                cooldownActive={!!sumsubFlow.errorCooldown}
                visible={showKycModal}
                onClose={() => setShowKycModal(false)}
                onVerify={async () => {
                    if (gate.kind === 'restart-identity') {
                        await sumsubFlow.handleRestartIdentity()
                    } else if (gate.kind === 'fixable-rejection') {
                        // Through the shared router: it sends a residence park to
                        // the address step and everything else to resubmit as before.
                        await sumsubFlow.handleFixableGate('BRIDGE', gate)
                    } else {
                        await sumsubFlow.handleInitiateKyc(
                            bankRegionIntent(bankRailCountry ?? selectedCountry),
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
                reasonCode={getGateReasonCode(gate)}
            />
            <SumsubKycModals flow={sumsubFlow} onCooldownClose={() => setShowKycModal(false)} />
        </>
    )

    const handleSuccess = async (
        payload: AddBankAccountPayload,
        rawData: IBankAccountDetails
    ): Promise<{ error?: string }> => {
        //clean any error from previous step
        setError(null)

        // scenario 1: receiver needs KYC
        // name and email are now collected by sumsub sdk — no need to save them beforehand
        if (bankClaimType === BankClaimType.ReceiverKycNeeded && !justCompletedKyc) {
            // This branch opens the SDK without going through InitiateKycModal, so
            // the residence choke point never sees it. A ROW intent still mints a
            // general-level token, which is a verification this residence cannot
            // turn into a bank rail — hand it to the modal for the honest ending.
            if (isBankRestricted) {
                setShowKycModal(true)
                return {}
            }
            await sumsubFlow.handleInitiateKyc(
                bankRegionIntent(bankRailCountry ?? selectedCountry),
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

                const threeLetterCountryCode = getCountryCodeForWithdraw(selectedCountry.id)
                const payloadWithCountry = {
                    ...payload,
                    countryCode: threeLetterCountryCode,
                    // Only the corridors that carry a beneficiary address have one.
                    ...(payload.address && {
                        address: { ...payload.address, country: threeLetterCountryCode },
                    }),
                    country: threeLetterCountryCode,
                }

                // The account is created on the link sender's Bridge customer. The
                // API resolves it from the link, so no sender id is sent from here.
                const sendLinkPubKey = getSendLinkPubKey(claimLinkData.link)
                const externalAccountResponse = await createGuestClaimExternalAccount(
                    sendLinkPubKey,
                    await signWithLinkKey(claimLinkData.link, guestBankAccountMessage(sendLinkPubKey)),
                    payloadWithCountry
                )
                if ('error' in externalAccountResponse) {
                    // The backend returns a curated, user-facing message for bank-account
                    // validation failures (e.g. an unverifiable billing address). Surface it
                    // verbatim — routing it through the friendly-error mapper would collapse it into the
                    // generic "contact support" fallback, hiding the actionable detail. (TASK-20194)
                    Sentry.captureException(
                        new Error(`External account creation failed: ${externalAccountResponse.error}`)
                    )
                    return { error: guestClaimError(externalAccountResponse) }
                }

                // The API shows a guest only the account id and type; the rest of
                // the details are the ones the guest just typed.
                const finalBankDetails = {
                    ...rawData,
                    // the account type routes the offramp (GB sort code → gb) instead of the country
                    type: externalAccountResponse.account_type,
                    id: externalAccountResponse.id,
                    bridgeAccountId: externalAccountResponse.id,
                    name: externalAccountResponse.bank_name ?? rawData.name,
                    // the owner as the provider records it — a business name for a business
                    accountOwnerName: accountOwnerNameOf(payload.accountOwnerName),
                }
                setLocalBankDetails(finalBankDetails)
                setBankDetails(finalBankDetails)
                setReceiverFullName(payload.accountOwnerName.firstName + ' ' + payload.accountOwnerName.lastName)
                setClaimBankFlowStep(ClaimBankFlowStep.BankConfirmClaim)
                return {}
            } catch (e) {
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
                        const resolvedCountry = getCountryFromAccount(account)
                        if (resolvedCountry) setSelectedCountry(resolvedCountry)

                        if (bankClaimType !== BankClaimType.GuestBankClaim && user?.user) {
                            setReceiverFullName(user.user.fullName ?? '')
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
                <PageStack className="justify-between md:min-h-fit">
                    <NavHeader
                        title={t('receive')}
                        onPrev={() => {
                            if (savedAccounts.length > 0) {
                                setClaimBankFlowStep(ClaimBankFlowStep.SavedAccountsList)
                            } else {
                                setClaimBankFlowStep(ClaimBankFlowStep.BankCountryList)
                            }
                        }}
                    />
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
                    {kycModal}
                </PageStack>
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
                        {kycModal}
                    </>
                )
            }
            return null
        default:
            return null
    }
}
