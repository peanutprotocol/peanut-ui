'use client'

import Image from 'next/image'
import { PEANUTMAN } from '@/assets/mascot'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import { type IconName } from '@/components/Global/Icons/Icon'
import NavHeader from '@/components/Global/NavHeader'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
import VirtualAccountsHub from './VirtualAccountsHub'
import { AccountsHubList } from '@/features/deposit-accounts/components/AccountsHubList'
import { ClosedRowDrawer } from '@/features/deposit-accounts/components/ClosedRowDrawer'
import type { ClosedRow } from '@/features/deposit-accounts/hubRows'
import { useDepositAccountsEnabled } from '@/features/deposit-accounts/useDepositAccountsEnabled'
import { useBankRows } from '@/hooks/useBankRows'
import Badge from '@/components/Global/Badges/Badge'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { Callout } from '@/components/0_Bruddle/Callout'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { Section } from '@/components/0_Bruddle/Section'
import UnlockMethodModal from '@/components/IdentityVerification/UnlockMethodModal'
import ResidenceChangeDrawer from '@/components/Profile/views/ResidenceChangeDrawer'
import { SumsubKycModals } from '@/components/Kyc/SumsubKycModals'
import PendingVerificationTasks from '@/components/Home/PendingVerificationTasks'
import { KycProcessingModal } from '@/components/Kyc/modals/KycProcessingModal'
import { KycActionRequiredModal } from '@/components/Kyc/modals/KycActionRequiredModal'
import { KycFailedModal } from '@/components/Kyc/modals/KycFailedModal'
import { KycRegionRestrictedModal } from '@/components/Kyc/modals/KycRegionRestrictedModal'
import ActionModal from '@/components/Global/ActionModal'
import { useModalsContext } from '@/context/ModalsContext'
import { getRegionIntent, providerForRegionIntent, type Region } from '@/utils/regions.utils'
import { deriveRegionAccess } from '@/utils/regions.utils'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useQueryClient } from '@tanstack/react-query'
import { LIMITS } from '@/constants/query.consts'
import { useCardInfo } from '@/hooks/useCardInfo'
import { useRainCardOverview } from '@/hooks/useRainCardOverview'
import { useLimits } from '@/hooks/useLimits'
import { limitSummariesForRows, MethodLimits } from './MethodLimits'
import { rowStatusBadge, isRowTappable, BUBBLE_COLOR } from './RowStatusBadge'
import { findActiveCard } from '@/components/Card/cardState.utils'
import { useIdentityVerification } from '@/hooks/useIdentityVerification'
import { useKycDegraded } from '@/hooks/useKycDegraded'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import posthog from 'posthog-js'
import { deriveProviderRejection } from '@/utils/provider-rejection.utils'
import { isTerminalRailRejection } from '@/utils/capability-gate'
import { reasonCodeKey } from '@/constants/capability-reason-labels.consts'
import { type RailCapability } from '@/types/capabilities'
import { useMultiPhaseKycFlow } from '@/hooks/useMultiPhaseKycFlow'
import { useAuth } from '@/context/authContext'
import {
    BANK_ROW_COUNTRIES,
    buildUnlockGroups,
    withPixSend,
    type BankRowKey,
    type UnlockGroup,
    type UnlockRow,
    type UnlockRowLabelKey,
} from '@/utils/unlock-payments.utils'
import { localizedCountryTitle } from '@/utils/country-name.utils'
import { countryData } from '@/components/AddMoney/consts'
import { useTranslations, useLocale } from 'next-intl'
import { useSafeBack } from '@/hooks/useSafeBack'
import { useState, useCallback, useMemo } from 'react'
import { type KYCRegionIntent } from '@/app/actions/types/sumsub.types'
import { useRouter } from 'next/navigation'
import { parseAsString, useQueryState } from 'nuqs'

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

