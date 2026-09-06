'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
import { useKycDegraded } from '@/hooks/useKycDegraded'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import posthog from 'posthog-js'
import { reasonCodeKey } from '@/constants/capability-reason-labels.consts'
import { type IconName } from '@/components/Global/Icons/Icon'
import { PeanutDoesntStoreAnyPersonalInformation } from '@/components/Kyc/PeanutDoesntStoreAnyPersonalInformation'
import KycPrepChecklist from '@/components/Kyc/KycPrepChecklist'
import NavHeader from '@/components/Global/NavHeader'
import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { useIdentityVerification } from '@/hooks/useIdentityVerification'
import { KycRegionRestrictedModal } from '@/components/Kyc/modals/KycRegionRestrictedModal'
import { useRegionRestrictedCta } from '@/components/Kyc/KycRegionRestrictedContent'
import { useResidenceRestrictions } from '@/hooks/useResidenceRestrictions'

type InitiateKycVariant =
    | 'default'
    | 'provider_rejection'
    | 'blocked'
    | 'restart_identity'
    | 'cross_region'
    | 'region-unavailable'

interface InitiateKycModalProps {
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
    /** country name shown in cross_region variant (e.g. "Brazil", "Argentina") */
    regionName?: string
    /** Which prep checklist the SDK-bound variants show: extended for the
     *  Manteca (BR/AR) flows, standard elsewhere. */
    prepPath?: 'standard' | 'extended'
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
}

