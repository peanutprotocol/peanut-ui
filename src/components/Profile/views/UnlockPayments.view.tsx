'use client'

import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import { Icon, type IconName } from '@/components/Global/Icons/Icon'
import NavHeader from '@/components/Global/NavHeader'
import UnlockMethodModal from '@/components/IdentityVerification/UnlockMethodModal'
import ResidenceChangeModal from '@/components/Profile/views/ResidenceChangeModal'
import { SumsubKycModals } from '@/components/Kyc/SumsubKycModals'
import PendingVerificationTasks from '@/components/Home/PendingVerificationTasks'
import { KycProcessingModal } from '@/components/Kyc/modals/KycProcessingModal'
import { KycActionRequiredModal } from '@/components/Kyc/modals/KycActionRequiredModal'
import { KycFailedModal } from '@/components/Kyc/modals/KycFailedModal'
import { KycRegionRestrictedModal } from '@/components/Kyc/modals/KycRegionRestrictedModal'
import ActionModal from '@/components/Global/ActionModal'
import { useModalsContext } from '@/context/ModalsContext'
import { getRegionIntent, providerForRegionIntent, type Region } from '@/utils/regions.utils'
import { deriveRegionAccess, isBridgeSupportedCountry, pendingBankRailRegionPaths } from '@/utils/regions.utils'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useQueryClient } from '@tanstack/react-query'
import { LIMITS } from '@/constants/query.consts'
import { useCardInfo } from '@/hooks/useCardInfo'
import { useRainCardOverview } from '@/hooks/useRainCardOverview'
import { useLimits } from '@/hooks/useLimits'
import ProgressBar from '@/components/0_Bruddle/ProgressBar'
import { formatAmountWithCurrency, getLimitColorClass, getLimitData } from '@/features/limits/utils'
import Link from 'next/link'
import { findActiveCard } from '@/components/Card/cardState.utils'
import { useResidenceRestrictions } from '@/hooks/useResidenceRestrictions'
import { useIdentityVerification } from '@/hooks/useIdentityVerification'
import { useKycDegraded } from '@/hooks/useKycDegraded'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import posthog from 'posthog-js'
import { deriveProviderRejection } from '@/utils/provider-rejection.utils'
import { reasonCodeKey } from '@/constants/capability-reason-labels.consts'
import { type RailCapability } from '@/types/capabilities'
import type { MantecaLimit, BridgeLimits } from '@/interfaces/interfaces'
import { useMultiPhaseKycFlow } from '@/hooks/useMultiPhaseKycFlow'
import { useAuth } from '@/context/authContext'
import {
    buildUnlockGroups,
    type BankRegionChip,
    type UnlockChip,
    type UnlockGroup,
    type UnlockRow,
} from '@/utils/unlock-payments.utils'
import { localizedCountryTitle } from '@/utils/country-name.utils'
import { readDeclaredResidence, readSecondResidence, storeSecondResidence } from '@/utils/declared-residence.storage'
import { countryData } from '@/components/AddMoney/consts'
import { useTranslations, useLocale } from 'next-intl'
import { useSafeBack } from '@/hooks/useSafeBack'
import { useState, useCallback, useEffect, useMemo } from 'react'
import { type KYCRegionIntent } from '@/app/actions/types/sumsub.types'
import { useRouter } from 'next/navigation'
import { twMerge } from '@/utils/tw'

type ModalVariant = 'start' | 'processing' | 'action_required' | 'rejected'

/** Same derivation the retired UnlockedRegions view used — modal machinery carried over. */
function getModalVariant(rail: RailCapability | undefined, hasSumsubAction: boolean): ModalVariant {
    if (!rail) return 'start'
    switch (rail.status) {
        case 'pending':
            return 'processing'
        case 'requires-info':
            return hasSumsubAction ? 'action_required' : 'start'
        case 'blocked':
            return 'rejected'
        case 'enabled':
        default:
            return 'start'
    }
}

