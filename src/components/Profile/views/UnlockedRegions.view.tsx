'use client'

import { ListItem } from '@/components/0_Bruddle/ListItem'
import { getCardPosition } from '@/components/Global/Card/card.utils'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import { Icon } from '@/components/Global/Icons/Icon'
import NavHeader from '@/components/Global/NavHeader'
import UnlockRegionModal from '@/components/IdentityVerification/UnlockRegionModal'
import { SumsubKycModals } from '@/components/Kyc/SumsubKycModals'
import PendingVerificationTasks from '@/components/Home/PendingVerificationTasks'
import { KycProcessingModal } from '@/components/Kyc/modals/KycProcessingModal'
import { KycActionRequiredModal } from '@/components/Kyc/modals/KycActionRequiredModal'
import { KycFailedModal } from '@/components/Kyc/modals/KycFailedModal'
import ActionModal from '@/components/Global/ActionModal'
import { useModalsContext } from '@/context/ModalsContext'
import { deriveRegionAccess, getRegionIntent, providerForRegionIntent, type Region } from '@/utils/regions.utils'
import { useRegionLabel } from '@/hooks/useRegionLabel'
import { useActivationStatus } from '@/hooks/useActivationStatus'
import { useCapabilities } from '@/hooks/useCapabilities'
import { deriveProviderRejection } from '@/utils/provider-rejection.utils'
import { reasonCodeKey } from '@/constants/capability-reason-labels.consts'
import { type RailCapability } from '@/types/capabilities'
import { useMultiPhaseKycFlow } from '@/hooks/useMultiPhaseKycFlow'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { useSafeBack } from '@/hooks/useSafeBack'
import { useState, useCallback, useRef, useMemo } from 'react'
import { type KYCRegionIntent } from '@/app/actions/types/sumsub.types'
import { useRouter } from 'next/navigation'

type ModalVariant = 'start' | 'processing' | 'action_required' | 'rejected'

/**
 * Determine which verification modal to show for the clicked region, derived
 * from that region's provider rail in the capability model.
 *
 * MIGRATION-REVIEW + CONTRACT GAP: this replaces `getModalVariant(sumsubStatus, …)`
 * which keyed off the raw Sumsub verification status from `useUnifiedKycStatus`.
 * Sumsub identity has NO rail in the capability model, so the modal state is now
 * derived from the *downstream provider rail* the region unlocks:
 *   - no rail / no functional rail   → 'start'   (was: no/NOT_STARTED sumsub status,
 *                                                  and the cross-region "switching to a
 *                                                  region you haven't verified" case)
 *   - rail 'pending'                 → 'processing'  (was PENDING/IN_REVIEW)
 *   - rail 'requires-info' w/ sumsub action → 'action_required' (was ACTION_REQUIRED)
 *   - rail 'blocked'                 → 'rejected'  (was REJECTED/FAILED)
 * The cross-region check is implicit: a region whose provider has no functional
 * rail yields 'start', which is exactly what the old `clickedRegionIntent !==
 * existingRegionIntent → start` branch produced.
 */
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

