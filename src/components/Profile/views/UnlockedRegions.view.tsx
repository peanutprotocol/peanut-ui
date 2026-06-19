'use client'

import { ActionListCard } from '@/components/ActionListCard'
import { getCardPosition } from '@/components/Global/Card/card.utils'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import { Icon } from '@/components/Global/Icons/Icon'
import NavHeader from '@/components/Global/NavHeader'
import UnlockRegionModal from '@/components/IdentityVerification/UnlockRegionModal'
import { SumsubKycModals } from '@/components/Kyc/SumsubKycModals'
import { KycProcessingModal } from '@/components/Kyc/modals/KycProcessingModal'
import { KycActionRequiredModal } from '@/components/Kyc/modals/KycActionRequiredModal'
import { KycFailedModal } from '@/components/Kyc/modals/KycFailedModal'
import ActionModal from '@/components/Global/ActionModal'
import { useModalsContext } from '@/context/ModalsContext'
import { deriveRegionAccess, getRegionIntent, providerForRegionIntent, type Region } from '@/utils/regions.utils'
import { useCapabilities } from '@/hooks/useCapabilities'
import { deriveProviderRejection } from '@/utils/provider-rejection.utils'
import { type RailCapability } from '@/types/capabilities'
import { useMultiPhaseKycFlow } from '@/hooks/useMultiPhaseKycFlow'
import Image from 'next/image'
import { useSafeBack } from '@/hooks/useSafeBack'
import { useState, useCallback, useRef, useMemo } from 'react'
import { type KYCRegionIntent } from '@/app/actions/types/sumsub.types'
import { useRouter } from 'next/navigation'
import { useCardInfo } from '@/hooks/useCardInfo'
import { useRainCardOverview } from '@/hooks/useRainCardOverview'
import { findActiveCard } from '@/components/Card/cardState.utils'

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
    const onBack = useSafeBack('/profile', { replace: true })
    const router = useRouter()
    // Card-priority guard: an eligible user (skip badge / admin grant →
    // hasCardAccess) without an active card is steered to /card from the region
    // picker (see handleStartKyc), regardless of region. `hasActiveCard` excludes
    // users who already hold a card so they can still unlock bank regions here.
    const { hasCardAccess } = useCardInfo()
    const { overview } = useRainCardOverview()
    // Tri-state: undefined while the overview is still loading, so a card-holder
    // isn't briefly treated as "no card" and bounced to /card before it resolves.
    const hasActiveCard = useMemo<boolean | undefined>(() => {
        if (!overview) return undefined
        return !!findActiveCard(overview)
    }, [overview])
    const { rails, isKycApproved, railsForProvider, nextActionsForRail } = useCapabilities()
    // MIGRATION-REVIEW: unlockedRegions/lockedRegions previously came from
    // `useIdentityVerification` (raw rails + Sumsub flags). Now derived from the
    // capability rails via deriveRegionAccess (same Region shape; faithful unlock
    // mapping, see deriveRegionAccess for the flagged Sumsub-proxy gaps).
    const { unlockedRegions, lockedRegions } = useMemo(() => deriveRegionAccess(rails), [rails])
    // MIGRATION-REVIEW: bridge/manteca rejection state (was useProviderRejectionStatus),
    // and isSumsubApproved (was useUnifiedKycStatus) → the isKycApproved proxy (any enabled
    // rail ⇒ identity cleared at least once), all from the capability model.
    const bridgeRejection = useMemo(() => deriveProviderRejection(rails, 'BRIDGE'), [rails])
    const mantecaRejection = useMemo(() => deriveProviderRejection(rails, 'MANTECA'), [rails])
    const isSumsubApproved = isKycApproved
    const { setIsSupportModalOpen } = useModalsContext()
    const [selectedRegion, setSelectedRegion] = useState<Region | null>(null)
    // keeps the region display stable during modal close animation
    const displayRegionRef = useRef<Region | null>(null)
    if (selectedRegion) displayRegionRef.current = selectedRegion
    // persist region intent for the duration of the kyc session so token refresh
    // and status checks use the correct template after the confirmation modal closes
    const [activeRegionIntent, setActiveRegionIntent] = useState<KYCRegionIntent | undefined>(undefined)
    // skip StartVerificationView when re-submitting (user already consented)
    const [autoStartSdk, setAutoStartSdk] = useState(false)
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
        setAutoStartSdk(false)
    }, [])

    const flow = useMultiPhaseKycFlow({
        regionIntent: activeRegionIntent,
        onKycSuccess: handleFinalKycSuccess,
        onManualClose: () => {
            setSelectedRegion(null)
            setActiveRegionIntent(undefined)
            setAutoStartSdk(false)
        },
    })

    const handleRegionClick = useCallback((region: Region) => {
        setSelectedRegion(region)
    }, [])

    const handleModalClose = useCallback(() => {
        setSelectedRegion(null)
    }, [])

    const handleStartKyc = useCallback(async () => {
        // Card takes priority for eligible users: if the user has card access but
        // no active card yet, send them to /card (KYC on rain-requirements — no
        // regionIntent, no Bridge/Manteca rail enrollment) instead of starting
        // region KYC, for ANY region they picked. Card-holders fall through and
        // can still unlock bank regions here.
        if (hasCardAccess === true && hasActiveCard === false) {
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
    }, [flow.handleInitiateKyc, selectedRegion, hasCardAccess, hasActiveCard, router])

    // re-submission: skip StartVerificationView since user already consented
    const handleResubmitKyc = useCallback(async () => {
        setAutoStartSdk(true)
        await handleStartKyc()
    }, [handleStartKyc])

    // ROW (rest-of-world) regions have no provider/rail, so an initiate there is a
    // terminal "not available in your region yet" — not a transient failure. Only
    // offer "Try again" for regions that can actually succeed on a retry.
    const failedRegionRetriable = providerForRegionIntent(activeRegionIntent) !== null

    return (
        <div className="flex min-h-[inherit] flex-col space-y-8">
            <NavHeader title="Unlocked regions" onPrev={onBack} titleClassName="text-xl md:text-2xl" />
            <div className="my-auto">
                <h1 className="font-bold">Unlocked regions</h1>
                <p className="mt-2 text-sm">
                    Transfer to and receive from any bank account and use supported payments methods.
                </p>

                {unlockedRegions.length === 0 && (
                    <EmptyState
                        title="No regions unlocked yet"
                        description="Tap a region below to confirm your ID and unlock payments there."
                        icon="globe-lock"
                        containerClassName="mt-3"
                    />
                )}

                <RegionsList regions={unlockedRegions} isLocked={false} />

                {lockedRegions.length > 0 && (
                    <>
                        <h1 className="mt-5 font-bold">Locked regions</h1>
                        <p className="mt-2 text-sm">Where do you want to send and receive money?</p>

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
                onResubmit={handleResubmitKyc}
                isLoading={flow.isLoading}
                rejectLabels={sumsubRejectLabels}
            />

            <KycFailedModal
                visible={modalVariant === 'rejected'}
                onClose={handleModalClose}
                onRetry={handleResubmitKyc}
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
                        ? 'We need an updated document'
                        : providerRejectionForRegion.state === 'restart-identity'
                          ? 'Verify with a different document'
                          : 'Region unavailable'
                }
                description={
                    providerRejectionForRegion.state === 'fixable'
                        ? providerRejectionForRegion.userMessage ||
                          'Please upload a clearer photo of your ID to unlock this region.'
                        : providerRejectionForRegion.state === 'restart-identity'
                          ? providerRejectionForRegion.userMessage ||
                            'This region needs a document from a supported country. You can verify with a different ID.'
                          : 'This region is not available for your account. Contact support for help.'
                }
                icon="alert"
                iconContainerClassName="bg-yellow-1"
                ctas={[
                    providerRejectionForRegion.state === 'fixable'
                        ? {
                              text: 'Upload document',
                              onClick: () => {
                                  handleModalClose()
                                  flow.handleSelfHealResubmit(providerRejectionForRegion.provider)
                              },
                              variant: 'purple' as const,
                              shadowSize: '4' as const,
                          }
                        : providerRejectionForRegion.state === 'restart-identity'
                          ? {
                                text: 'Verify with a different document',
                                onClick: () => {
                                    handleModalClose()
                                    flow.handleRestartIdentity()
                                },
                                variant: 'purple' as const,
                                shadowSize: '4' as const,
                            }
                          : {
                                text: 'Contact support',
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
                title={failedRegionRetriable ? "Verification couldn't start" : 'Not available yet'}
                description={flow.error || 'Something went wrong. Please try again or contact support.'}
                icon="alert"
                iconContainerClassName="bg-yellow-1"
                ctas={
                    failedRegionRetriable
                        ? [
                              {
                                  text: 'Try again',
                                  variant: 'purple',
                                  shadowSize: '4',
                                  disabled: flow.isLoading,
                                  onClick: () => {
                                      void flow.handleInitiateKyc(activeRegionIntent, undefined, true)
                                  },
                              },
                              {
                                  text: 'Contact support',
                                  variant: 'stroke',
                                  onClick: () => {
                                      setErrorAcknowledged(true)
                                      setIsSupportModalOpen(true)
                                  },
                              },
                          ]
                        : [
                              {
                                  text: 'Got it',
                                  variant: 'purple',
                                  shadowSize: '4',
                                  onClick: () => setErrorAcknowledged(true),
                              },
                          ]
                }
            />

            <SumsubKycModals flow={flow} autoStartSdk={autoStartSdk} />
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
    return (
        <div className="mt-3">
            {regions.map((region, index) => (
                <ActionListCard
                    key={region.path}
                    leftIcon={
                        <Image
                            src={region.icon}
                            alt={region.name}
                            width={36}
                            height={36}
                            className="size-8 rounded-full object-cover"
                        />
                    }
                    position={getCardPosition(index, regions.length)}
                    title={region.name}
                    onClick={() => {
                        if (isLocked && onRegionClick) {
                            onRegionClick(region)
                        }
                    }}
                    isDisabled={!isLocked}
                    description={region.description}
                    descriptionClassName="text-xs"
                    rightContent={!isLocked ? <Icon name="check" className="size-4 text-success-1" /> : null}
                />
            ))}
        </div>
    )
}