/**
 * Inline limit summary for an ACTIVE bank row — the limits merge: usage lives
 * on the method it belongs to instead of a separate Limits screen. Manteca
 * (BR/AR) exposes monthly allowances → a usage bar; Bridge (US/MX/EU) only
 * caps per transaction → a plain line.
 */
type RowLimitSummary =
    | { kind: 'manteca'; asset: string; monthlyLimit: number; monthlyRemaining: number }
    | { kind: 'bridge'; perTransaction: string }

function limitSummariesForGroup(
    group: UnlockGroup,
    mantecaLimits: MantecaLimit[] | null,
    bridgeLimits: BridgeLimits | null
): RowLimitSummary[] {
    const refs = new Set(group.rows.filter((row) => row.chip === 'active').flatMap((row) => row.limitRefs ?? []))
    const summaries: RowLimitSummary[] = []
    for (const ref of refs) {
        if (ref === 'bridge') {
            const cap = Number(bridgeLimits?.onRampPerTransaction)
            if (bridgeLimits && Number.isFinite(cap) && cap > 0) {
                summaries.push({
                    kind: 'bridge',
                    perTransaction: formatAmountWithCurrency(cap, bridgeLimits.asset || 'USD'),
                })
            }
            continue
        }
        const limit = mantecaLimits?.find((l) => l.asset === ref)
        if (limit) {
            const monthly = getLimitData(limit, 'monthly')
            summaries.push({
                kind: 'manteca',
                asset: ref,
                monthlyLimit: monthly.limit,
                monthlyRemaining: monthly.remaining,
            })
        }
    }
    return summaries
}

const CHIP_CLASSES: Record<UnlockChip, string> = {
    active: 'bg-background-badge-success',
    alwaysOn: 'bg-background-badge-success',
    unlock: 'bg-background-badge-accent',
    processing: 'bg-background-badge-helper',
    attention: 'bg-background-badge-attention',
    notAvailable: 'bg-background-default text-foreground-secondary',
}

type BankRegionPath = 'europe' | 'north-america' | 'latam'