const UnlockedRegions = () => {
    const t = useTranslations('profile.regions')
    const tCommon = useTranslations('common')
    const tIdentity = useTranslations('identity')
    const onBack = useSafeBack('/profile', { replace: true })
    const router = useRouter()
    // The card redirect in handleStartKyc keys on the ONE funnel resolver:
    // activationStep === 'card' means funded + eligible + no card. While its
    // queries load the step resolves to a non-card value, so the redirect
    // fails toward region KYC (the trunk), never toward /card.
    const { activationStep } = useActivationStatus()
    const { rails, isKycApproved, railsForProvider, nextActionsForRail, nextActions } = useCapabilities()
    // MIGRATION-REVIEW: unlockedRegions/lockedRegions previously came from
    // `useIdentityVerification` (raw rails + Sumsub flags). Now derived from the
    // capability rails via deriveRegionAccess (same Region shape; faithful unlock
    // mapping, see deriveRegionAccess for the flagged Sumsub-proxy gaps).
    const { unlockedRegions, lockedRegions } = useMemo(() => deriveRegionAccess(rails), [rails])
    // MIGRATION-REVIEW: bridge/manteca rejection state (was useProviderRejectionStatus),
    // and isSumsubApproved (was useUnifiedKycStatus) → the isKycApproved proxy (any enabled
    // rail ⇒ identity cleared at least once), all from the capability model.
    const bridgeRejection = useMemo(() => deriveProviderRejection(rails, 'BRIDGE', nextActions), [rails, nextActions])
    const mantecaRejection = useMemo(() => deriveProviderRejection(rails, 'MANTECA', nextActions), [rails, nextActions])
    const isSumsubApproved = isKycApproved
    const { setIsSupportModalOpen } = useModalsContext()
    const [selectedRegion, setSelectedRegion] = useState<Region | null>(null)
    // keeps the region display stable during modal close animation
    const displayRegionRef = useRef<Region | null>(null)
    if (selectedRegion) displayRegionRef.current = selectedRegion
    // persist region intent for the duration of the kyc session so token refresh
    // and status checks use the correct template after the confirmation modal closes
    const [activeRegionIntent, setActiveRegionIntent] = useState<KYCRegionIntent | undefined>(undefined)
    // when an initiate fails, flow.error is set but the modal that triggered it
    // has already closed — show a dismissible error modal so the user isn't left
    // staring at a screen where "verify now" appeared to do nothing.
    const [errorAcknowledged, setErrorAcknowledged] = useState(false)

    // MIGRATION-REVIEW + CONTRACT GAP: KycFailedModal's terminal-rejection heuristic used
    // sumsubRejectLabels / sumsubRejectType / a rejected-SUMSUB-verification count, all read
    // off raw `user.kycVerifications` via useUnifiedKycStatus. The capability model carries
    // no per-verification Sumsub history (labels, reject type, or attempt count), so these
    // are dropped (passed null/undefined). isTerminalRejection degrades gracefully — without
    // a FINAL reject type or terminal labels it defaults to retryable, and the backend still
    // flips the rail to 'blocked' (→ 'rejected' variant, contact-support CTA) on a final
    // rejection, so a genuinely terminal user is still routed to support via the rail status.
    const sumsubRejectLabels: string[] | null = null
    const sumsubRejectType: 'RETRY' | 'FINAL' | null = null
    const sumsubFailureCount: number | undefined = undefined

    const clickedRegionIntent = selectedRegion ? getRegionIntent(selectedRegion.path) : undefined
    // the clicked region's provider, mirroring the BE registry. null for ROW —
    // no first-party bank provider serves rest-of-world, so no rail to read.
    const clickedRegionProvider = providerForRegionIntent(clickedRegionIntent)
    // the clicked region's downstream provider rail drives the modal state
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

    // override modal variant when sumsub is approved but a provider rejected the user.
    // ROW has no provider (clickedRegionProvider null) → no provider rejection can apply.
    const providerRejectionForRegion = clickedRegionProvider === 'bridge' ? bridgeRejection : mantecaRejection
    // Known reason codes render localized identity.reasons.* copy; unknown
    // codes keep the backend's display-ready prose (#2554: key off codes,
    // never match English text).
    const providerRejectionReasonKey = reasonCodeKey(providerRejectionForRegion.reasonCode)
    const providerRejectionMessage = providerRejectionReasonKey
        ? tIdentity(providerRejectionReasonKey)
        : providerRejectionForRegion.userMessage
    const hasProviderRejectionForRegion =
        !!selectedRegion &&
        clickedRegionProvider !== null &&
        isSumsubApproved &&
        // Any non-happy state has a dedicated rendering in the ActionModal below.
        // Derive from !== 'happy' so a new ProviderRejectionState member can't
        // silently miss this gate again (restart-identity did exactly that).
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

    const handleRegionClick = useCallback((region: Region) => {
        setSelectedRegion(region)
    }, [])

    const handleModalClose = useCallback(() => {
        setSelectedRegion(null)
    }, [])

    const handleStartKyc = useCallback(async () => {
        // Card redirect ONLY when the funnel resolver says card is the step
        // (funded, eligible, no card): send them to /card (KYC on
        // rain-requirements — no regionIntent, no rail enrollment) instead of
        // region KYC. Everyone else — including UNFUNDED card-eligible users —
        // proceeds into region KYC: the trunk is verify → deposit → card
        // (2026-08-20), and the old unconditional redirect both blocked the
        // Brazil cohort from Manteca/PIX verification entirely and failed open
        // toward /card while the card queries were still loading. Keying on
        // activationStep keeps this screen and the home funnel on ONE resolver.
        if (activationStep === 'card') {
            setSelectedRegion(null)
            router.push('/card')
            return
        }
        const intent = selectedRegion ? getRegionIntent(selectedRegion.path) : undefined
        if (intent) setActiveRegionIntent(intent)
        setErrorAcknowledged(false)
        setSelectedRegion(null)
        // A locked region by definition has no functional rail backing it, so
        // clicking one is ALWAYS a cross-region request — send crossRegion
        // unconditionally and let the BE registry pick the provider (it answers
        // 'unsupported-region' for ROW, which no provider serves). The old FE
        // provider-compare derived ROW → manteca, so a Manteca-verified user's
        // ROW click looked same-provider → crossRegion omitted → BE silently
        // early-returned APPROVED → "you're all set" with nothing unlocked.
        // Fresh-KYC safe: the BE's cross-region branches all require an
        // APPROVED verification, so for first-time users the flag is a no-op.
        await flow.handleInitiateKyc(intent, undefined, true)
    }, [flow.handleInitiateKyc, selectedRegion, activationStep, router])

    // ROW (rest-of-world) regions have no provider/rail, so an initiate there is a
    // terminal "not available in your region yet" — not a transient failure. Only
    // offer "Try again" for regions that can actually succeed on a retry.
    const failedRegionRetriable = providerForRegionIntent(activeRegionIntent) !== null

    return (
        <div className="space-y-8 flex min-h-[inherit] flex-col">
            <NavHeader title={t('title')} onPrev={onBack} />
            <div className="my-auto">
                <h1 className="font-bold">{t('title')}</h1>
                <p className="mt-2 text-body-s">{t('description')}</p>

                {/* Pending Bridge verification tasks (ToS / hosted re-verification).
                    Non-dismissible here — this is where the /home card's X sends
                    people to find their tasks again. Self-hiding when none. */}
                <div className="mt-4">
                    <PendingVerificationTasks />
                </div>

                {unlockedRegions.length === 0 && (
                    <EmptyState
                        title={t('empty.title')}
                        description={t('empty.description')}
                        icon="globe-lock"
                        containerClassName="mt-3"
                    />
                )}

                <RegionsList regions={unlockedRegions} isLocked={false} />

                {lockedRegions.length > 0 && (
                    <>
                        <h1 className="mt-5 font-bold">{t('lockedTitle')}</h1>
                        <p className="mt-2 text-body-s">{t('lockedDescription')}</p>

                        <RegionsList regions={lockedRegions} isLocked={true} onRegionClick={handleRegionClick} />
                    </>
                )}
            </div>

            <UnlockRegionModal
                visible={modalVariant === 'start'}
                onClose={handleModalClose}
                onStartVerification={handleStartKyc}
                selectedRegion={displayRegionRef.current}
                isLoading={flow.isLoading}
            />

            <KycProcessingModal visible={modalVariant === 'processing'} onClose={handleModalClose} />

            <KycActionRequiredModal
                visible={modalVariant === 'action_required'}
                onClose={handleModalClose}
                onResubmit={handleStartKyc}
                isLoading={flow.isLoading}
                rejectLabels={sumsubRejectLabels}
            />

            <KycFailedModal
                visible={modalVariant === 'rejected'}
                onClose={handleModalClose}
                onRetry={handleStartKyc}
                isLoading={flow.isLoading}
                rejectLabels={sumsubRejectLabels}
                rejectType={sumsubRejectType}
                failureCount={sumsubFailureCount}
            />

            <ActionModal
                visible={modalVariant === 'provider_rejection'}
                onClose={handleModalClose}
                title={
                    providerRejectionForRegion.state === 'fixable'
                        ? t('providerRejection.fixableTitle')
                        : providerRejectionForRegion.state === 'restart-identity'
                          ? t('providerRejection.restartTitle')
                          : t('providerRejection.unavailableTitle')
                }
                description={
                    providerRejectionForRegion.state === 'fixable'
                        ? providerRejectionMessage || t('providerRejection.fixableDescription')
                        : providerRejectionForRegion.state === 'restart-identity'
                          ? providerRejectionMessage || t('providerRejection.restartDescription')
                          : t('providerRejection.unavailableDescription')
                }
                icon="alert"
                iconContainerClassName="bg-action-secondary"
                ctas={[
                    providerRejectionForRegion.state === 'fixable'
                        ? {
                              text: t('providerRejection.uploadDocument'),
                              onClick: () => {
                                  handleModalClose()
                                  flow.handleFixableRejection(providerRejectionForRegion)
                              },
                              variant: 'purple' as const,
                              shadowSize: '4' as const,
                          }
                        : providerRejectionForRegion.state === 'restart-identity'
                          ? {
                                text: t('providerRejection.restartTitle'),
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
                title={failedRegionRetriable ? t('initError.retriableTitle') : t('initError.notAvailableTitle')}
                description={flow.error || tCommon('genericError')}
                icon="alert"
                iconContainerClassName="bg-action-secondary"
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

export default UnlockedRegions

interface RegionsListProps {
    regions: Region[]
    isLocked: boolean
    onRegionClick?: (region: Region) => void
}
const RegionsList = ({ regions, isLocked, onRegionClick }: RegionsListProps) => {
    const regionLabel = useRegionLabel()

    return (
        <div className="mt-3">
            {regions.map((region, index) => {
                const label = regionLabel(region)
                return (
                    <ListItem
                        key={region.path}
                        leading={
                            <Image
                                src={region.icon}
                                alt={label.name}
                                width={36}
                                height={36}
                                className="size-8 rounded-full object-cover"
                            />
                        }
                        position={getCardPosition(index, regions.length)}
                        title={label.name}
                        onClick={() => {
                            if (isLocked && onRegionClick) {
                                onRegionClick(region)
                            }
                        }}
                        disabled={!isLocked}
                        body={<div className="text-body-xs">{label.description}</div>}
                        trailing={!isLocked ? <Icon name="check" className="size-4 text-green-500" /> : null}
                        chevron={isLocked}
                    />
                )
            })}
        </div>
    )
}