const UnlockPayments = () => {
    const t = useTranslations('profile.unlockPayments')
    const tRegions = useTranslations('profile.regions')
    const tCommon = useTranslations('common')
    const tIdentity = useTranslations('identity')
    const locale = useLocale()
    const onBack = useSafeBack('/profile', { replace: true })
    const router = useRouter()
    const [openView, setOpenView] = useQueryState('open', parseAsString)
    const [detailsRow, setDetailsRow] = useState<UnlockRow | null>(null)
    const { user, fetchUser } = useAuth()
    const { rails, isKycApproved, nextActionsForRail, canDo } = useCapabilities()
    const { identity, isProcessing: isIdentityInReview, isRegionRestricted } = useIdentityVerification()
    const isKycDegraded = useKycDegraded()
    const { cardInfo } = useCardInfo()
    const queryClient = useQueryClient()
    const { overview } = useRainCardOverview()
    const { mantecaLimits, bridgeLimits } = useLimits()
    const { setIsSupportModalOpen } = useModalsContext()

    const { unlockedRegions } = useMemo(() => deriveRegionAccess(rails), [rails])
    const isSumsubApproved = isKycApproved
    const depositAccountsEnabled = useDepositAccountsEnabled()

    // ── list model ──────────────────────────────────────────────────────────

    const {
        rows: bankRows,
        input: { bankChips, restrictions },
        residence,
        residenceIso2,
        secondResidenceIso2,
    } = useBankRows()
    const hasActiveCard = !!findActiveCard(overview)

    const groups = useMemo(
        () =>
            buildUnlockGroups({
                bankChips,
                // QR is a `pay` capability, read as one: the pool-tier rails
                // every verified user holds pay by QR even though they cannot
                // deposit or withdraw. `unlockedRegions` still covers the
                // legacy Bridge-only cohort, who pay by QR with no Manteca
                // rail at all.
                canPayQr:
                    canDo('pay', { provider: 'manteca' }) ||
                    unlockedRegions.some((region) => region.path === 'brazil' || region.path === 'argentina'),
                // the /qr-pay gate itself (useQrPayKycGate), so the Pix key row
                // never links a user that screen would turn back
                canPayPixKey: canDo('pay', { provider: 'manteca' }),
                restrictions,
                // New applications are public; retain known residence restrictions.
                card: hasActiveCard ? 'active' : restrictions.card || cardInfo?.geoProhibited ? 'notAvailable' : 'get',
            }),
        [bankChips, canDo, unlockedRegions, restrictions, hasActiveCard, cardInfo?.geoProhibited]
    )

    // The two lists beside the bank rows, named by group id rather than by position.
    const peanutGroup = groups.find((group) => group.id === 'everywhere')
    const spendGroup = groups.find((group) => group.id === 'spend')
    const pixKeyRow = spendGroup?.rows.find((row) => row.id === 'pix-key')
    const accountBankRows = useMemo(() => withPixSend(bankRows, pixKeyRow), [bankRows, pixKeyRow])
    // A Spend row the user cannot use explains why on tap, like the bank rows
    // (hugo, 2026-09-24: "always show the rails, tell the user why").
    const [closedSpendRow, setClosedSpendRow] = useState<ClosedRow | null>(null)
    const closeSpendRow = useCallback(
        (row: UnlockRow) =>
            setClosedSpendRow({
                kind: row.labelKey === 'card' && !restrictions.banking ? 'card-restricted' : 'restricted-country',
                label: t(`rows.${row.labelKey}`),
            }),
        [restrictions.banking, t]
    )

    // ── modal machinery (carried over from the retired UnlockedRegions view) ──
    const [selectedRegion, setSelectedRegion] = useState<Region | null>(null)
    const [selectedMethodLabel, setSelectedMethodLabel] = useState<string | null>(null)
    // The tapped row, so the modal reads the rails of THAT row's country. A
    // region intent covers two countries (Brazil and Argentina share LATAM),
    // and a provider-wide read let a Brazilian row narrate an Argentine rail —
    // the abandoned awaiting-action ghost, "setting up your account" forever
    // on a Pix row it had nothing to do with (189 users in prod, 2026-09-22).
    const [selectedRowKey, setSelectedRowKey] = useState<UnlockRowLabelKey | null>(null)
    // Card recovery deep-links here when only a pending residence change is
    // blocking issuance. Keep the deep link live rather than snapshotting it,
    // and clear it when the drawer closes so refresh/native restore cannot
    // reopen a completed recovery flow.
    const [isChangeModalOpen, setIsChangeModalOpen] = useState(false)
    const isResidenceChangeVisible = isChangeModalOpen || openView === 'residence'
    const closeResidenceChange = useCallback(() => {
        setIsChangeModalOpen(false)
        void setOpenView(null, { history: 'replace' })
    }, [setOpenView])
    const [activeRegionIntent, setActiveRegionIntent] = useState<KYCRegionIntent | undefined>(undefined)
    const [errorAcknowledged, setErrorAcknowledged] = useState(false)
    const [reverifyTarget, setReverifyTarget] = useState<string | null>(null)

    const clickedRegionIntent = selectedRegion ? getRegionIntent(selectedRegion.path) : undefined
    const clickedRegionProvider = providerForRegionIntent(clickedRegionIntent)
    // Same scope `bankChipFor` reads the chip from: the QR row has no country
    // of its own (the pool rails span both), so it keeps the provider-wide read.
    const clickedRowCountry =
        selectedRowKey && selectedRowKey in BANK_ROW_COUNTRIES ? BANK_ROW_COUNTRIES[selectedRowKey as BankRowKey] : null
    const clickedRegionRails = useMemo(() => {
        if (!selectedRegion || !clickedRegionProvider) return []
        return rails.filter(
            (rail) =>
                rail.provider === clickedRegionProvider && (!clickedRowCountry || rail.country === clickedRowCountry)
        )
    }, [selectedRegion, clickedRegionProvider, clickedRowCountry, rails])
    const clickedRegionRail =
        clickedRegionRails.find(
            (rail) => rail.status === 'pending' || rail.status === 'requires-info' || rail.status === 'blocked'
        ) ?? clickedRegionRails[0]
    const clickedRailHasSumsubAction = clickedRegionRail
        ? nextActionsForRail(clickedRegionRail.id).some((action) => action.kind === 'sumsub')
        : false
    const baseModalVariant = selectedRegion ? getModalVariant(clickedRegionRail, clickedRailHasSumsubAction) : null
    // Only support can unblock a terminally rejected rail. This surface holds
    // none of the Sumsub reject fields the modal reads, so it always offered
    // "Try again" — a retry that cannot succeed, on the one screen of three
    // that did not say so. The rail's own verdict is the answer.
    const clickedRailIsTerminal = useMemo(() => {
        if (!clickedRegionRail) return false
        const byKey = new Map(nextActionsForRail(clickedRegionRail.id).map((action) => [action.key, action]))
        return isTerminalRailRejection(clickedRegionRail, byKey)
    }, [clickedRegionRail, nextActionsForRail])

    // Scoped like the rail above: a rejection on another country's rail is not
    // a verdict on this row. A provider-wide restriction marks every rail of
    // that provider, so it still shows here.
    const providerRejectionForRegion = useMemo(
        () => deriveProviderRejection(clickedRegionRails, clickedRegionProvider === 'bridge' ? 'BRIDGE' : 'MANTECA'),
        [clickedRegionRails, clickedRegionProvider]
    )
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
        setSelectedRowKey(null)
        setActiveRegionIntent(undefined)
    }, [])

    const flow = useMultiPhaseKycFlow({
        regionIntent: activeRegionIntent,
        onKycSuccess: handleFinalKycSuccess,
        onManualClose: () => {
            setSelectedRegion(null)
            setSelectedRowKey(null)
            setActiveRegionIntent(undefined)
        },
    })

    const handleModalClose = useCallback(() => {
        setSelectedRegion(null)
        setSelectedRowKey(null)
    }, [])

    // Deliberately NO card redirect here (the old screen's Europe→/card hijack):
    // the card is its own row with its own destination, so a bank-method tap can
    // only ever start bank KYC.
    const handleStartKyc = useCallback(async () => {
        const intent = selectedRegion ? getRegionIntent(selectedRegion.path) : undefined
        if (intent) setActiveRegionIntent(intent)
        setReverifyTarget(null)
        setErrorAcknowledged(false)
        setSelectedRegion(null)
        setSelectedRowKey(null)
        // The backend only reads a target country as a Manteca geo (and refuses
        // any other), so the row's country goes along for the Manteca rows: it
        // names which of the two LATAM flows the tap meant, where a residence
        // fallback would guess for a dual resident.
        const targetCountry = clickedRegionProvider === 'manteca' && clickedRowCountry ? clickedRowCountry : undefined
        // Always cross-region: a locked method has no functional rail behind it,
        // and the flag is a no-op for first-time KYC (retired UnlockedRegions view).
        await flow.handleInitiateKyc(intent, undefined, true, targetCountry)
    }, [flow.handleInitiateKyc, selectedRegion, clickedRegionProvider, clickedRowCountry])

    const handleRowClick = useCallback(
        (row: UnlockRow) => {
            if (row.href) {
                router.push(row.href)
                return
            }
            if (row.chip === 'active' || row.chip === 'alwaysOn') {
                setDetailsRow(row)
                return
            }
            if (!row.regionPath) return
            // During a verification outage the unlock modal renders its degraded
            // variant (choke point in InitiateKycModal covers the other gates);
            // here the shared UnlockMethodModal is ours, so gate the tap itself.
            if (isKycDegraded) return
            setSelectedMethodLabel(t(`rows.${row.labelKey}`))
            setSelectedRowKey(row.labelKey)
            // Synthetic Region: the modal machinery only reads path (intent) and
            // name (display); icons are not shown in the modal itself.
            setSelectedRegion({ path: row.regionPath, name: t(`groups.${regionGroupKey(row.regionPath)}`), icon: '' })
        },
        [router, t, isKycDegraded]
    )

    // What both forms of the shared list take from this screen.
    const hubProps = {
        bankRows: accountBankRows,
        onBankRowClick: handleRowClick,
        onChangeResidence: () => setIsChangeModalOpen(true),
        isKycDegraded,
    }

    // A residence re-verification never sets a region intent, so without the
    // flag its failure would read as "Not available yet" instead of retriable.
    const failedRegionRetriable = reverifyTarget !== null || providerForRegionIntent(activeRegionIntent) !== null

    const countryDisplayName = (iso2: string | null): string | null =>
        iso2
            ? localizedCountryTitle(locale, {
                  iso2,
                  title: countryData.find((c) => c.iso2?.toUpperCase() === iso2)?.title ?? iso2,
              })
            : null
    const residenceCountryName = countryDisplayName(residenceIso2)
    const pendingCountryName = countryDisplayName(residence?.pending ?? null)

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
    // repeated it. The banking note stays — it covers card issuing too. A bank
    // row withheld for residence alone explains itself in the list's drawer.
    const showBankRestrictionNote = restrictions.banking

    const residenceTrailing = !residenceIso2 ? undefined : residence?.verified ? (
        <Badge status="completed" customText={t('residence.verified')} />
    ) : (
        <Badge status="neutral" customText={t('residence.unverified')} />
    )

    // Detail-drawer facts. Limits live HERE and nowhere else on this screen
    // (2026-09-21, hugo): three standing cards — the Bridge per-transfer caps,
    // the BRL/ARS monthly bars and the P2P no-limit line — sat above the fold
    // and repeated what a tap already says. Same derivation, same formatting,
    // one tap down. The Limits block is hidden when a method publishes none.
    const detailSummaries = detailsRow ? limitSummariesForRows([detailsRow], mantecaLimits, bridgeLimits, locale) : []
    const detailNoLimit = detailsRow?.labelKey === 'p2p' || detailsRow?.labelKey === 'crypto'
    const showDetailLimits = detailNoLimit || detailSummaries.length > 0

    return (
        <PageStack gap="6" className="pb-10">
            <NavHeader title={t('title')} onPrev={onBack} titleClassName="text-heading-xs md:text-heading-s" />

            {/* Residence anchor: explains WHY the list looks the way it does. */}
            <div className="flex flex-col gap-1">
                <ListItem
                    leading={<IconBubble icon="globe" size="s" color="blue" />}
                    // two-line row: the country sits on its own body line and wraps rather than
                    // truncating beside the status pill (TASK-22994, hugo)
                    title={residenceCountryName ? t('residence.label') : t('residence.unknown')}
                    body={residenceCountryName ?? undefined}
                    bodyWrap
                    trailing={residenceTrailing}
                    chevron
                    onClick={() => setIsChangeModalOpen(true)}
                    aria-label={residenceIso2 ? t('residence.change') : t('residence.set')}
                />
                {residence?.verified && residence?.pending && (
                    <p className="text-center text-body-xs text-foreground-secondary">
                        {t('residence.pendingReverify', { country: pendingCountryName ?? residence.pending })}
                    </p>
                )}
            </div>

            {isKycDegraded && (
                <Callout
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
                </Callout>
            )}

            {isIdentityInReview && identity.reviewPending === true && !isKycDegraded && (
                <Callout
                    priority="helper"
                    title={
                        reviewSubmittedDate
                            ? t('review.sinceDate', { submittedDate: reviewSubmittedDate })
                            : t('review.since')
                    }
                >
                    {reviewEscalation ? (
                        <div className="flex flex-col items-start gap-1">
                            <span>{t('review.escalation')}</span>
                            <LinkButton onClick={() => setIsSupportModalOpen(true)}>{t('review.messageUs')}</LinkButton>
                        </div>
                    ) : (
                        t('review.body')
                    )}
                </Callout>
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

            {/* The list Add money shows too: virtual accounts held and to open,
                then the other ways in. The accounts are read only while their
                rollout flag is on (`VirtualAccountsHub` owns that fetch). */}
            {depositAccountsEnabled ? (
                <VirtualAccountsHub {...hubProps} />
            ) : (
                <AccountsHubList claimsEnabled={false} {...hubProps} />
            )}

            {/* Spending methods, apart from the ways money moves between a bank
                and Peanut. */}
            {spendGroup && (
                <RowSection
                    group={spendGroup}
                    onRowClick={handleRowClick}
                    onClosedRowClick={closeSpendRow}
                    isKycDegraded={isKycDegraded}
                />
            )}
            <ClosedRowDrawer
                closed={closedSpendRow}
                onClose={() => setClosedSpendRow(null)}
                onChangeResidence={() => setIsChangeModalOpen(true)}
            />

            {peanutGroup && (
                <RowSection group={peanutGroup} onRowClick={handleRowClick} isKycDegraded={isKycDegraded} />
            )}

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

            <ResidenceChangeDrawer
                visible={isResidenceChangeVisible}
                onClose={closeResidenceChange}
                userId={user?.user?.userId}
                declared={residence?.declared ?? null}
                declaredSecond={secondResidenceIso2}
                verified={residence?.verified ?? null}
                pending={residence?.pending ?? null}
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
                onReverify={(targetCountry) => {
                    setReverifyTarget(targetCountry)
                    setErrorAcknowledged(false)
                    void flow.handleResidenceChange(targetCountry)
                }}
            />

            <KycProcessingModal
                visible={modalVariant === 'processing'}
                onClose={handleModalClose}
                pendingSince={clickedRegionRail?.pendingSince}
                waitingOnProvider={clickedRegionRail?.resolved?.nextAction?.kind === 'wait'}
                onResume={handleStartKyc}
                onContactSupport={() => {
                    handleModalClose()
                    setIsSupportModalOpen(true)
                }}
            />

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
                isTerminal={clickedRailIsTerminal}
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
                                  // This IS the surface the residence cohort reaches.
                                  // REQUIRES_SUPPORT maps to a top-level rail status of
                                  // `blocked`, and `hasFunctionalRail` tests that field,
                                  // so their region is LOCKED, they tap it, and this
                                  // modal opens with copy asking for their address over
                                  // a button that 404s.
                                  //
                                  // Gated on the one reason code rather than routing
                                  // everything through the handler: that would also
                                  // divert every Manteca fixable rejection here from
                                  // resubmit to start-action, which is a change this has
                                  // no reason to make.
                                  if (providerRejectionForRegion.reasonCode === 'residence_unresolved') {
                                      void flow.handleFixableRejection(providerRejectionForRegion)
                                      return
                                  }
                                  flow.handleSelfHealResubmit(providerRejectionForRegion.provider)
                              },
                              variant: 'primary' as const,
                              shadowSize: '4' as const,
                          }
                        : providerRejectionForRegion.state === 'restart-identity'
                          ? {
                                text: tRegions('providerRejection.restartTitle'),
                                onClick: () => {
                                    handleModalClose()
                                    flow.handleRestartIdentity()
                                },
                                variant: 'primary' as const,
                                shadowSize: '4' as const,
                            }
                          : {
                                text: tCommon('contactSupport'),
                                onClick: () => {
                                    handleModalClose()
                                    setIsSupportModalOpen(true)
                                },
                                variant: 'primary' as const,
                                shadowSize: '4' as const,
                            },
                ]}
            />

            <ActionModal
                visible={!!flow.error && !flow.errorCooldown && !errorAcknowledged}
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
                                  variant: 'primary',
                                  shadowSize: '4',
                                  disabled: flow.isLoading,
                                  onClick: () => {
                                      if (reverifyTarget) void flow.handleResidenceChange(reverifyTarget)
                                      else void flow.handleInitiateKyc(activeRegionIntent, undefined, true)
                                  },
                              },
                              {
                                  text: tCommon('contactSupport'),
                                  variant: 'secondary',
                                  onClick: () => {
                                      setErrorAcknowledged(true)
                                      setIsSupportModalOpen(true)
                                  },
                              },
                          ]
                        : [
                              {
                                  text: tCommon('gotIt'),
                                  variant: 'primary',
                                  shadowSize: '4',
                                  onClick: () => setErrorAcknowledged(true),
                              },
                          ]
                }
            />

            <Drawer open={!!detailsRow} onOpenChange={(open) => !open && setDetailsRow(null)}>
                <DrawerContent>
                    {detailsRow && (
                        <div className="flex flex-col gap-6 pt-1 pb-6">
                            {/* Hero: method mark + name + one-line value prop.
                                Mirrors InitiateKycModal's drawer hero (IconBubble
                                + DrawerHeader/DrawerTitle + a secondary line). */}
                            <div className="flex flex-col items-center gap-4 text-center">
                                {peanutRowLeading(detailsRow, 'm')}
                                <DrawerHeader className="w-full gap-2 p-0 text-center sm:text-center">
                                    <DrawerTitle>{t(`rows.${detailsRow.labelKey}`)}</DrawerTitle>
                                    <DrawerDescription>{t(`valueProp.${detailsRow.labelKey}`)}</DrawerDescription>
                                </DrawerHeader>
                            </div>

                            {/* What you can do: the same Section + ListGroup +
                                ListItem row vocabulary the page's own row lists
                                use, with a green check to read as a capability. */}
                            <Section title={t('detailsDrawer.aboutTitle')}>
                                <ListGroup>
                                    <ListItem
                                        leading={<IconBubble icon="check" size="s" color="green" />}
                                        title={
                                            <span className="break-words whitespace-normal">
                                                {t(`details.${detailsRow.labelKey}`)}
                                            </span>
                                        }
                                    />
                                </ListGroup>
                            </Section>

                            {/* Limits: the only place this screen states them. */}
                            {showDetailLimits && (
                                <Section title={t('detailsDrawer.limitsTitle')}>
                                    <MethodLimits noLimit={detailNoLimit} summaries={detailSummaries} />
                                </Section>
                            )}
                        </div>
                    )}
                </DrawerContent>
            </Drawer>

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

