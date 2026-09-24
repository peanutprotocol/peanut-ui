'use client'

import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import { type IconName } from '@/components/Global/Icons/Icon'
import NavHeader from '@/components/Global/NavHeader'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
import AccountsList from './AccountsList'
import Badge from '@/components/Global/Badges/Badge'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { CONCEPT_ICONS } from '@/components/0_Bruddle/conceptIcons'
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
import { deriveRegionAccess, isBridgeSupportedCountry } from '@/utils/regions.utils'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useQueryClient } from '@tanstack/react-query'
import { LIMITS } from '@/constants/query.consts'
import { useCardInfo } from '@/hooks/useCardInfo'
import { useRainCardOverview } from '@/hooks/useRainCardOverview'
import { useLimits } from '@/hooks/useLimits'
import { limitSummariesForRows, MethodLimits } from './MethodLimits'
import { rowStatusBadge, isRowTappable, BUBBLE_COLOR } from './RowStatusBadge'
import { findActiveCard } from '@/components/Card/cardState.utils'
import { useResidenceRestrictions } from '@/hooks/useResidenceRestrictions'
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
    type BankRegionChip,
    type BankRowKey,
    type UnlockGroup,
    type UnlockRow,
    type UnlockRowLabelKey,
} from '@/utils/unlock-payments.utils'
import { localizedCountryTitle } from '@/utils/country-name.utils'
import { readDeclaredResidence, readSecondResidence, storeSecondResidence } from '@/utils/declared-residence.storage'
import { countryData } from '@/components/AddMoney/consts'
import { useTranslations, useLocale } from 'next-intl'
import { useSafeBack } from '@/hooks/useSafeBack'
import { useState, useCallback, useEffect, useMemo } from 'react'
import { type KYCRegionIntent } from '@/app/actions/types/sumsub.types'
import { useRouter } from 'next/navigation'
import { parseAsString, useQueryState } from 'nuqs'

type ModalVariant = 'start' | 'processing' | 'action_required' | 'rejected'

/** Gate states that mean "a rail is here, it just cannot move money yet". */
const MID_FLIGHT_GATES: ReadonlySet<string> = new Set([
    'pending',
    'waiting-on-provider',
    'accept-tos',
    'fixable-rejection',
    'provide-email',
])

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
    const { rails, isKycApproved, nextActionsForRail, canDo, gateFor } = useCapabilities()
    const restrictions = useResidenceRestrictions()
    const { identity, isProcessing: isIdentityInReview, isRegionRestricted } = useIdentityVerification()
    const isKycDegraded = useKycDegraded()
    const { cardInfo } = useCardInfo()
    const queryClient = useQueryClient()
    const { overview } = useRainCardOverview()
    const { mantecaLimits, bridgeLimits } = useLimits()
    const { setIsSupportModalOpen } = useModalsContext()

    const { unlockedRegions } = useMemo(() => deriveRegionAccess(rails), [rails])
    const isSumsubApproved = isKycApproved

    // ── list model ──────────────────────────────────────────────────────────

    /**
     * The chip for one currency's bank corridor, read from the rails of that
     * corridor's own COUNTRY.
     *
     * Two separate truths are folded in here. Holding a rail is not being
     * allowed to use it: every Sumsub-approved user is enrolled on the QR-tier
     * Manteca rails whatever their residence, so the rail is `enabled` because
     * `pay` is while `deposit` and `withdraw` stay `requires-info`. A bank row
     * says Available only when the user can move money on one of those two
     * operations. And a provider is not a currency: scoping by provider gave
     * the US and Mexico — both Bridge — one shared verdict, so a user with a
     * working US rail read "Available" on a row that also named MXN. The gate
     * is the hook's own country-scoped primitive; nothing here walks rails.
     */
    const bankChipFor = useCallback(
        (key: BankRowKey): BankRegionChip => {
            const scope = { channel: 'bank' as const, country: BANK_ROW_COUNTRIES[key] }
            const kinds = [gateFor('deposit', scope).kind, gateFor('withdraw', scope).kind]
            if (kinds.includes('ready')) return 'active'
            // Only support can lift a blocked rail, so that one row says so.
            if (kinds.includes('blocked-rejection') || kinds.includes('restart-identity')) return 'attention'
            // A rail that exists but cannot move money yet is mid-flight,
            // whatever it is waiting on — provisioning, a document, a ToS.
            // Unlock is reserved for a corridor with no rail behind it at all,
            // because that is the only case where the tap starts something.
            if (kinds.some((kind) => MID_FLIGHT_GATES.has(kind))) return 'processing'
            return 'unlock'
        },
        [gateFor]
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
                bankChips: {
                    brl: bankChipFor('brl'),
                    ars: bankChipFor('ars'),
                    usd: bankChipFor('usd'),
                    mxn: bankChipFor('mxn'),
                    sepa: bankChipFor('sepa'),
                },
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
                residenceIso2,
                secondResidenceIso2: declaredSecondIso2,
                isEuropeResidence: isEuropeIso2(residenceIso2) || isEuropeIso2(declaredSecondIso2),
            }),
        [
            bankChipFor,
            canDo,
            unlockedRegions,
            restrictions,
            hasActiveCard,
            cardInfo?.geoProhibited,
            residenceIso2,
            declaredSecondIso2,
        ]
    )

    // The three lists this screen shows, named by group id rather than by
    // position: the bank rows feed the "Add and withdraw money" list, the
    // other two get their own sections below it.
    const peanutGroup = groups.find((group) => group.id === 'everywhere')
    const spendGroup = groups.find((group) => group.id === 'spend')
    const bankGroups = groups.filter((group) => group.id !== 'everywhere' && group.id !== 'spend')

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
    // repeated it. The banking note stays — it covers rails whose rows are
    // absent from the list entirely.
    const showBankRestrictionNote = restrictions.banking
    // A bank row withheld for residence alone (the Manteca corridors outside
    // their country) gets its reason in one line under the list, the same way
    // the restriction note explains rows the restriction hides.
    const showResidenceNote =
        !restrictions.banking && bankGroups.some((group) => group.rows.some((row) => row.chip === 'notAvailable'))

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
                    leading={<IconBubble {...CONCEPT_ICONS.otherCountries} size="s" />}
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

            {/* Currency-first merge (2026-09-18): every receiving corridor —
                held VA accounts and the KYC-unlock bank/QR rows alike — in one
                "Your accounts" list, flag-led, region headers dropped. The
                first group is always "everywhere" (buildUnlockGroups), and its
                own-region-first sort survives into the flattened row order. */}
            <AccountsList
                bankRows={bankGroups.flatMap((group) => group.rows)}
                onRowClick={handleRowClick}
                isKycDegraded={isKycDegraded}
            />

            {/* Spending methods, apart from the ways money moves between a bank
                and Peanut. */}
            {spendGroup && <RowSection group={spendGroup} onRowClick={handleRowClick} isKycDegraded={isKycDegraded} />}

            {peanutGroup && (
                <RowSection group={peanutGroup} onRowClick={handleRowClick} isKycDegraded={isKycDegraded} />
            )}

            {showBankRestrictionNote && (
                <p className="text-body-xs text-foreground-secondary">{t('bankNotAvailableNote')}</p>
            )}
            {showResidenceNote && <p className="text-body-xs text-foreground-secondary">{t('residenceNote')}</p>}

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
                declaredSecond={declaredSecondIso2}
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
 * The two icon-led sections under the bank list: "Spend" (card + QR payments)
 * and "Peanut" (the always-on P2P and crypto rows). The bank/QR corridor rows
 * live in `AccountsList`, alongside the held account rows.
 */
