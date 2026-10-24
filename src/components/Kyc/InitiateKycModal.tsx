'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
import { useKycDegraded } from '@/hooks/useKycDegraded'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import posthog from 'posthog-js'
import { reasonCodeKey } from '@/constants/capability-reason-labels.consts'
import { IDENTITY_DOCUMENT_MISSING_CODE } from '@/constants/kyc.consts'
import { type IconName } from '@/components/Global/Icons/Icon'
import { PeanutDoesntStoreAnyPersonalInformation } from '@/components/Kyc/PeanutDoesntStoreAnyPersonalInformation'
import KycPrepChecklist from '@/components/Kyc/KycPrepChecklist'
import NavHeader from '@/components/Global/NavHeader'
import { Button } from '@/components/0_Bruddle/Button'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { useIdentityVerification } from '@/hooks/useIdentityVerification'
import { KycRegionRestrictedModal } from '@/components/Kyc/modals/KycRegionRestrictedModal'
import { useRegionRestrictedCta } from '@/components/Kyc/KycRegionRestrictedContent'
import { useResidenceRestrictions } from '@/hooks/useResidenceRestrictions'
import type { NextAction } from '@/types/capabilities'
import { isIdRetake, kycActionCtaKey } from '@/utils/kyc-action-copy.utils'
import { isBridgeProcessingSlow } from '@/utils/kyc-processing.utils'
import type { ProviderId } from '@/types/provider.types'
import Loading from '@/components/Global/Loading'
import type { PaperworkVerificationEntry } from '@/features/paperwork-verification/paperworkVerificationEntry'
import { usePaperworkVerificationRedirect } from '@/features/paperwork-verification/usePaperworkVerificationRedirect'

type InitiateKycVariant =
    | 'default'
    | 'provider_rejection'
    | 'blocked'
    | 'restart_identity'
    | 'cross_region'
    | 'country_payments'
    | 'region-unavailable'
    | 'bank-unavailable'

interface InitiateKycModalProps {
    cooldownActive?: boolean
    visible: boolean
    onClose: () => void
    onVerify: () => void
    onContactSupport?: () => void
    isLoading?: boolean
    /** error message from a failed verify/resubmit attempt */
    error?: string | null
    /** when set, shows context-specific messaging instead of the generic "unlock" copy */
    variant?: InitiateKycVariant
    providerMessage?: string
    /** Stable `CapabilityReason.code` behind `providerMessage` — known codes
     *  render localized identity.reasons.* copy; unknown fall back to prose. */
    reasonCode?: string
    nextAction?: NextAction
    pendingSince?: string
    /** country name shown in cross_region variant (e.g. "Brazil", "Argentina") */
    regionName?: string
    /** Which prep checklist the SDK-bound variants show: extended for the
     *  Manteca (BR/AR) flows, standard elsewhere. */
    prepPath?: 'standard' | 'extended'
    /** ISO code of the single country the extended prep is for, so the tax-ID
     *  row names that country's document (CUIT/CUIL for AR, CPF for BR) rather
     *  than the both-countries string. Pass the ISO code, not `regionName`. */
    taxIdCountry?: 'AR' | 'BR'
    /**
     * 'modal' overlays the caller; 'page' renders the same decision as a flow
     * step. The prep content is a screen's worth — two requirement cards, a
     * duration card, a caveat and a CTA — which overflowed the dialog on a
     * short viewport. Both forms share every branch below on purpose: the
     * degraded-outage and region-restricted short-circuits are the invariant
     * this component exists to centralize.
     */
    presentation?: 'modal' | 'page'
    /** page form only — the step's back affordance and header title */
    onBack?: () => void
    navTitle?: string
    /** Bridge callers name the entity here; the Manteca flows get theirs from `taxIdCountry` */
    providerId?: ProviderId
    /** test id of the start-verification CTA (default and cross-region variants) */
    ctaTestId?: string
    /**
     * The entry point's start, for Smart Paperwork Verification: such a user
     * goes straight to /verify (or the add-later screen for this feature) and
     * never sees the unlock offer. Omit where the caller already routes them.
     */
    verifyEntry?: PaperworkVerificationEntry
}

