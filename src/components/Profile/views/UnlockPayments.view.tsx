'use client'

import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import { type IconName } from '@/components/Global/Icons/Icon'
import NavHeader from '@/components/Global/NavHeader'
import Card from '@/components/Global/Card'
import StatusBadge from '@/components/Global/Badges/StatusBadge'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { Notification } from '@/components/0_Bruddle/Notification'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { Section } from '@/components/0_Bruddle/Section'
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
import { getRegionIntent, providerForRegionIntent, regionIntentForResidence, type Region } from '@/utils/regions.utils'
import { deriveRegionAccess, isBridgeSupportedCountry, pendingBankRailRegionPaths } from '@/utils/regions.utils'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useQueryClient } from '@tanstack/react-query'
import { LIMITS } from '@/constants/query.consts'
import { useCardInfo } from '@/hooks/useCardInfo'
import { useRainCardOverview } from '@/hooks/useRainCardOverview'
import { useLimits } from '@/hooks/useLimits'
import ProgressBar from '@/components/0_Bruddle/ProgressBar'
import { getCurrencySymbol, getLimitColorClass, getLimitData } from '@/features/limits/utils'
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
    | { kind: 'manteca'; asset: string; remaining: string; limit: string; usedPercent: number }
    | { kind: 'bridge'; perTransaction: string }

// Whole-unit cap with locale grouping ($100,000, not $100000): the shared
// formatter only abbreviates from seven digits and never groups.
function formatCap(amount: number, currency: string, locale: string): string {
    const symbol = getCurrencySymbol(currency)
    const separator = symbol.length > 1 && symbol === symbol.toUpperCase() ? ' ' : ''
    return `${symbol}${separator}${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(amount)}`
}