// confirmation modal shown before starting identity check or document resubmission.
// default            → "Unlock your account" — verb is "unlock", ID check is the means
// provider_rejection → "We need extra documents"
// blocked            → "We couldn't unlock this — contact support"
// restart_identity   → "Verify with a different document" (self-fix for country mismatch)
// cross_region       → "Unlock {region}"
// Three states are decided HERE and outrank whatever variant the caller asked
// for: the verification outage, a region-restricted rejection, and a residence
// no bank provider onboards.
export const InitiateKycModal = ({
    visible,
    onClose,
    onVerify,
    onContactSupport,
    isLoading,
    error,
    variant = 'default',
    providerMessage,
    reasonCode,
    regionName,
    prepPath = 'standard',
    presentation = 'modal',
    onBack,
    navTitle,
}: InitiateKycModalProps) => {
    const t = useTranslations('kyc')
    const tCommon = useTranslations('common')
    const tIdentity = useTranslations('identity')
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
    const reasonKey = reasonCodeKey(reasonCode)
    const resolvedProviderMessage = reasonKey ? tIdentity(reasonKey) : providerMessage
    const isRegionUnavailable = variant === 'region-unavailable'
    // Resolved once so every branch below reads one variant rather than each
    // re-checking the residence — the caller's variant is what the rail gate
    // could see, this is what the user's residence makes of it.
    const resolvedVariant: InitiateKycVariant | 'bank-unavailable' =
        isBankRestricted && !isRegionUnavailable ? 'bank-unavailable' : variant
    const isBankUnavailable = resolvedVariant === 'bank-unavailable'
    const isProviderRejection = resolvedVariant === 'provider_rejection'
    const isBlocked = resolvedVariant === 'blocked'
    const isRestartIdentity = resolvedVariant === 'restart_identity'
    const isCrossRegion = resolvedVariant === 'cross_region'
    const router = useRouter()
    const regionRestrictedCta = useRegionRestrictedCta(onClose)

    const getTitle = () => {
        if (error) return tCommon('somethingWentWrong')
        if (isRegionUnavailable) return t('initiate.titleRegionUnavailable')
        if (isBankUnavailable) return t('initiate.titleBankUnavailable')
        if (isBlocked) return t('initiate.titleBlocked')
        if (isRestartIdentity) return t('initiate.titleRestartIdentity')
        if (isProviderRejection) return t('initiate.titleProviderRejection')
        if (isCrossRegion)
            return regionName
                ? t('initiate.titleCrossRegion', { region: regionName })
                : t('initiate.titleCrossRegionGeneric')
        return t('initiate.titleDefault')
    }

    const getDescription = () => {
        if (error) return t('initiate.descriptionError', { error })
        if (isRegionUnavailable) return t('initiate.descriptionRegionUnavailable')
        if (isBankUnavailable) return t('initiate.descriptionBankUnavailable')
        if (isBlocked) return resolvedProviderMessage || t('initiate.descriptionBlocked')
        if (isRestartIdentity) return resolvedProviderMessage || t('initiate.descriptionRestartIdentity')
        if (isProviderRejection) return resolvedProviderMessage || t('initiate.descriptionProviderRejection')
        if (isCrossRegion) {
            return regionName
                ? t('initiate.descriptionCrossRegion', { region: regionName })
                : t('initiate.descriptionCrossRegionGeneric')
        }
        return t('initiate.descriptionDefault')
    }

    const getCta = (): { text: string; onClick: () => void; icon?: IconName } => {
        // No retry and no contact-support: nobody can lift a residence block, so
        // the only useful CTA is the part of the app that still works. Same three
        // rules as KycRegionRestrictedContent, whose CTA this reuses.
        if (isBankUnavailable) {
            return { text: regionRestrictedCta.label, onClick: regionRestrictedCta.onClick }
        }
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
            return {
                text: isLoading ? tCommon('loading') : t('initiate.titleRestartIdentity'),
                onClick: onVerify,
                icon: 'upload-cloud',
            }
        }
        if (isProviderRejection) {
            return {
                text: isLoading ? tCommon('loading') : t('initiate.ctaUploadDocument'),
                onClick: onVerify,
                icon: 'upload-cloud',
            }
        }
        if (isCrossRegion) {
            return {
                text: tCommon(isLoading ? 'loading' : 'continue'),
                onClick: onVerify,
            }
        }
        return {
            text: isLoading ? tCommon('loading') : t('initiate.ctaUnlockNow'),
            onClick: onVerify,
            icon: 'check-circle',
        }
    }

    const cta = getCta()

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
                    <div className="flex flex-col items-center gap-4 px-4 pt-1 pb-6 text-center">
                        <IconBubble icon="alert" color="yellow" />
                        <DrawerHeader className="w-full gap-2 p-0 text-center sm:text-center">
                            <DrawerTitle>{t('degraded.title')}</DrawerTitle>
                            <DrawerDescription>{t('degraded.description')}</DrawerDescription>
                        </DrawerHeader>
                        <Button
                            variant="purple"
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
                        <Button variant="stroke" className="w-full justify-center" onClick={onClose}>
                            {tCommon('gotIt')}
                        </Button>
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
    const showPrepChecklist = (resolvedVariant === 'default' || resolvedVariant === 'cross_region') && !error
    // The checklist is left-aligned, so the paragraph introducing it is too:
    // centered prose stacked on a left-aligned list reads as two columns.
    const description = showPrepChecklist ? (
        <div className="flex flex-col gap-3 text-left">
            <p>{getDescription()}</p>
            <KycPrepChecklist path={prepPath} />
        </div>
    ) : (
        getDescription()
    )
    // Red for anything the user has to recover from (a rejection, a block, an
    // unavailable region), blue for the plain "start verification" offer — never
    // green, which the app reserves for a finished state.
    const isErrorState =
        !!error || isBlocked || isRestartIdentity || isProviderRejection || isRegionUnavailable || isBankUnavailable
    const iconName = (isErrorState ? 'alert' : 'badge') as IconName
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
                    <div className="w-full text-body-s text-foreground-secondary">{description}</div>
                </div>
                <Button
                    variant="purple"
                    shadowSize="4"
                    onClick={cta.onClick}
                    disabled={isLoading && !isBlocked}
                    className="h-11 w-full"
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
                <div className="flex flex-col items-center px-4 pt-1 pb-6 text-center">
                    {/* the head owns the M/12 beneath it; everything after keeps
                        the drawer's L/16 rhythm */}
                    <div className="mb-3 flex w-full flex-col items-center gap-4">
                        <IconBubble icon={iconName} color={isErrorState ? 'red' : 'blue'} />
                        <DrawerHeader className="w-full gap-2 p-0 text-center sm:text-center">
                            <DrawerTitle>{getTitle()}</DrawerTitle>
                        </DrawerHeader>
                    </div>
                    <div className="flex w-full flex-col items-center gap-4">
                        {/* body div, not DrawerDescription: the prep-checklist form nests block elements */}
                        <div className="w-full text-body-s text-foreground-secondary">{description}</div>
                        <Button
                            variant="purple"
                            shadowSize="4"
                            className="w-full justify-center"
                            disabled={isLoading && !isBlocked}
                            onClick={cta.onClick}
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