const UnlockPayments = () => {
    const t = useTranslations('profile.unlockPayments')
    const tRegions = useTranslations('profile.regions')
    const tCommon = useTranslations('common')
    const tIdentity = useTranslations('identity')
    const locale = useLocale()
    const onBack = useSafeBack('/profile', { replace: true })
    const router = useRouter()
    const { user, fetchUser } = useAuth()
    const { rails, isKycApproved, railsForProvider, nextActionsForRail } = useCapabilities()
    const restrictions = useResidenceRestrictions()
    const { identity, isProcessing: isIdentityInReview, isRegionRestricted } = useIdentityVerification()
    const isKycDegraded = useKycDegraded()
    const { isEligible } = useCardInfo()
    const queryClient = useQueryClient()
    const { overview } = useRainCardOverview()
    const { mantecaLimits, bridgeLimits } = useLimits()
    const { setIsSupportModalOpen } = useModalsContext()

    const { unlockedRegions } = useMemo(() => deriveRegionAccess(rails), [rails])
    const pendingPaths = useMemo(() => pendingBankRailRegionPaths(rails), [rails])
    const bridgeRejection = useMemo(() => deriveProviderRejection(rails, 'BRIDGE'), [rails])
    const mantecaRejection = useMemo(() => deriveProviderRejection(rails, 'MANTECA'), [rails])
    const isSumsubApproved = isKycApproved

    // ── list model ──────────────────────────────────────────────────────────
    const unlockedPaths = useMemo(() => new Set(unlockedRegions.map((region) => region.path)), [unlockedRegions])

    const regionChipFor = useCallback(
        (path: BankRegionPath): BankRegionChip => {
            if (unlockedPaths.has(path)) return 'active'
            if (pendingPaths.has(path)) return 'processing'
            const provider = providerForRegionIntent(getRegionIntent(path))
            if (provider) {
                const rail =
                    railsForProvider(provider).find(
                        (r) => r.status === 'pending' || r.status === 'requires-info' || r.status === 'blocked'
                    ) ?? railsForProvider(provider)[0]
                if (rail?.status === 'pending') return 'processing'
                // requires-info still reads Unlock: the chip is an invitation,
                // and whatever the provider is waiting on surfaces after the tap
                // (the action-required modal), not as a scarier chip.
                if (rail?.status === 'requires-info') return 'unlock'
                if (rail?.status === 'blocked') return 'attention'
            }
            return 'unlock'
        },
        [unlockedPaths, pendingPaths, railsForProvider, nextActionsForRail]
    )

    // Server copy first; the localStorage mirror of the signup answer covers
    // reloads before /users/me returns it (or an API without the fields yet).
    const residence = user?.residence ?? null
    const userId = user?.user?.userId
    // localStorage is synchronous I/O: read once per account, not per render.
    const { localDeclared, secondResidenceIso2 } = useMemo(
        () => ({
            localDeclared: readDeclaredResidence(userId),
            // Second declared residence: device mirror, used only where the
            // API value is absent (pre-production BE, or a stale cached user).
            secondResidenceIso2: readSecondResidence(userId),
        }),
        [userId]
    )
    // `declaredSecond` is authoritative when the server sends it AT ALL: `null`
    // means "no second residence", which `??` would wrongly treat like the
    // pre-deploy absent field and revive a stale device mirror. Only `undefined`
    // — an API that predates the field — falls back.
    const serverSecond = residence?.declaredSecond
    const declaredSecondIso2 = serverSecond === undefined ? secondResidenceIso2 : serverSecond
    // Re-sync the mirror to the server's answer, including clearing it: it is
    // read elsewhere (useResidenceRestrictions), so leaving a disowned country
    // there would keep shaping availability.
    useEffect(() => {
        if (userId && serverSecond !== undefined) storeSecondResidence(userId, serverSecond)
    }, [userId, serverSecond])

    const declaredIso2 = residence?.declared ?? localDeclared
    const residenceIso2 = residence?.verified ?? declaredIso2 ?? null
    const isEuropeIso2 = (iso2: string | null): boolean =>
        !!iso2 && iso2 !== 'US' && iso2 !== 'MX' && isBridgeSupportedCountry(iso2)
    const hasActiveCard = !!findActiveCard(overview)

    const groups = useMemo(
        () =>
            buildUnlockGroups({
                regionChips: {
                    europe: regionChipFor('europe'),
                    'north-america': regionChipFor('north-america'),
                    latam: regionChipFor('latam'),
                },
                qrOnly: {
                    brazil: unlockedRegions.some((region) => region.path === 'brazil'),
                    argentina: unlockedRegions.some((region) => region.path === 'argentina'),
                },
                restrictions,
                // Eligibility (residence-driven) decides availability here; the
                // waitlist grant only gates activation and is handled on /card.
                card: hasActiveCard ? 'active' : isEligible === false ? 'notAvailable' : 'get',
                residenceIso2,
                secondResidenceIso2,
                isEuropeResidence: isEuropeIso2(residenceIso2) || isEuropeIso2(secondResidenceIso2),
            }),
        [regionChipFor, unlockedRegions, restrictions, hasActiveCard, isEligible, residenceIso2, secondResidenceIso2]
    )

    // ── modal machinery (carried over from the retired UnlockedRegions view) ──
    const [selectedRegion, setSelectedRegion] = useState<Region | null>(null)
    const [selectedMethodLabel, setSelectedMethodLabel] = useState<string | null>(null)
    const [isChangeModalOpen, setIsChangeModalOpen] = useState(false)
    const [activeRegionIntent, setActiveRegionIntent] = useState<KYCRegionIntent | undefined>(undefined)
    const [errorAcknowledged, setErrorAcknowledged] = useState(false)

    const clickedRegionIntent = selectedRegion ? getRegionIntent(selectedRegion.path) : undefined
    const clickedRegionProvider = providerForRegionIntent(clickedRegionIntent)
    const clickedRegionRail =
        selectedRegion && clickedRegionProvider
            ? (railsForProvider(clickedRegionProvider).find(
                  (rail) => rail.status === 'pending' || rail.status === 'requires-info' || rail.status === 'blocked'
              ) ?? railsForProvider(clickedRegionProvider)[0])
            : undefined
    const clickedRailHasSumsubAction = clickedRegionRail
        ? nextActionsForRail(clickedRegionRail.id).some((action) => action.kind === 'sumsub')
        : false
    const baseModalVariant = selectedRegion ? getModalVariant(clickedRegionRail, clickedRailHasSumsubAction) : null

    const providerRejectionForRegion = clickedRegionProvider === 'bridge' ? bridgeRejection : mantecaRejection
    const providerRejectionReasonKey = reasonCodeKey(providerRejectionForRegion.reasonCode)
    const providerRejectionMessage = providerRejectionReasonKey
        ? tIdentity(providerRejectionReasonKey)
        : providerRejectionForRegion.userMessage
    const hasProviderRejectionForRegion =
        !!selectedRegion &&
        clickedRegionProvider !== null &&
        isSumsubApproved &&
        providerRejectionForRegion.state !== 'happy'
    const modalVariant = hasProviderRejectionForRegion ? ('provider_rejection' as const) : baseModalVariant

    const handleFinalKycSuccess = useCallback(() => {
        setSelectedRegion(null)
        setActiveRegionIntent(undefined)
    }, [])

    const flow = useMultiPhaseKycFlow({
        regionIntent: activeRegionIntent,
        onKycSuccess: handleFinalKycSuccess,
        onManualClose: () => {
            setSelectedRegion(null)
            setActiveRegionIntent(undefined)
        },
    })

    const handleModalClose = useCallback(() => {
        setSelectedRegion(null)
    }, [])

    // Deliberately NO card redirect here (the old screen's Europe→/card hijack):
    // the card is its own row with its own destination, so a bank-method tap can
    // only ever start bank KYC.
    const handleStartKyc = useCallback(async () => {
        const intent = selectedRegion ? getRegionIntent(selectedRegion.path) : undefined
        if (intent) setActiveRegionIntent(intent)
        setErrorAcknowledged(false)
        setSelectedRegion(null)
        // Always cross-region: a locked method has no functional rail behind it,
        // and the flag is a no-op for first-time KYC (retired UnlockedRegions view).
        await flow.handleInitiateKyc(intent, undefined, true)
    }, [flow.handleInitiateKyc, selectedRegion])

    const handleRowClick = useCallback(
        (row: UnlockRow) => {
            if (row.href) {
                router.push(row.href)
                return
            }
            if (!row.regionPath) return
            // During a verification outage the unlock modal renders its degraded
            // variant (choke point in InitiateKycModal covers the other gates);
            // here the shared UnlockMethodModal is ours, so gate the tap itself.
            if (isKycDegraded) return
            setSelectedMethodLabel(t(`rows.${row.labelKey}`))
            // Synthetic Region: the modal machinery only reads path (intent) and
            // name (display); icons are not shown in the modal itself.
            setSelectedRegion({ path: row.regionPath, name: t(`groups.${regionGroupKey(row.regionPath)}`), icon: '' })
        },
        [router, t, isKycDegraded]
    )

    const failedRegionRetriable = providerForRegionIntent(activeRegionIntent) !== null

    const countryDisplayName = (iso2: string | null): string | null =>
        iso2
            ? localizedCountryTitle(locale, {
                  iso2,
                  title: countryData.find((c) => c.iso2?.toUpperCase() === iso2)?.title ?? iso2,
              })
            : null
    const residenceCountryName = countryDisplayName(residenceIso2)
    const declaredCountryName = countryDisplayName(residence?.declared ?? null)

    // In-review line: submittedAt drives both the date and the 7-day
    // escalation. reviewedAt/updatedAt deliberately not used — the user cares
    // when THEY submitted, not when we last touched the row.
    const reviewSubmittedAtMs = identity.submittedAt ? Date.parse(identity.submittedAt) : NaN
    // Explicit UTC: this client component also renders on the server, and a
    // timezone-dependent date can differ by a day between the two renders
    // (hydration mismatch).
    const reviewSubmittedDate = Number.isFinite(reviewSubmittedAtMs)
        ? new Date(reviewSubmittedAtMs).toLocaleDateString(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' })
        : null
    const reviewEscalation =
        Number.isFinite(reviewSubmittedAtMs) && Date.now() - reviewSubmittedAtMs > 7 * 24 * 60 * 60 * 1000

    const showBankRestrictionNote = restrictions.banking
    const showCardRestrictionNote = !restrictions.banking && restrictions.card

    return (
        <div className="space-y-8 flex min-h-[inherit] flex-col">
            <NavHeader title={t('title')} onPrev={onBack} titleClassName="text-heading-xs md:text-heading-s" />
            <div className="my-auto">
                <p className="text-body-s">{t('description')}</p>

                {/* Residence anchor: explains WHY the list looks the way it does. */}
                <div className="mt-4 flex items-center gap-2 rounded-sm border border-border-default bg-background-default p-3 text-body-s dark:border-white dark:bg-foreground-primary">
                    <Icon name="globe" className="size-4 shrink-0" />
                    <span className="font-bold">
                        {residenceCountryName
                            ? t('residence.label', { country: residenceCountryName })
                            : t('residence.unknown')}
                    </span>
                    {residenceIso2 && (
                        <span
                            className={twMerge(
                                'ml-auto shrink-0 rounded-full border border-border-default px-2 py-0.5 text-body-xs font-bold uppercase',
                                residence?.verified
                                    ? 'bg-background-badge-success text-foreground-primary'
                                    : 'text-foreground-secondary'
                            )}
                        >
                            {residence?.verified ? t('residence.verified') : t('residence.unverified')}
                        </span>
                    )}
                    <button
                        type="button"
                        className={twMerge(
                            'shrink-0 text-body-xs underline underline-offset-2',
                            !residenceIso2 && 'ml-auto'
                        )}
                        onClick={() => setIsChangeModalOpen(true)}
                    >
                        {residenceIso2 ? t('residence.change') : t('residence.set')}
                    </button>
                </div>
                {residence?.verified && residence?.declared && residence.declared !== residence.verified && (
                    <p className="mt-1 text-body-xs text-foreground-secondary">
                        {t('residence.pendingReverify', { country: declaredCountryName ?? residence.declared })}
                    </p>
                )}

                {isKycDegraded && (
                    <div className="mt-3 flex items-start gap-2 rounded-sm border border-border-default bg-background-badge-attention p-3 text-body-xs text-foreground-primary dark:bg-foreground-primary dark:text-white">
                        <Icon name="alert" className="mt-0.5 size-4 shrink-0" />
                        <span>
                            <span className="block font-bold">{t('degraded.title')}</span>
                            {t('degraded.body')}{' '}
                            <button
                                type="button"
                                className="font-bold underline underline-offset-2"
                                onClick={() => {
                                    posthog.capture(ANALYTICS_EVENTS.KYC_DEGRADED_NOTIFY_REQUESTED)
                                    posthog.setPersonProperties({ kyc_down_notify_requested: true })
                                }}
                            >
                                {t('degraded.notifyMe')}
                            </button>
                        </span>
                    </div>
                )}

                {isIdentityInReview && !isKycDegraded && (
                    <div className="mt-3 flex items-start gap-2 rounded-sm border border-border-default bg-background-default p-3 text-body-xs dark:bg-foreground-primary">
                        <Icon name="clock" className="mt-0.5 size-4 shrink-0" />
                        <span>
                            <span className="block font-bold">
                                {reviewSubmittedDate
                                    ? t('review.sinceDate', { submittedDate: reviewSubmittedDate })
                                    : t('review.since')}
                            </span>
                            {reviewEscalation ? (
                                <>
                                    {t('review.escalation')}{' '}
                                    <button
                                        type="button"
                                        className="font-bold underline underline-offset-2"
                                        onClick={() => setIsSupportModalOpen(true)}
                                    >
                                        {t('review.messageUs')}
                                    </button>
                                </>
                            ) : (
                                t('review.body')
                            )}
                        </span>
                    </div>
                )}

                {/* Pending Bridge verification tasks (ToS / hosted re-verification). */}
                <div className="mt-4">
                    <PendingVerificationTasks />
                </div>

                {groups.length === 0 && (
                    <EmptyState
                        title={tRegions('empty.title')}
                        description={tRegions('empty.description')}
                        icon="globe-lock"
                        containerClassName="mt-3"
                    />
                )}

                <div className="space-y-3 mt-4">
                    {groups.map((group) => (
                        <UnlockGroupCard
                            key={group.id}
                            group={group}
                            onRowClick={handleRowClick}
                            isKycDegraded={isKycDegraded}
                            mantecaLimits={mantecaLimits}
                            bridgeLimits={bridgeLimits}
                        />
                    ))}
                </div>

                <Link
                    href="/limits"
                    className="mt-3 flex items-center justify-between rounded-sm border border-border-default bg-background-default px-3 py-2.5 text-body-s dark:border-white dark:bg-foreground-primary"
                >
                    <span className="flex items-center gap-2">
                        <Icon name="meter" className="size-4 shrink-0" />
                        {t('limits.viewAll')}
                    </span>
                    <span className="text-body-xs underline underline-offset-2">{t('limits.details')}</span>
                </Link>

                {showBankRestrictionNote && (
                    <p className="mt-3 text-body-xs text-foreground-secondary">{t('bankNotAvailableNote')}</p>
                )}
                {showCardRestrictionNote && (
                    <p className="mt-3 text-body-xs text-foreground-secondary">{t('cardNotAvailableNote')}</p>
                )}
            </div>

            {/* Region-restricted users get the one honest region screen instead
                of an unlock offer that can only end in the same rejection: the
                InitiateKycModal choke point does not cover this surface (it
                renders its own modal), so the invariant is enforced here too. */}
            {isRegionRestricted ? (
                <KycRegionRestrictedModal visible={modalVariant === 'start'} onClose={handleModalClose} />
            ) : (
                <UnlockMethodModal
                    visible={modalVariant === 'start'}
                    onClose={handleModalClose}
                    onUnlock={handleStartKyc}
                    methodLabel={selectedMethodLabel}
                    path={selectedRegion?.path === 'latam' ? 'extended' : 'standard'}
                    isLoading={flow.isLoading}
                />
            )}

            <ResidenceChangeModal
                visible={isChangeModalOpen}
                onClose={() => setIsChangeModalOpen(false)}
                userId={user?.user?.userId}
                declared={residence?.declared ?? null}
                declaredSecond={declaredSecondIso2}
                verified={residence?.verified ?? null}
                nextChangeAllowedAt={residence?.nextChangeAllowedAt ?? null}
                onSaved={async () => {
                    // A residence change shifts everything derived from it:
                    // card eligibility (server recomputes from the declared
                    // country) and limits, alongside the user record itself.
                    await Promise.all([
                        fetchUser(),
                        queryClient.invalidateQueries({ queryKey: ['card-info'] }),
                        queryClient.invalidateQueries({ queryKey: [LIMITS] }),
                    ])
                }}
                onReverify={() => flow.handleRestartIdentity()}
            />

            <KycProcessingModal visible={modalVariant === 'processing'} onClose={handleModalClose} />

            <KycActionRequiredModal
                visible={modalVariant === 'action_required'}
                onClose={handleModalClose}
                onResubmit={handleStartKyc}
                isLoading={flow.isLoading}
                rejectLabels={null}
            />

            <KycFailedModal
                visible={modalVariant === 'rejected'}
                onClose={handleModalClose}
                onRetry={handleStartKyc}
                isLoading={flow.isLoading}
                rejectLabels={null}
                rejectType={null}
                failureCount={undefined}
            />

            <ActionModal
                visible={modalVariant === 'provider_rejection'}
                onClose={handleModalClose}
                title={
                    providerRejectionForRegion.state === 'fixable'
                        ? tRegions('providerRejection.fixableTitle')
                        : providerRejectionForRegion.state === 'restart-identity'
                          ? tRegions('providerRejection.restartTitle')
                          : tRegions('providerRejection.unavailableTitle')
                }
                description={
                    providerRejectionForRegion.state === 'fixable'
                        ? providerRejectionMessage || tRegions('providerRejection.fixableDescription')
                        : providerRejectionForRegion.state === 'restart-identity'
                          ? providerRejectionMessage || tRegions('providerRejection.restartDescription')
                          : tRegions('providerRejection.unavailableDescription')
                }
                icon="alert"
                iconContainerClassName="bg-background-icon-bubble-yellow"
                ctas={[
                    providerRejectionForRegion.state === 'fixable'
                        ? {
                              text: tRegions('providerRejection.uploadDocument'),
                              onClick: () => {
                                  handleModalClose()
                                  flow.handleSelfHealResubmit(providerRejectionForRegion.provider)
                              },
                              variant: 'purple' as const,
                              shadowSize: '4' as const,
                          }
                        : providerRejectionForRegion.state === 'restart-identity'
                          ? {
                                text: tRegions('providerRejection.restartTitle'),
                                onClick: () => {
                                    handleModalClose()
                                    flow.handleRestartIdentity()
                                },
                                variant: 'purple' as const,
                                shadowSize: '4' as const,
                            }
                          : {
                                text: tCommon('contactSupport'),
                                onClick: () => {
                                    handleModalClose()
                                    setIsSupportModalOpen(true)
                                },
                                variant: 'purple' as const,
                                shadowSize: '4' as const,
                            },
                ]}
            />

            <ActionModal
                visible={!!flow.error && !errorAcknowledged}
                onClose={() => setErrorAcknowledged(true)}
                title={
                    failedRegionRetriable
                        ? tRegions('initError.retriableTitle')
                        : tRegions('initError.notAvailableTitle')
                }
                description={flow.error || tCommon('genericError')}
                icon="alert"
                iconContainerClassName="bg-background-icon-bubble-yellow"
                ctas={
                    failedRegionRetriable
                        ? [
                              {
                                  text: tCommon('tryAgain'),
                                  variant: 'purple',
                                  shadowSize: '4',
                                  disabled: flow.isLoading,
                                  onClick: () => {
                                      void flow.handleInitiateKyc(activeRegionIntent, undefined, true)
                                  },
                              },
                              {
                                  text: tCommon('contactSupport'),
                                  variant: 'stroke',
                                  onClick: () => {
                                      setErrorAcknowledged(true)
                                      setIsSupportModalOpen(true)
                                  },
                              },
                          ]
                        : [
                              {
                                  text: tCommon('gotIt'),
                                  variant: 'purple',
                                  shadowSize: '4',
                                  onClick: () => setErrorAcknowledged(true),
                              },
                          ]
                }
            />

            <SumsubKycModals flow={flow} />
        </div>
    )
}

export default UnlockPayments

/** Group label key for a synthetic region name shown in the unlock modal. */
function regionGroupKey(path: 'europe' | 'north-america' | 'latam'): 'europe' | 'northAmerica' | 'southAmerica' {
    if (path === 'europe') return 'europe'
    if (path === 'north-america') return 'northAmerica'
    return 'southAmerica'
}

const UnlockGroupCard = ({
    group,
    onRowClick,
    isKycDegraded,
    mantecaLimits,
    bridgeLimits,
}: {
    group: UnlockGroup
    onRowClick: (row: UnlockRow) => void
    isKycDegraded: boolean
    mantecaLimits: MantecaLimit[] | null
    bridgeLimits: BridgeLimits | null
}) => {
    const t = useTranslations('profile.unlockPayments')
    return (
        <div className="overflow-hidden rounded-sm border border-border-default bg-background-default dark:border-white dark:bg-foreground-primary">
            <div className="flex items-center gap-2 border-b border-border-default bg-background-badge-helper px-3 py-2 text-body-s font-bold dark:border-white dark:bg-foreground-primary">
                <span>{t(`groups.${group.labelKey}`)}</span>
                {group.isYourRegion && (
                    <span className="ml-auto rounded-full border border-border-default bg-background-badge-accent px-2 py-0.5 text-label-m font-bold text-foreground-primary uppercase">
                        {t('yourRegion')}
                    </span>
                )}
            </div>
            {group.rows.map((row) => {
                // During a verification outage the unlock path is closed (the tap
                // guard would no-op), so render those rows disabled instead of
                // letting them look actionable under the degraded banner.
                const tappable = !!row.href || (!!row.regionPath && !isKycDegraded)
                return (
                    <button
                        key={row.id}
                        type="button"
                        disabled={!tappable}
                        onClick={() => onRowClick(row)}
                        className={twMerge(
                            'flex w-full items-center gap-2 border-t border-border-default px-3 py-2.5 text-left text-body-s first:border-t-0 dark:border-white',
                            !tappable && 'cursor-default'
                        )}
                    >
                        <Icon name={row.icon as IconName} className="size-4 shrink-0" />
                        <span className={twMerge(row.chip === 'notAvailable' && 'text-foreground-secondary')}>
                            {t(`rows.${row.labelKey}`)}
                        </span>
                        <span
                            className={twMerge(
                                'ml-auto shrink-0 rounded-full border border-border-default px-2 py-0.5 text-body-xs font-bold text-foreground-primary uppercase',
                                CHIP_CLASSES[row.chip]
                            )}
                        >
                            {t(`chips.${row.chip}`)}
                        </span>
                    </button>
                )
            })}
            {/* P2P has no cap at all (no fiat provider behind it), so the
                Everywhere group always states that — it is the one limit that
                exists before any unlock. */}
            {group.id === 'everywhere' && (
                <div className="border-t border-border-default bg-background-badge-accent px-3 py-2 dark:border-white dark:bg-foreground-primary">
                    <p className="text-body-xs text-foreground-secondary dark:text-white">{t('limits.p2pNoLimit')}</p>
                </div>
            )}
            {limitSummariesForGroup(group, mantecaLimits, bridgeLimits).map((summary) => (
                <div
                    key={summary.kind === 'manteca' ? summary.asset : 'bridge'}
                    className="border-t border-border-default bg-background-badge-accent px-3 py-2 dark:border-white dark:bg-foreground-primary"
                >
                    {summary.kind === 'manteca' ? (
                        <>
                            <p className="mb-1 text-body-xs text-foreground-secondary dark:text-white">
                                {t('limits.monthlyLeft', {
                                    remaining: formatAmountWithCurrency(summary.monthlyRemaining, summary.asset),
                                    limit: formatAmountWithCurrency(summary.monthlyLimit, summary.asset),
                                })}
                            </p>
                            <ProgressBar
                                value={
                                    summary.monthlyLimit > 0
                                        ? (summary.monthlyRemaining / summary.monthlyLimit) * 100
                                        : 0
                                }
                                fillClassName={getLimitColorClass(
                                    summary.monthlyLimit > 0
                                        ? (summary.monthlyRemaining / summary.monthlyLimit) * 100
                                        : 0,
                                    'bg'
                                )}
                            />
                        </>
                    ) : (
                        <p className="text-body-xs text-foreground-secondary dark:text-white">
                            {t('limits.perTransfer', { amount: summary.perTransaction })}
                        </p>
                    )}
                </div>
            ))}
        </div>
    )
}
