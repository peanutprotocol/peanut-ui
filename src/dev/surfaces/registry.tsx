'use client'

/**
 * Every modal, drawer and full-screen surface in the content-taxonomy review,
 * each mounted open so the visual-shot harness can photograph it.
 *
 * A surface is either `render`able — it takes an open/visible prop we can set —
 * or `blocked`: it opens itself from live state (an API answer, a permission
 * result, a stored flag) and there is no prop to force. Those carry a reason
 * instead of a component, so the gallery says why a screen is missing rather
 * than shooting an empty page.
 */

import React from 'react'
import { useTranslations } from 'next-intl'
import type { Region } from '@/utils/regions.utils'
import { setupSteps } from '@/components/Setup/Setup.consts'
import { SetupWrapper } from '@/components/Setup/components/SetupWrapper'
import type { ScreenId } from '@/components/Setup/Setup.types'

import { PasskeySetupHelpModal } from '@/components/Setup/Views/PasskeySetupHelpModal'
import PasskeyInfoModal from '@/components/Setup/components/PasskeyInfoModal'
import ConfirmInviteModal from '@/components/Global/ConfirmInviteModal'
import EasterEggModal from '@/components/Global/EasterEggModal'
import { GuestVerificationModal } from '@/components/Global/GuestVerificationModal'
import InviteFriendsModal from '@/components/Global/InviteFriendsModal'
import UnsupportedBrowserModal from '@/components/Global/UnsupportedBrowserModal'
import AdvisoryPreemptModal from '@/components/Kyc/AdvisoryPreemptModal'
import { InitiateKycModal } from '@/components/Kyc/InitiateKycModal'
import { KycReverificationPendingModal } from '@/components/Kyc/KycReverificationPendingModal'
import { KycVerificationInProgressModal } from '@/components/Kyc/KycVerificationInProgressModal'
import { KycActionRequiredModal } from '@/components/Kyc/modals/KycActionRequiredModal'
import { KycFailedModal } from '@/components/Kyc/modals/KycFailedModal'
import { KycProcessingModal } from '@/components/Kyc/modals/KycProcessingModal'
import { KycRegionRestrictedModal } from '@/components/Kyc/modals/KycRegionRestrictedModal'
import { KycStatusDrawer } from '@/components/Kyc/KycStatusDrawer'
import UnlockMethodModal from '@/components/IdentityVerification/UnlockMethodModal'
import UnlockRegionModal from '@/components/IdentityVerification/UnlockRegionModal'
import CancelCardModal from '@/components/Card/CancelCardModal'
import CardLimitEditModal from '@/components/Card/CardLimitEditModal'
import LockCardModal from '@/components/Card/LockCardModal'
import { CardUnlockDrawer } from '@/components/Card/CardUnlockDrawer'
import { BadgeDetailModal } from '@/components/Badges/BadgeDetailModal'
import { BadgeStatusDrawer } from '@/components/Badges/BadgeStatusDrawer'
import HowToDepositModal from '@/components/AddMoney/components/HowToDepositModal'
import { OnrampConfirmationModal } from '@/components/AddMoney/components/OnrampConfirmationModal'
import SupportedNetworksModal from '@/components/AddMoney/components/SupportedNetworksModal'
import ScanToDownloadModal from '@/components/Migration/ScanToDownloadModal'
import OtaUpdateModal from '@/components/Profile/components/OtaUpdateModal'
import ResidenceChangeModal from '@/components/Profile/views/ResidenceChangeModal'
import WelcomeUnlockModal from '@/components/Home/WelcomeUnlockModal'
import BalanceWarningModal from '@/components/Global/BalanceWarningModal'
import TokenAndNetworkConfirmationModal from '@/components/Global/TokenAndNetworkConfirmationModal'
import CancelSendLinkDrawer from '@/components/Global/CancelSendLinkDrawer'
import CameraPermissionModal from '@/components/Global/QRScanner/CameraPermissionModal'
import { SuccessViewDetailsCard } from '@/components/Global/SuccessViewComponents/SuccessViewDetailsCard'
import OfflineScreen from '@/components/Global/OfflineScreen'
import BackendErrorScreen from '@/components/Global/BackendErrorScreen'
import { UnsupportedWebViewScreen } from '@/components/Global/UnsupportedWebViewScreen'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import NoDataEmptyState from '@/components/Global/EmptyStates/NoDataEmptyState'
import { FAQsPanel } from '@/components/Global/FAQs'
import { TransactionDetailsDrawer } from '@/components/TransactionDetails/TransactionDetailsDrawer'
import { ContributorsDrawer } from '@/features/payments/flows/contribute-pot/components/ContributorsDrawer'
import PerkClaimModal from '@/components/Home/PerkClaimModal'
import IosPwaInstallModal from '@/components/Global/IosPwaInstallModal'
import NoMoreJailModal from '@/components/Global/NoMoreJailModal'