/**
 * Peanut-native rows keep their concept bubble (CONCEPT_ICONS) instead of the
 * status-color bubble every other row uses: the Peanut user and the card look
 * the same here as on the Send page and in activity.
 */
function peanutRowLeading(row: UnlockRow, size: 's' | 'm' = 's') {
    if (row.labelKey === 'p2p') {
        return <IconBubble {...CONCEPT_ICONS.peanutUser} size={size} />
    }
    if (row.labelKey === 'card') {
        return <IconBubble {...CONCEPT_ICONS.card} size={size} />
    }
    return <IconBubble icon={row.icon as IconName} size={size} color={BUBBLE_COLOR[row.chip]} />
}

const RowSection = ({
    group,
    onRowClick,
    isKycDegraded,
}: {
    group: UnlockGroup
    onRowClick: (row: UnlockRow) => void
    isKycDegraded: boolean
}) => {
    const t = useTranslations('profile.unlockPayments')

    return (
        <Section title={t(`groups.${group.labelKey}`)}>
            <ListGroup>
                {group.rows.map((row) => {
                    const tappable = isRowTappable(row, isKycDegraded)
                    return (
                        <ListItem
                            key={row.id}
                            className="min-h-18"
                            disabled={row.chip === 'notAvailable'}
                            leading={peanutRowLeading(row)}
                            title={<span className="break-words whitespace-normal">{t(`rows.${row.labelKey}`)}</span>}
                            // QR payments and Pix keys are the rows people do
                            // not recognise by name, so each carries its
                            // explainer under the title — the countries and
                            // key types, which wrapped the title over three
                            // lines at 375px.
                            body={
                                row.labelKey === 'qrPay'
                                    ? t('qrPayNote')
                                    : row.labelKey === 'pixKey'
                                      ? t('pixKeyNote')
                                      : undefined
                            }
                            bodyWrap
                            trailing={rowStatusBadge(row, t)}
                            chevron={tappable}
                            onClick={tappable ? () => onRowClick(row) : undefined}
                        />
                    )
                })}
            </ListGroup>
        </Section>
    )
}