// confirmation modal shown before starting identity check or document resubmission.
// default            → "Unlock your account" — verb is "unlock", ID check is the means
// provider_rejection → "We need extra documents"
// blocked            → "We couldn't unlock this — contact support"
// restart_identity   → "Verify with a different document" (self-fix for country mismatch);
//                      with the identity_document_missing reason code it is
//                      "Complete your verification" (the approval has no document)
// cross_region       → "Unlock {region}" (identity already cleared)
// country_payments   → "Unlock {region}" for a user who has not verified yet and
//                      arrived from one country's flow: what they unlock is that
//                      country's bank transfers and payments, not an account
// Three states are decided HERE and outrank whatever variant the caller asked
// for: the verification outage, a region-restricted rejection, and a residence
// no bank provider onboards.
export const InitiateKycModal = ({
    visible,
    cooldownActive,
    onClose,
    onVerify,
    onContactSupport,
    isLoading,
    error,
    variant = 'default',
    providerMessage,
    reasonCode,
    nextAction,
    pendingSince,
    regionName,
    prepPath = 'standard',
    taxIdCountry,
    presentation = 'modal',
    onBack,
    navTitle,
    providerId,
    ctaTestId = 'kyc-initiate-cta',
    verifyEntry,
}: InitiateKycModalProps) => {
    const t = useTranslations('kyc')
    const tCommon = useTranslations('common')
    const tIdentity = useTranslations('identity')
    // the hosted check keeps the words of the Home task that also offers it
    const tHome = useTranslations('home')
    // Enforced HERE rather than at each call site on purpose. Six gates open this
    // modal (add-money, withdraw, the two bank pages, and both Manteca flow
    // managers), and each one computes its variant from a rail gate that cannot
    // see WHY identity failed: a region-restricted user reads as `needs-identity`
    // (no rail + unverified) and would be offered "Unlock now" → the Sumsub SDK
    // → the same guaranteed rejection, or as `blocked-rejection` → contact
    // support. Both contradict the region screen. Short-circuiting at the one
    // component they all share makes the invariant impossible for a future call
    // site to miss.
    const { isRegionRestricted } = useIdentityVerification()
    const isKycDegraded = useKycDegraded()
    // Every gate that opens this modal unlocks a BANK rail (the two bank pages,
    // the shared country list, both Manteca flow managers, the Manteca
    // withdraw), so a residence no bank provider onboards has nothing behind
    // the offer. The gates cannot see this themselves: pre-KYC there is no rail
    // to carry `uk_resident_blocked` and no rejection to set `isRegionRestricted`,
    // so a restricted resident reads as plain `needs-identity` and would be sold
    // an ID check that unlocks nothing. Ranked BELOW the region screen (a
    // document-jurisdiction block is the more specific ending) and below the
    // outage, and it yields to `region-unavailable`, whose UK copy is more
    // specific than this country-neutral one.
    const { banking: isBankRestricted } = useResidenceRestrictions()
    const slow = isBridgeProcessingSlow(reasonCode, pendingSince)
    const reasonKey = slow ? 'reasons.bridge_processing_slow' : reasonCodeKey(reasonCode)
    const resolvedProviderMessage = reasonKey ? tIdentity(reasonKey) : providerMessage
    const isSupplementInReview = reasonCode === 'requirements_in_review'
    const descriptionTestId = isSupplementInReview ? 'kyc-supplement-in-review' : undefined
    const isRegionUnavailable = variant === 'region-unavailable'
    // Resolved once so every branch below reads one variant rather than each
    // re-checking the residence — the caller's variant is what the rail gate
    // could see, this is what the user's residence makes of it.
    // A caller may also pass 'bank-unavailable' itself: the rail's own
    // `residence_bank_restricted` refusal (resolveKycModalVariant), which covers
    // a pending residence this device's restriction read cannot see.
    const resolvedVariant: InitiateKycVariant = isBankRestricted && !isRegionUnavailable ? 'bank-unavailable' : variant
    const isBankUnavailable = resolvedVariant === 'bank-unavailable'
    const isProviderRejection = resolvedVariant === 'provider_rejection'
    const isBlocked = resolvedVariant === 'blocked'
    const isRestartIdentity = resolvedVariant === 'restart_identity'
    // The restart serves two causes. Only the missing document asks for a
    // first document rather than a different one, so the reason code picks
    // the title and the button; the description already follows the code.
    const isDocumentMissing = isRestartIdentity && reasonCode === IDENTITY_DOCUMENT_MISSING_CODE
    // Bridge's own check on its hosted page: no document to upload here, and
    // the rail's reason (often an ID message) would point at the wrong fix.
    const isHostedCheck = isProviderRejection && nextAction?.kind === 'bridge-hosted'
    const isCrossRegion = resolvedVariant === 'cross_region'
    const isCountryPayments = resolvedVariant === 'country_payments'
    const router = useRouter()
    const regionRestrictedCta = useRegionRestrictedCta(onClose)
    // Only the unlock offers start a verification; every other variant is an
    // ending of its own, and the outage and region screens outrank them all.
    const isUnlockOffer = resolvedVariant === 'default' || isCrossRegion || isCountryPayments
    const redirecting = usePaperworkVerificationRedirect(
        visible && isUnlockOffer && !cooldownActive && !isKycDegraded && !isRegionRestricted && !error,
        verifyEntry
    )

    const getTitle = () => {
        if (error) return tCommon('somethingWentWrong')
        if (isRegionUnavailable) return t('initiate.titleRegionUnavailable')
        if (isBankUnavailable) return t('initiate.titleBankUnavailable')
        if (isSupplementInReview || slow) return t('processingTitle')
        if (isBlocked) return t('initiate.titleBlocked')
        if (isDocumentMissing) return t('initiate.titleIdentityDocumentMissing')
        if (isRestartIdentity) return t('initiate.titleRestartIdentity')
        if (isHostedCheck) return tHome('pendingTasks.verifyTitle')
        if (isProviderRejection) return t('initiate.titleProviderRejection')
        if (isCrossRegion)
            return regionName
                ? t('initiate.titleCrossRegion', { region: regionName })
                : t('initiate.titleCrossRegionGeneric')
        if (isCountryPayments && regionName) return t('initiate.titleCrossRegion', { region: regionName })
        return t('initiate.titleDefault')
    }

    const getDescription = () => {
        if (error) return t('initiate.descriptionError', { error })
        if (isRegionUnavailable) return t('initiate.descriptionRegionUnavailable')
        if (isBankUnavailable) return t('initiate.descriptionBankUnavailable')
        if (isSupplementInReview || slow) return resolvedProviderMessage
        if (isHostedCheck) return tHome('pendingTasks.verifyDescription')
        if (isProviderRejection && isIdRetake(nextAction)) return t('initiate.descriptionRetakeId')
        if (isBlocked) return resolvedProviderMessage || t('initiate.descriptionBlocked')
        if (isRestartIdentity) return resolvedProviderMessage || t('initiate.descriptionRestartIdentity')
        if (isProviderRejection) return resolvedProviderMessage || t('initiate.descriptionProviderRejection')
        if (isCrossRegion) {
            return regionName
                ? t('initiate.descriptionCrossRegion', { region: regionName })
                : t('initiate.descriptionCrossRegionGeneric')
        }
        if (isCountryPayments && regionName) return t('initiate.descriptionCountryPayments', { region: regionName })
        return t('initiate.descriptionDefault')
    }

    const getCta = (): { text: string; onClick: () => void; icon?: IconName; testId?: string } => {
        // No retry and no contact-support: nobody can lift a residence block, so
        // the only useful CTA is the part of the app that still works. Same three
        // rules as KycRegionRestrictedContent, whose CTA this reuses.
        if (isBankUnavailable) {
            return { text: regionRestrictedCta.label, onClick: regionRestrictedCta.onClick }
        }
        if (slow) return { text: tCommon('contactSupport'), onClick: onContactSupport ?? onClose }
        if (isSupplementInReview) return { text: tCommon('gotIt'), onClick: onClose }
        if (error || isBlocked) {
            return {
                text: tCommon('contactSupport'),
                onClick: onContactSupport ?? onClose,
            }
        }
        if (isRegionUnavailable) {
            return {
                text: t('initiate.ctaWithdrawFunds'),
                onClick: () => {
                    onClose()
                    router.push('/withdraw')
                },
            }
        }
        if (isRestartIdentity) {
            const label = isDocumentMissing ? t('initiate.ctaUnlockNow') : t('initiate.titleRestartIdentity')
            return {
                text: isLoading ? tCommon('loading') : label,
                onClick: onVerify,
                icon: 'upload-cloud',
            }
        }
        if (isHostedCheck) {
            return { text: t('continueVerification'), onClick: onVerify, icon: 'check-circle' }
        }
        if (isProviderRejection) {
            return {
                text: isLoading ? tCommon('loading') : t(kycActionCtaKey(nextAction, reasonCode)),
                onClick: onVerify,
                icon:
                    kycActionCtaKey(nextAction, reasonCode) === 'initiate.ctaAnswerQuestions'
                        ? undefined
                        : 'upload-cloud',
                testId: reasonCode === 'requirements_missing' ? 'kyc-supplement-cta' : undefined,
            }
        }
        if (isCrossRegion) {
            return {
                text: tCommon(isLoading ? 'loading' : 'continue'),
                onClick: onVerify,
                testId: ctaTestId,
            }
        }
        return {
            text: isLoading ? tCommon('loading') : t('initiate.ctaUnlockNow'),
            onClick: onVerify,
            icon: 'check-circle',
            testId: ctaTestId,
        }
    }

    const cta = getCta()

    if (cooldownActive) return null
    if (redirecting) return presentation === 'page' ? <Loading variant="mascot" /> : null

    // Outage outranks everything, including the region screen: whatever the
    // user's state, opening the SDK during a verification outage burns an
    // attempt against a wall. Same choke-point rationale as the region check
    // below — six gates share this modal, so the invariant lives here once.
    if (isKycDegraded) {
        return (
            <Drawer
                open={visible}
                onOpenChange={(isOpen) => {
                    if (!isOpen) onClose()
                }}
            >
                <DrawerContent>
                    <div className="flex flex-col items-center gap-4 pt-1 pb-6 text-center">
                        <IconBubble icon="alert" color="yellow" />
                        <DrawerHeader className="w-full gap-2 p-0 text-center sm:text-center">
                            <DrawerTitle>{t('degraded.title')}</DrawerTitle>
                            <DrawerDescription>{t('degraded.description')}</DrawerDescription>
                        </DrawerHeader>
                        <Button
                            variant="primary"
                            shadowSize="4"
                            className="mt-2 w-full justify-center"
                            onClick={() => {
                                posthog.capture(ANALYTICS_EVENTS.KYC_DEGRADED_NOTIFY_REQUESTED)
                                // cohort tag: ops pushes to exactly these users when
                                // the flag flips back off
                                posthog.setPersonProperties({ kyc_down_notify_requested: true })
                                onClose()
                            }}
                        >
                            {t('degraded.notifyMe')}
                        </Button>
                        <div className="mt-2 flex justify-center">
                            <LinkButton onClick={onClose}>{tCommon('gotIt')}</LinkButton>
                        </div>
                    </div>
                </DrawerContent>
            </Drawer>
        )
    }

    // Render the ONE definition of this screen rather than a second copy of it:
    // a local re-implementation could drift from the drawer/profile surface, and
    // "these two never disagree" is the property this whole change rests on.
    if (isRegionRestricted) {
        return <KycRegionRestrictedModal visible={visible} onClose={onClose} />
    }

    // The variants that lead into a fresh SDK run (the plain unlock offer and
    // the cross-region unlock) carry the prep checklist, so no path reaches the
    // vendor without it. Every other variant is an error/action state where the
    // list would be noise.
    const showPrepChecklist =
        (resolvedVariant === 'default' || resolvedVariant === 'cross_region' || isCountryPayments) &&
        !error &&
        !isSupplementInReview
    // The checklist is left-aligned, so the paragraph introducing it is too:
    // centered prose stacked on a left-aligned list reads as two columns.
    // the account provider heads the checklist: bridge from the caller, manteca from the tax-id country
    const prepProviderId =
        prepPath === 'extended' ? taxIdCountry && (taxIdCountry === 'AR' ? 'manteca-ar' : 'manteca-br') : providerId
    const description = (nested: boolean) =>
        showPrepChecklist ? (
            <div className="flex flex-col gap-3 text-left">
                <p>{getDescription()}</p>
                <KycPrepChecklist
                    path={prepPath}
                    taxIdCountry={taxIdCountry}
                    providerId={prepProviderId}
                    nested={nested}
                />
            </div>
        ) : (
            getDescription()
        )
    // Red for anything the user has to recover from (a rejection, a block, an
    // unavailable region), blue for the plain "start verification" offer — never
    // green, which the app reserves for a finished state.
    const isErrorState =
        !!error || isBlocked || isRestartIdentity || isProviderRejection || isRegionUnavailable || isBankUnavailable
    const iconName = (isSupplementInReview ? 'clock' : isErrorState ? 'alert' : 'badge') as IconName
    const footer =
        isProviderRejection ||
        isBlocked ||
        isRestartIdentity ||
        isRegionUnavailable ||
        isBankUnavailable ? undefined : (
            <PeanutDoesntStoreAnyPersonalInformation className="w-full justify-center" />
        )

    if (presentation === 'page') {
        if (!visible) return null
        /*
         * On the happy path the screen title is the header and nothing repeats
         * it. Every other variant IS its title — "We need extra documents",
         * "Verify with a different document" — and that belongs under the icon
         * where it can wrap; NavHeader truncates at the width between its two
         * side buttons.
         */
        const titleIsGeneric = resolvedVariant === 'default' && !error
        const headerTitle = navTitle ?? getTitle()
        return (
            <div className="flex flex-col gap-6">
                <NavHeader title={headerTitle} onPrev={onBack} />
                {/* NavHeader's title is a div, so without this the page has no
                    heading at all whenever the visible one is dropped. */}
                {titleIsGeneric && <h1 className="sr-only">{headerTitle}</h1>}
                <div className="flex flex-col items-center gap-4 text-center">
                    <IconBubble icon={iconName} size="l" color={isErrorState ? 'red' : 'blue'} />
                    {!titleIsGeneric && <h1 className="text-heading-xs text-foreground-primary">{getTitle()}</h1>}
                    <div className="w-full text-body-s text-foreground-secondary" data-testid={descriptionTestId}>
                        {description(false)}
                    </div>
                </div>
                <Button
                    variant="primary"
                    shadowSize="4"
                    onClick={cta.onClick}
                    disabled={isLoading && !isBlocked}
                    className="h-11 w-full"
                    data-testid={cta.testId}
                    {...(cta.icon ? { icon: cta.icon } : {})}
                >
                    {cta.text}
                </Button>
                {footer}
            </div>
        )
    }

    // The modal was preventClose + a visible X: no accidental overlay dismissal,
    // one deliberate way out. The drawer keeps that contract — swipe / hardware
    // back / overlay all route through the same onClose the X called; there is
    // no stray-click path because vaul only dismisses on a deliberate gesture.
    return (
        <Drawer
            open={visible}
            onOpenChange={(isOpen) => {
                if (!isOpen) onClose()
            }}
        >
            <DrawerContent>
                <div className="flex flex-col items-center pt-1 pb-6 text-center">
                    {/* the head owns the M/12 beneath it; everything after keeps
                        the drawer's L/16 rhythm */}
                    <div className="mb-3 flex w-full flex-col items-center gap-4">
                        <IconBubble
                            icon={iconName}
                            color={isSupplementInReview ? 'yellow' : isErrorState ? 'red' : 'blue'}
                        />
                        <DrawerHeader className="w-full gap-2 p-0 text-center sm:text-center">
                            <DrawerTitle>{getTitle()}</DrawerTitle>
                        </DrawerHeader>
                    </div>
                    <div className="flex w-full flex-col items-center gap-4">
                        {/* body div, not DrawerDescription: the prep-checklist form nests block elements */}
                        <div className="w-full text-body-s text-foreground-secondary" data-testid={descriptionTestId}>
                            {description(true)}
                        </div>
                        <Button
                            variant="primary"
                            shadowSize="4"
                            className="w-full justify-center"
                            disabled={isLoading && !isBlocked}
                            onClick={cta.onClick}
                            data-testid={cta.testId}
                            {...(cta.icon ? { icon: cta.icon } : {})}
                        >
                            {cta.text}
                        </Button>
                        {footer}
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    )
}