/**
 * A setup step exactly as /setup renders it — SetupWrapper driven by the step's
 * own entry in Setup.consts, so the hero, clouds, title, back/skip and progress
 * are the app's, not the harness's. Mounting the view bare (which this harness
 * did first) drops all of that and photographs a naked form.
 */
function SetupScreen({ screenId }: { screenId: ScreenId }) {
    const t = useTranslations('setup')
    const step = setupSteps.find((entry) => entry.screenId === screenId)
    if (!step) return null
    const View = step.component
    const titleKey = `steps.${step.screenId}.title` as Parameters<typeof t>[0]
    const descriptionKey = `steps.${step.screenId}.description` as Parameters<typeof t>[0]
    return (
        <SetupWrapper
            layoutType={step.layoutType}
            screenId={step.screenId}
            image={step.image}
            title={!step.titleInView ? t(titleKey) : undefined}
            description={!step.descriptionInView && t.has(descriptionKey) ? t(descriptionKey) : undefined}
            showBackButton={step.showBackButton}
            showSkipButton={step.showSkipButton}
            showLogoutButton={step.screenId === 'sign-test-transaction'}
            showLoginButton={step.showLoginButton}
            imageClassName={step.imageClassName}
            contentClassName={step.contentClassName}
            step={setupSteps.indexOf(step)}
        >
            <View />
        </SetupWrapper>
    )
}

const noop = () => {}
const asyncNoop = async () => {}

import { SURFACE_META, type SurfaceMeta } from './list'
import { PasskeyHelpA, PasskeyHelpB, PasskeyHelpC, PasskeyHelpD } from './options/PasskeyHelpOptions'
import { OnrampA, OnrampB, OnrampC, OnrampD } from './options/OnrampOptions'
import { KycChecklistA, KycChecklistB } from './options/KycChecklistOptions'

export type Surface = SurfaceMeta & {
    /** Mounted open. Absent when `blocked` explains why it cannot be. */
    render?: () => React.ReactNode
    /** Opened by flipping a ModalsContext flag rather than a prop. */
    modalsContextFlag?: 'signIn' | 'support' | 'iosPwaInstall'
}

const europe: Region = { path: 'europe', name: 'Europe', icon: '' }