function limitSummariesForGroup(
    group: UnlockGroup,
    mantecaLimits: MantecaLimit[] | null,
    bridgeLimits: BridgeLimits | null,
    locale: string
): RowLimitSummary[] {
    const refs = new Set(group.rows.filter((row) => row.chip === 'active').flatMap((row) => row.limitRefs ?? []))
    const summaries: RowLimitSummary[] = []
    for (const ref of refs) {
        if (ref === 'bridge') {
            const cap = Number(bridgeLimits?.onRampPerTransaction)
            if (bridgeLimits && Number.isFinite(cap) && cap > 0) {
                summaries.push({ kind: 'bridge', perTransaction: formatCap(cap, bridgeLimits.asset || 'USD', locale) })
            }
            continue
        }
        const limit = mantecaLimits?.find((l) => l.asset === ref)
        if (limit) {
            const monthly = getLimitData(limit, 'monthly')
            summaries.push({
                kind: 'manteca',
                asset: ref,
                remaining: formatCap(monthly.remaining, ref, locale),
                limit: formatCap(monthly.limit, ref, locale),
                usedPercent: monthly.limit > 0 ? (monthly.remaining / monthly.limit) * 100 : 0,
            })
        }
    }
    return summaries
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
                secondResidenceIso2: declaredSecondIso2,
                isEuropeResidence: isEuropeIso2(residenceIso2) || isEuropeIso2(declaredSecondIso2),
            }),
        [regionChipFor, unlockedRegions, restrictions, hasActiveCard, isEligible, residenceIso2, declaredSecondIso2]
    )

    // ── modal machinery (carried over from the retired UnlockedRegions view) ──
    const [selectedRegion, setSelectedRegion] = useState<Region | null>(null)
    const [selectedMethodLabel, setSelectedMethodLabel] = useState<string | null>(null)
    const [isChangeModalOpen, setIsChangeModalOpen] = useState(false)
    const [activeRegionIntent, setActiveRegionIntent] = useState<KYCRegionIntent | undefined>(undefined)
    const [errorAcknowledged, setErrorAcknowledged] = useState(false)
    const [reverifyRequested, setReverifyRequested] = useState(false)

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
        setReverifyRequested(false)
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

    // A residence re-verification never sets a region intent, so without the
    // flag its failure would read as "Not available yet" instead of retriable.
    const failedRegionRetriable = reverifyRequested || providerForRegionIntent(activeRegionIntent) !== null

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

    // No card-only note: a card-restricted user already reads "Not available"
    // on the card row itself (unlock-payments.utils), so the footer line only
    // repeated it. The banking note stays — it covers rails whose rows are
    // absent from the list entirely.
    const showBankRestrictionNote = restrictions.banking

    const residenceTrailing = !residenceIso2 ? undefined : residence?.verified ? (
        <StatusBadge status="completed" customText={t('residence.verified')} />
    ) : (
        <span className="text-body-s text-foreground-secondary">{t('residence.unverified')}</span>
    )

    return (
        <PageStack gap="6" className="pb-10">
            <NavHeader title={t('title')} onPrev={onBack} titleClassName="text-heading-xs md:text-heading-s" />
            <p className="text-body-s">{t('description')}</p>

            {/* Residence anchor: explains WHY the list looks the way it does. */}
            <div className="flex flex-col gap-1">
                <ListItem
                    leading={<IconBubble icon="globe" size="s" color="blue" />}
                    title={
                        residenceCountryName
                            ? t('residence.label', { country: residenceCountryName })
                            : t('residence.unknown')
                    }
                    trailing={residenceTrailing}
                    chevron
                    onClick={() => setIsChangeModalOpen(true)}
                    aria-label={residenceIso2 ? t('residence.change') : t('residence.set')}
                />
                {residence?.verified && residence?.declared && residence.declared !== residence.verified && (
                    <p className="text-center text-body-xs text-foreground-secondary">
                        {t('residence.pendingReverify', { country: declaredCountryName ?? residence.declared })}
                    </p>
                )}
            </div>

            {isKycDegraded && (
                <Notification
                    priority="attention"
                    title={t('degraded.title')}
                    ctas={[
                        {
                            label: t('degraded.notifyMe'),
                            onClick: () => {
                                posthog.capture(ANALYTICS_EVENTS.KYC_DEGRADED_NOTIFY_REQUESTED)
                                posthog.setPersonProperties({ kyc_down_notify_requested: true })
                            },
                        },
                    ]}
                >
                    {t('degraded.body')}
                </Notification>
            )}

            {isIdentityInReview && !isKycDegraded && (
                <Notification
                    priority="helper"
                    title={
                        reviewSubmittedDate
                            ? t('review.sinceDate', { submittedDate: reviewSubmittedDate })
                            : t('review.since')
                    }
                    ctas={
                        reviewEscalation
                            ? [{ label: t('review.messageUs'), onClick: () => setIsSupportModalOpen(true) }]
                            : undefined
                    }
                >
                    {reviewEscalation ? t('review.escalation') : t('review.body')}
                </Notification>
            )}

            {/* Pending Bridge verification tasks (ToS / hosted re-verification). */}
            <PendingVerificationTasks />

            {groups.length === 0 && (
                <EmptyState
                    title={tRegions('empty.title')}
                    description={tRegions('empty.description')}
                    icon="globe-lock"
                />
            )}

            {groups.map((group) => (
                <UnlockSection
                    key={group.id}
                    group={group}
                    onRowClick={handleRowClick}
                    isKycDegraded={isKycDegraded}
                    limitSummaries={limitSummariesForGroup(group, mantecaLimits, bridgeLimits, locale)}
                />
            ))}

            {showBankRestrictionNote && (
                <p className="text-body-xs text-foreground-secondary">{t('bankNotAvailableNote')}</p>
            )}

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
                onReverify={(iso2) => {
                    // The new residence decides which provider level the fresh
                    // Sumsub token targets, and whether the SDK runs a second level.
                    const intent = regionIntentForResidence(iso2)
                    setActiveRegionIntent(intent)
                    setReverifyRequested(true)
                    setErrorAcknowledged(false)
                    void flow.handleRestartIdentity(intent)
                }}
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
                tone="error"
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
                tone="error"
                ctas={
                    failedRegionRetriable
                        ? [
                              {
                                  text: tCommon('tryAgain'),
                                  variant: 'purple',
                                  shadowSize: '4',
                                  disabled: flow.isLoading,
                                  onClick: () => {
                                      if (reverifyRequested) void flow.handleRestartIdentity(activeRegionIntent)
                                      else void flow.handleInitiateKyc(activeRegionIntent, undefined, true)
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
        </PageStack>
    )
}

export default UnlockPayments

/** Group label key for a synthetic region name shown in the unlock modal. */
function regionGroupKey(path: 'europe' | 'north-america' | 'latam'): 'europe' | 'northAmerica' | 'southAmerica' {
    if (path === 'europe') return 'europe'
    if (path === 'north-america') return 'northAmerica'
    return 'southAmerica'
}

type IconBubbleColor = NonNullable<React.ComponentProps<typeof IconBubble>['color']>

const BUBBLE_COLOR: Record<UnlockChip, IconBubbleColor> = {
    active: 'green',
    alwaysOn: 'green',
    unlock: 'blue',
    processing: 'blue',
    attention: 'yellow',
    notAvailable: 'gray',
}

/**
 * One region of the list (option D of the DS rebuild): a Section heading over
 * a ListGroup of method rows, closed by the region's own limits card so the
 * numbers sit next to the methods they govern.
 */
const UnlockSection = ({
    group,
    onRowClick,
    isKycDegraded,
    limitSummaries,
}: {
    group: UnlockGroup
    onRowClick: (row: UnlockRow) => void
    isKycDegraded: boolean
    limitSummaries: RowLimitSummary[]
}) => {
    const t = useTranslations('profile.unlockPayments')

    const rowTrailing = (row: UnlockRow) => {
        switch (row.chip) {
            case 'active':
            case 'alwaysOn':
                return <StatusBadge status="completed" customText={t(`chips.${row.chip}`)} />
            case 'processing':
                return <StatusBadge status="processing" customText={t('chips.processing')} />
            case 'attention':
                return <StatusBadge status="pending" customText={t('chips.attention')} />
            case 'unlock':
            case 'notAvailable':
                return <span className="text-body-s text-foreground-secondary">{t(`chips.${row.chip}`)}</span>
        }
    }

    const showLimits = group.id === 'everywhere' || limitSummaries.length > 0

    return (
        <Section
            title={
                <span className="flex items-center gap-2">
                    {t(`groups.${group.labelKey}`)}
                    {group.isYourRegion && <StatusBadge status="custom" customText={t('yourRegion')} />}
                </span>
            }
        >
            <ListGroup>
                {group.rows.map((row) => {
                    // During a verification outage the unlock path is closed (the tap
                    // guard would no-op), so render those rows inert instead of
                    // letting them look actionable under the degraded banner.
                    const tappable = !!row.href || (!!row.regionPath && !isKycDegraded)
                    return (
                        <ListItem
                            key={row.id}
                            disabled={row.chip === 'notAvailable'}
                            leading={<IconBubble icon={row.icon as IconName} size="s" color={BUBBLE_COLOR[row.chip]} />}
                            title={t(`rows.${row.labelKey}`)}
                            trailing={rowTrailing(row)}
                            chevron={tappable}
                            onClick={tappable ? () => onRowClick(row) : undefined}
                        />
                    )
                })}
            </ListGroup>
            {showLimits && (
                <Card position="single" className="flex flex-col gap-3 px-4 py-3">
                    {/* P2P has no cap at all (no fiat provider behind it), so the
                        Everywhere group always states that — it is the one limit
                        that exists before any unlock. */}
                    {group.id === 'everywhere' && (
                        <p className="text-body-s text-foreground-secondary">{t('limits.p2pNoLimit')}</p>
                    )}
                    {limitSummaries.map((summary) =>
                        summary.kind === 'manteca' ? (
                            <div key={summary.asset} className="flex flex-col gap-1">
                                <p className="text-body-s text-foreground-secondary">
                                    {t('limits.monthlyLeft', { remaining: summary.remaining, limit: summary.limit })}
                                </p>
                                <ProgressBar
                                    value={summary.usedPercent}
                                    fillClassName={getLimitColorClass(summary.usedPercent, 'bg')}
                                />
                            </div>
                        ) : (
                            <p key="bridge" className="text-body-s text-foreground-secondary">
                                {t('limits.perTransfer', { amount: summary.perTransaction })}
                            </p>
                        )
                    )}
                </Card>
            )}
        </Section>
    )
}