/**
 * Peanut-native rows keep their own brand mark instead of the generic
 * status-color bubble every other row uses — same assets as elsewhere in the
 * app (grep, don't invent): the mascot-on-yellow from the Contacts entry row
 * (SendRouter.view.tsx) and the card-on-yellow avatar background rows use for
 * a card spend with no merchant logo (TransactionAvatarBadge's AVATAR_WALLET_BG).
 */
function peanutRowLeading(row: UnlockRow, size: 's' | 'm' = 's') {
    if (row.labelKey === 'p2p') {
        return (
            <IconBubble
                icon={<Image src={PEANUTMAN} alt="" className={size === 's' ? 'h-5 w-auto' : 'h-8 w-auto'} />}
                size={size}
                color="yellow"
            />
        )
    }
    if (row.labelKey === 'card') {
        return <IconBubble icon="credit-card" size={size} color="yellow" />
    }
    return <IconBubble icon={row.icon as IconName} size={size} color={BUBBLE_COLOR[row.chip]} />
}

const RowSection = ({
    group,
    onRowClick,
    onClosedRowClick,
    isKycDegraded,
}: {
    group: UnlockGroup
    onRowClick: (row: UnlockRow) => void
    /** a Not available row: the tap explains why instead of doing nothing */
    onClosedRowClick?: (row: UnlockRow) => void
    isKycDegraded: boolean
}) => {
    const t = useTranslations('profile.unlockPayments')

    return (
        <Section title={t(`groups.${group.labelKey}`)}>
            <ListGroup>
                {group.rows.map((row) => {
                    const closed = row.chip === 'notAvailable' && onClosedRowClick
                    const tappable = isRowTappable(row, isKycDegraded)
                    return (
                        <ListItem
                            key={row.id}
                            className="min-h-18"
                            // a closed row that explains itself is still a tap target,
                            // as the bank rows are (AccountsHubList)
                            disabled={row.chip === 'notAvailable' && !closed}
                            leading={peanutRowLeading(row)}
                            title={t(`rows.${row.labelKey}`)}
                            // QR payments and Pix keys are the rows people do
                            // not recognise by name, so each carries its
                            // explainer under the title — the countries and
                            // key types, which wrapped the title over three
                            // lines at 375px.
                            body={row.note && t(row.note)}
                            bodyWrap
                            trailing={rowStatusBadge(row, t)}
                            chevron={tappable || !!closed}
                            onClick={
                                closed ? () => onClosedRowClick(row) : tappable ? () => onRowClick(row) : undefined
                            }
                        />
                    )
                })}
            </ListGroup>
        </Section>
    )
}