export const SURFACES: Record<string, Surface> = {
    '01-a-landing': {
        name: 'Landing',
        path: 'Setup/Views/Landing.tsx',
        render: () => <SetupScreen screenId="landing" />,
    },
    '02-a-joinwaitlist': {
        name: 'JoinWaitlist',
        path: 'Setup/Views/JoinWaitlist.tsx',
        render: () => <SetupScreen screenId="welcome" />,
    },
    '03-a-residence-select': {
        name: 'Residence — select',
        path: 'Setup/Views/Residence.tsx',
        render: () => <SetupScreen screenId="residence" />,
    },
    '04-a-installpwa': {
        name: 'InstallPWA',
        path: 'Setup/Views/InstallPWA.tsx',
        blocked:
            'Redirects to /home when a session exists (InstallPWA.tsx:75), and the harness is signed in — the shot lands on the home screen, not this step.',
    },
    '05-a-signtesttransaction': {
        name: 'SignTestTransaction — account ready',
        path: 'Setup/Views/SignTestTransaction.tsx',
        blocked:
            'Redirects to /home when the fixture account already exists (SignTestTransaction guards on accountExists), so the harness never reaches the account-ready state.',
    },
    '06-a-signup': { name: 'Signup', path: 'Setup/Views/Signup.tsx', render: () => <SetupScreen screenId="signup" /> },
    '07-a-setuppasskey': {
        name: 'SetupPasskey',
        path: 'Setup/Views/SetupPasskey.tsx',
        render: () => <SetupScreen screenId="passkey-permission" />,
    },
    '08-a-passkeysetuphelpmodal': {
        name: 'PasskeySetupHelpModal',
        path: 'Setup/Views/PasskeySetupHelpModal.tsx',
        render: () => (
            <PasskeySetupHelpModal
                visible
                onClose={noop}
                onRetry={noop}
                errorName="NotAllowedError"
                platform="android"
            />
        ),
    },
    '09-a-passkeyinfomodal': {
        name: 'PasskeyInfoModal',
        path: 'Setup/components/PasskeyInfoModal.tsx',
        render: () => <PasskeyInfoModal visible onClose={noop} />,
    },
    '10-a-confirminvitemodal': {
        name: 'ConfirmInviteModal',
        path: 'Global/ConfirmInviteModal/index.tsx',
        render: () => (
            <ConfirmInviteModal
                isOpen
                onClose={noop}
                method="Google"
                handleLoseInvite={noop}
                handleContinueWithPeanut={noop}
            />
        ),
    },
    '11-a-earlyusermodal': {
        name: 'EarlyUserModal',
        path: 'Global/EarlyUserModal/index.tsx',
        blocked: 'Opens itself from the signed-in user’s creation date — no visible prop.',
    },
    '12-a-eastereggmodal': {
        name: 'EasterEggModal',
        path: 'Global/EasterEggModal/index.tsx',
        render: () => <EasterEggModal visible onClose={noop} countryCode="AQ" />,
    },
    '13-a-guestloginmodal': {
        name: 'GuestLoginModal',
        path: 'Global/GuestLoginModal/index.tsx',
        modalsContextFlag: 'signIn',
    },
    '14-a-guestverificationmodal': {
        name: 'GuestVerificationModal',
        path: 'Global/GuestVerificationModal/index.tsx',
        render: () => (
            <GuestVerificationModal
                isOpen
                onClose={noop}
                description="The sender can't send to a bank yet. Claim another way, or create and verify an account to receive it in your bank."
                secondaryCtaLabel="Claim with other method"
            />
        ),
    },
    '15-a-invitefriendsmodal': {
        name: 'InviteFriendsModal',
        path: 'Global/InviteFriendsModal/index.tsx',
        render: () => <InviteFriendsModal visible onClose={noop} username="demo" />,
    },
    '16-a-iospwainstallmodal': {
        name: 'IosPwaInstallModal',
        path: 'Global/IosPwaInstallModal/index.tsx',
        // mounted by the home screen's modal stack, not the app layout, so the
        // harness renders it itself and flips the context flag that opens it
        render: () => <IosPwaInstallModal />,
        modalsContextFlag: 'iosPwaInstall',
    },
    '17-a-nomorejailmodal': {
        name: 'NoMoreJailModal',
        path: 'Global/NoMoreJailModal/index.tsx',
        // opens off sessionStorage showNoMoreJailModal, which the spec seeds
        render: () => <NoMoreJailModal />,
    },
    '18-a-reconsentmodal': {
        name: 'ReConsentModal',
        path: 'Global/ReConsentModal/index.tsx',
        blocked: 'Opens only when the consent-status endpoint reports outdated documents.',
    },
    '19-a-unsupportedbrowsermodal': {
        name: 'UnsupportedBrowserModal',
        path: 'Global/UnsupportedBrowserModal/index.tsx',
        render: () => <UnsupportedBrowserModal visible allowClose />,
    },
    '20-a-setupnotificationsmodal': {
        name: 'SetupNotificationsModal',
        path: 'Notifications/SetupNotificationsModal.tsx',
        blocked: 'Opens off the browser push-permission state — not forceable headless.',
    },
    '21-b-advisorypreemptmodal': {
        name: 'AdvisoryPreemptModal',
        path: 'Kyc/AdvisoryPreemptModal.tsx',
        render: () => (
            <AdvisoryPreemptModal
                visible
                effectiveDate="2026-10-01"
                onCompleteNow={noop}
                onDoLater={noop}
                onClose={noop}
            />
        ),
    },
    '22-b-initiatekycmodal': {
        name: 'InitiateKycModal (default)',
        path: 'Kyc/InitiateKycModal.tsx',
        render: () => <InitiateKycModal visible onClose={noop} onVerify={noop} />,
    },
    '23-b-kycreverificationpendingmodal': {
        name: 'KycReverificationPendingModal',
        path: 'Kyc/KycReverificationPendingModal.tsx',
        render: () => <KycReverificationPendingModal isOpen onClose={noop} />,
    },
    '24-b-kycverificationinprogressmodal': {
        name: 'KycVerificationInProgressModal (verifying)',
        path: 'Kyc/KycVerificationInProgressModal.tsx',
        render: () => <KycVerificationInProgressModal isOpen onClose={noop} />,
    },
    '25-b-kycactionrequiredmodal': {
        name: 'KycActionRequiredModal',
        path: 'Kyc/modals/KycActionRequiredModal.tsx',
        render: () => (
            <KycActionRequiredModal
                visible
                onClose={noop}
                onResubmit={noop}
                rejectLabels={['PROBLEMATIC_APPLICANT_DATA']}
            />
        ),
    },
    '26-b-kycfailedmodal': {
        name: 'KycFailedModal',
        path: 'Kyc/modals/KycFailedModal.tsx',
        render: () => <KycFailedModal visible onClose={noop} onRetry={noop} rejectType="RETRY" />,
    },
    '27-b-kycprocessingmodal': {
        name: 'KycProcessingModal',
        path: 'Kyc/modals/KycProcessingModal.tsx',
        render: () => <KycProcessingModal visible onClose={noop} />,
    },
    '28-b-kycregionrestrictedmodal': {
        name: 'KycRegionRestrictedModal',
        path: 'Kyc/modals/KycRegionRestrictedModal.tsx',
        render: () => <KycRegionRestrictedModal visible onClose={noop} />,
    },
    '29-b-kycstatusdrawer': {
        name: 'KycStatusDrawer (action-needed)',
        path: 'Kyc/KycStatusDrawer.tsx',
        render: () => <KycStatusDrawer isOpen onClose={noop} />,
    },
    '30-b-unlockmethodmodal': {
        name: 'UnlockMethodModal',
        path: 'IdentityVerification/UnlockMethodModal.tsx',
        render: () => <UnlockMethodModal visible onClose={noop} onUnlock={noop} methodLabel="SEPA transfers" />,
    },
    '31-b-unlockregionmodal': {
        name: 'UnlockRegionModal',
        path: 'IdentityVerification/UnlockRegionModal.tsx',
        render: () => <UnlockRegionModal visible onClose={noop} onStartVerification={noop} selectedRegion={europe} />,
    },
    '32-c-cancelcardmodal': {
        name: 'CancelCardModal (confirm phase)',
        path: 'Card/CancelCardModal.tsx',
        render: () => <CancelCardModal cardId="demo-card" isOpen onClose={noop} />,
    },
    '33-c-cardlimiteditmodal': {
        name: 'CardLimitEditModal',
        path: 'Card/CardLimitEditModal.tsx',
        render: () => (
            <CardLimitEditModal
                cardId="demo-card"
                frequency="per24HourPeriod"
                label="Daily limit"
                initialAmountCents={50000}
                isOpen
                onClose={noop}
            />
        ),
    },
    '34-c-lockcardmodal': {
        name: 'LockCardModal (lock)',
        path: 'Card/LockCardModal.tsx',
        render: () => <LockCardModal cardId="demo-card" mode="lock" isOpen onClose={noop} />,
    },
    '35-c-cardunlockdrawer': {
        name: 'CardUnlockDrawer',
        path: 'Card/CardUnlockDrawer.tsx',
        render: () => (
            <CardUnlockDrawer
                isOpen
                onClose={noop}
                username="demo"
                entry={{ unlockedAt: '2026-08-01T10:00:00.000Z', position: 42 } as never}
            />
        ),
    },
    '36-c-badgedetailmodal': {
        name: 'BadgeDetailModal',
        path: 'Badges/BadgeDetailModal.tsx',
        render: () => (
            <BadgeDetailModal
                isOpen
                onClose={noop}
                code="first-invite"
                title="First Invite"
                description="You invited your first friend to Peanut."
                logo="/badges/first-invite.webp"
            />
        ),
    },
    '37-c-badgestatusdrawer': {
        name: 'BadgeStatusDrawer',
        path: 'Badges/BadgeStatusDrawer.tsx',
        render: () => (
            <BadgeStatusDrawer
                isOpen
                onClose={noop}
                badge={{
                    code: 'first-invite',
                    name: 'First Invite',
                    description: 'You invited your first friend to Peanut.',
                    iconUrl: '/badges/first-invite.webp',
                    earnedAt: '2026-08-01T10:00:00.000Z',
                }}
            />
        ),
    },
    '38-c-howtodepositmodal': {
        name: 'HowToDepositModal',
        path: 'AddMoney/components/HowToDepositModal.tsx',
        render: () => <HowToDepositModal visible onClose={noop} />,
    },
    '39-c-onrampconfirmationmodal': {
        name: 'OnrampConfirmationModal',
        path: 'AddMoney/components/OnrampConfirmationModal.tsx',
        render: () => <OnrampConfirmationModal visible onClose={noop} onConfirm={noop} amount="250.00" currency="€" />,
    },
    '40-c-supportednetworksmodal': {
        name: 'SupportedNetworksModal',
        path: 'AddMoney/components/SupportedNetworksModal.tsx',
        render: () => <SupportedNetworksModal visible onClose={noop} />,
    },
    '41-c-migrationdownloadmodal': {
        name: 'MigrationDownloadModal (early)',
        path: 'Migration/MigrationDownloadModal.tsx',
        blocked: 'Opens itself off the sunset countdown and a stored dismissal — no visible prop.',
    },
    '42-c-reviewpromptmodal': {
        name: 'ReviewPromptModal',
        path: 'Migration/ReviewPromptModal.tsx',
        blocked: 'Opens itself after a happy-moment event and a stored cooldown — no visible prop.',
    },
    '43-c-scantodownloadmodal': {
        name: 'ScanToDownloadModal',
        path: 'Migration/ScanToDownloadModal.tsx',
        render: () => <ScanToDownloadModal visible onClose={noop} surface="home_banner" />,
    },
    '44-c-otaupdatemodal': {
        name: 'OtaUpdateModal (normal)',
        path: 'Profile/components/OtaUpdateModal.tsx',
        render: () => <OtaUpdateModal visible onClose={noop} />,
    },
    '45-c-residencechangemodal': {
        name: 'ResidenceChangeModal',
        path: 'Profile/views/ResidenceChangeModal.tsx',
        render: () => (
            <ResidenceChangeModal
                visible
                onClose={noop}
                userId="demo-user"
                declared="ESP"
                verified="ESP"
                onSaved={asyncNoop}
                onReverify={noop}
            />
        ),
    },
    '46-c-perkclaimmodal': {
        name: 'PerkClaimModal',
        path: 'Home/PerkClaimModal.tsx',
        render: () => (
            <PerkClaimModal
                visible
                onClose={noop}
                onClaimed={noop}
                perk={{
                    id: 'perk-1',
                    name: 'Invite bonus',
                    amountUsd: 5,
                    createdAt: '2026-08-01T10:00:00.000Z',
                    inviteeName: 'Ana',
                }}
            />
        ),
    },
    '47-c-welcomeunlockmodal': {
        name: 'WelcomeUnlockModal',
        path: 'Home/WelcomeUnlockModal/index.tsx',
        render: () => <WelcomeUnlockModal isOpen onClose={noop} />,
    },
    '48-c-balancewarningmodal': {
        name: 'BalanceWarningModal',
        path: 'Global/BalanceWarningModal/index.tsx',
        render: () => <BalanceWarningModal visible onCloseAction={noop} />,
    },
    '49-c-tokenandnetworkconfirmationmodal': {
        name: 'TokenAndNetworkConfirmationModal',
        path: 'Global/TokenAndNetworkConfirmationModal/index.tsx',
        render: () => <TokenAndNetworkConfirmationModal isVisible onClose={noop} onAccept={noop} />,
    },
    '50-d-transactiondetailsdrawer': {
        name: 'TransactionDetailsDrawer',
        path: 'TransactionDetails/TransactionDetailsDrawer.tsx',
        render: () => (
            <TransactionDetailsDrawer
                isOpen
                onClose={noop}
                transaction={
                    {
                        id: 'demo-tx',
                        direction: 'OUTGOING',
                        userName: 'ana',
                        fullName: 'Ana Ruiz',
                        amount: 25,
                        initials: 'AR',
                        status: 'completed',
                        date: '2026-08-01T10:00:00.000Z',
                        memo: 'Dinner',
                    } as never
                }
                transactionAmount="$25.00"
            />
        ),
    },
    '51-d-homeactiondrawers': {
        name: 'HomeActionDrawers',
        path: 'features/home/components/HomeActionDrawers.tsx',
        blocked: 'Driven by the home screen’s own action state — nothing to force from outside.',
    },
    '52-d-contributorsdrawer': {
        name: 'ContributorsDrawer',
        path: 'features/payments/flows/contribute-pot/components/ContributorsDrawer.tsx',
        render: () => (
            <ContributorsDrawer
                contributors={[
                    { uuid: 'c1', username: 'ana', amount: '25.00', createdAt: '2026-08-01T10:00:00.000Z' },
                    { uuid: 'c2', username: 'bruno', amount: '10.00', createdAt: '2026-08-01T11:00:00.000Z' },
                ]}
            />
        ),
    },
    '53-d-cancelsendlinkdrawer': {
        name: 'CancelSendLinkDrawer',
        path: 'Global/CancelSendLinkDrawer/index.tsx',
        render: () => (
            <CancelSendLinkDrawer showCancelLinkDrawer setShowCancelLinkDrawer={noop} amount="$25.00" onClick={noop} />
        ),
    },
    '54-d-qrbottomdrawer': {
        name: 'QRBottomDrawer',
        path: 'Global/QRBottomDrawer/index.tsx',
        blocked:
            'Always-open snap-point drawer: it starts at its peek snap and is positioned against the screen behind it, so on an empty harness page it sits off-frame.',
    },
    '55-d-supportdrawer': {
        name: 'SupportDrawer (chat-failed)',
        path: 'Global/SupportDrawer/index.tsx',
        modalsContextFlag: 'support',
    },
    '56-d-camerapermissionmodal': {
        name: 'CameraPermissionModal',
        path: 'Global/QRScanner/CameraPermissionModal.tsx',
        render: () => <CameraPermissionModal visible onRetry={noop} onClose={noop} />,
    },
    '57-d-raincooldownintromodal': {
        name: 'RainCooldownIntroModal',
        path: 'Global/RainCooldown/IntroModal.tsx',
        blocked: 'Opens from RainCooldownContext after a card-collateral event.',
    },
    '58-d-stalecardapprovalreenablemodal': {
        name: 'StaleCardApprovalReEnableModal',
        path: 'Global/StaleCardApproval/ReEnableModal.tsx',
        blocked: 'Opens itself when the stale-approval check fails on a live card.',
    },
    '59-d-successviewdetailscard': {
        name: 'SuccessViewDetailsCard',
        path: 'Global/SuccessViewComponents/SuccessViewDetailsCard.tsx',
        render: () => (
            <div className="p-4">
                <SuccessViewDetailsCard title="Sent to @ana" amountDisplay="25.00" description="Arrives in minutes" />
            </div>
        ),
    },
    '60-d-offlinescreen': {
        name: 'OfflineScreen',
        path: 'Global/OfflineScreen/index.tsx',
        render: () => <OfflineScreen />,
    },
    '61-d-backenderrorscreen': {
        name: 'BackendErrorScreen',
        path: 'Global/BackendErrorScreen/index.tsx',
        render: () => <BackendErrorScreen />,
    },
    '62-d-unsupportedwebviewscreen': {
        name: 'UnsupportedWebViewScreen',
        path: 'Global/UnsupportedWebViewScreen/index.tsx',
        render: () => <UnsupportedWebViewScreen />,
    },
    '63-d-emptystate': {
        name: 'EmptyState',
        path: 'Global/EmptyStates/EmptyState.tsx',
        render: () => (
            <div className="p-4">
                <EmptyState icon="search" title="Nothing here yet" description="Payments you make will show up here." />
            </div>
        ),
    },
    '64-d-nodataemptystate': {
        name: 'NoDataEmptyState',
        path: 'Global/EmptyStates/NoDataEmptyState.tsx',
        render: () => (
            <div className="p-4">
                <NoDataEmptyState message="No transactions yet" />
            </div>
        ),
    },
    '65-d-faqs': {
        name: 'FAQs',
        path: 'Global/FAQs/index.tsx',
        render: () => (
            <div className="p-4">
                <FAQsPanel
                    heading="Frequently asked questions"
                    questions={[
                        { id: 'q1', question: 'How long does a transfer take?', answer: 'Usually a few minutes.' },
                        { id: 'q2', question: 'What does it cost?', answer: 'No fee on Peanut-to-Peanut payments.' },
                    ]}
                />
            </div>
        ),
    },
}

/** The open reworks, one render per option, so a choice can be made by eye. */
export const OPTION_SURFACES: Record<string, { name: string; render: () => React.ReactNode }> = {
    'opt-passkey-a': { name: 'PasskeySetupHelpModal — A', render: () => <PasskeyHelpA /> },
    'opt-passkey-b': { name: 'PasskeySetupHelpModal — B', render: () => <PasskeyHelpB /> },
    'opt-passkey-c': { name: 'PasskeySetupHelpModal — C', render: () => <PasskeyHelpC /> },
    'opt-passkey-d': { name: 'PasskeySetupHelpModal — D', render: () => <PasskeyHelpD /> },
    'opt-onramp-a': { name: 'OnrampConfirmationModal — A', render: () => <OnrampA /> },
    'opt-onramp-b': { name: 'OnrampConfirmationModal — B', render: () => <OnrampB /> },
    'opt-onramp-c': { name: 'OnrampConfirmationModal — C', render: () => <OnrampC /> },
    'opt-onramp-d': { name: 'OnrampConfirmationModal — D', render: () => <OnrampD /> },
    'opt-kyc-a': { name: 'KycPrepChecklist — A (bullets)', render: () => <KycChecklistA /> },
    'opt-kyc-b': { name: 'KycPrepChecklist — B (DataRow)', render: () => <KycChecklistB /> },
}

export const SURFACE_IDS = Object.keys(SURFACE_META).sort()
