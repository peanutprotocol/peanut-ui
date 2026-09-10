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
import { SetupFlowProvider } from '@/features/setup/SetupFlowContext'
import { AuthContext, useAuth } from '@/context/authContext'
import { AccountReadyView } from '@/components/Setup/Views/SignTestTransaction'
import { SetupNotificationsPrompt } from '@/components/Notifications/SetupNotificationsModal'
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
function SetupScreen({ screenId, children }: { screenId: ScreenId; children?: React.ReactNode }) {
    return (
        <SetupFlowProvider>
            <SetupScreenBody screenId={screenId}>{children}</SetupScreenBody>
        </SetupFlowProvider>
    )
}
function GuestCapture({ children }: { children: React.ReactNode }) {
    const auth = useAuth()
    return (
        <AuthContext.Provider value={{ ...auth, user: null, isFetchingUser: false }}>{children}</AuthContext.Provider>
    )
}
function SetupScreenBody({ screenId, children }: { screenId: ScreenId; children?: React.ReactNode }) {
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
            imageClassName={step.imageClassName}
            contentClassName={step.contentClassName}
            step={setupSteps.indexOf(step)}
        >
            {children ?? <View />}
        </SetupWrapper>
    )
}

const noop = () => {}
const asyncNoop = async () => {}

import { AvatarPicker } from '@/components/Avatar/AvatarPicker'
import ProvideEmailStep from '@/components/Kyc/ProvideEmailStep'
import { BridgeTosStep } from '@/components/Kyc/BridgeTosStep'
import KycPrepChecklist from '@/components/Kyc/KycPrepChecklist'
import { KycFailedContent } from '@/components/Kyc/KycFailedContent'
import { RejectLabelsList } from '@/components/Kyc/RejectLabelsList'
import { KycActionRequired } from '@/components/Kyc/states/KycActionRequired'
import RateUnavailable from '@/components/Global/RateUnavailable'
import LimitsWarningCard from '@/features/limits/components/LimitsWarningCard'
import { SURFACE_META, type SurfaceMeta } from './list'
import { PasskeyHelpA, PasskeyHelpB, PasskeyHelpC, PasskeyHelpD } from './options/PasskeyHelpOptions'
import { OnrampA, OnrampB, OnrampC, OnrampD } from './options/OnrampOptions'
import { KycChecklistA, KycChecklistB } from './options/KycChecklistOptions'

export type Surface = SurfaceMeta & {
    /** Mounted open. Absent when `blocked` explains why it cannot be. */
    render?: () => React.ReactNode
    /** Opened by flipping a ModalsContext flag rather than a prop. */
    modalsContextFlag?: 'signIn' | 'support' | 'iosPwaInstall' | 'qrScanner'
}

const europe: Region = { path: 'europe', name: 'Europe', icon: '' }

export const SURFACES: Record<string, Surface> = {
    '01-a-landing': {
        ...SURFACE_META['01-a-landing'],
        render: () => <SetupScreen screenId="landing" />,
    },
    '02-a-joinwaitlist': {
        ...SURFACE_META['02-a-joinwaitlist'],
        render: () => <SetupScreen screenId="welcome" />,
    },
    '03-a-residence-select': {
        ...SURFACE_META['03-a-residence-select'],
        render: () => <SetupScreen screenId="residence" />,
    },
    '04-a-installpwa': {
        ...SURFACE_META['04-a-installpwa'],
        render: () => (
            <GuestCapture>
                <SetupScreen screenId="pwa-install" />
            </GuestCapture>
        ),
    },
    '05-a-signtesttransaction': {
        ...SURFACE_META['05-a-signtesttransaction'],
        render: () => (
            <SetupScreen screenId="sign-test-transaction">
                <AccountReadyView onContinue={noop} />
            </SetupScreen>
        ),
    },
    '06-a-signup': { name: 'Signup', path: 'Setup/Views/Signup.tsx', render: () => <SetupScreen screenId="signup" /> },
    '07-a-setuppasskey': {
        ...SURFACE_META['07-a-setuppasskey'],
        render: () => <SetupScreen screenId="passkey-permission" />,
    },
    '08-a-passkeysetuphelpmodal': {
        ...SURFACE_META['08-a-passkeysetuphelpmodal'],
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
        ...SURFACE_META['09-a-passkeyinfomodal'],
        render: () => <PasskeyInfoModal visible onClose={noop} />,
    },
    '10-a-confirminvitemodal': {
        ...SURFACE_META['10-a-confirminvitemodal'],
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
        ...SURFACE_META['11-a-earlyusermodal'],
    },
    '12-a-eastereggmodal': {
        ...SURFACE_META['12-a-eastereggmodal'],
        render: () => <EasterEggModal visible onClose={noop} countryCode="AQ" />,
    },
    '13-a-guestloginmodal': {
        ...SURFACE_META['13-a-guestloginmodal'],
        modalsContextFlag: 'signIn',
    },
    '14-a-guestverificationmodal': {
        ...SURFACE_META['14-a-guestverificationmodal'],
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
        ...SURFACE_META['15-a-invitefriendsmodal'],
        render: () => <InviteFriendsModal visible onClose={noop} username="demo" />,
    },
    '16-a-iospwainstallmodal': {
        ...SURFACE_META['16-a-iospwainstallmodal'],
        // mounted by the home screen's modal stack, not the app layout, so the
        // harness renders it itself and flips the context flag that opens it
        render: () => <IosPwaInstallModal />,
        modalsContextFlag: 'iosPwaInstall',
    },
    '17-a-nomorejailmodal': {
        ...SURFACE_META['17-a-nomorejailmodal'],
        // opens off sessionStorage showNoMoreJailModal, which the spec seeds
        render: () => <NoMoreJailModal />,
    },
    '18-a-reconsentmodal': {
        ...SURFACE_META['18-a-reconsentmodal'],
    },
    '19-a-unsupportedbrowsermodal': {
        ...SURFACE_META['19-a-unsupportedbrowsermodal'],
        render: () => <UnsupportedBrowserModal visible allowClose />,
    },
    '20-a-setupnotificationsmodal': {
        ...SURFACE_META['20-a-setupnotificationsmodal'],
        render: () => <SetupNotificationsPrompt visible onAllow={noop} onClose={noop} />,
    },
    '21-b-advisorypreemptmodal': {
        ...SURFACE_META['21-b-advisorypreemptmodal'],
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
        ...SURFACE_META['22-b-initiatekycmodal'],
        render: () => <InitiateKycModal visible onClose={noop} onVerify={noop} />,
    },
    '23-b-kycreverificationpendingmodal': {
        ...SURFACE_META['23-b-kycreverificationpendingmodal'],
        render: () => <KycReverificationPendingModal isOpen onClose={noop} />,
    },
    '24-b-kycverificationinprogressmodal': {
        ...SURFACE_META['24-b-kycverificationinprogressmodal'],
        render: () => <KycVerificationInProgressModal isOpen onClose={noop} />,
    },
    '25-b-kycactionrequiredmodal': {
        ...SURFACE_META['25-b-kycactionrequiredmodal'],
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
        ...SURFACE_META['26-b-kycfailedmodal'],
        render: () => <KycFailedModal visible onClose={noop} onRetry={noop} rejectType="RETRY" />,
    },
    '27-b-kycprocessingmodal': {
        ...SURFACE_META['27-b-kycprocessingmodal'],
        render: () => <KycProcessingModal visible onClose={noop} />,
    },
    '28-b-kycregionrestrictedmodal': {
        ...SURFACE_META['28-b-kycregionrestrictedmodal'],
        render: () => <KycRegionRestrictedModal visible onClose={noop} />,
    },
    '29-b-kycstatusdrawer': {
        ...SURFACE_META['29-b-kycstatusdrawer'],
        render: () => <KycStatusDrawer isOpen onClose={noop} />,
    },
    '30-b-unlockmethodmodal': {
        ...SURFACE_META['30-b-unlockmethodmodal'],
        render: () => <UnlockMethodModal visible onClose={noop} onUnlock={noop} methodLabel="SEPA transfers" />,
    },
    '31-b-unlockregionmodal': {
        ...SURFACE_META['31-b-unlockregionmodal'],
        render: () => <UnlockRegionModal visible onClose={noop} onStartVerification={noop} selectedRegion={europe} />,
    },
    '32-c-cancelcardmodal': {
        ...SURFACE_META['32-c-cancelcardmodal'],
        render: () => <CancelCardModal cardId="demo-card" isOpen onClose={noop} />,
    },
    '33-c-cardlimiteditmodal': {
        ...SURFACE_META['33-c-cardlimiteditmodal'],
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
        ...SURFACE_META['34-c-lockcardmodal'],
        render: () => <LockCardModal cardId="demo-card" mode="lock" isOpen onClose={noop} />,
    },
    '35-c-cardunlockdrawer': {
        ...SURFACE_META['35-c-cardunlockdrawer'],
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
        ...SURFACE_META['36-c-badgedetailmodal'],
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
        ...SURFACE_META['37-c-badgestatusdrawer'],
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
        ...SURFACE_META['38-c-howtodepositmodal'],
        render: () => <HowToDepositModal visible onClose={noop} />,
    },
    '39-c-onrampconfirmationmodal': {
        ...SURFACE_META['39-c-onrampconfirmationmodal'],
        render: () => <OnrampConfirmationModal visible onClose={noop} onConfirm={noop} amount="250.00" currency="€" />,
    },
    '40-c-supportednetworksmodal': {
        ...SURFACE_META['40-c-supportednetworksmodal'],
        render: () => <SupportedNetworksModal visible onClose={noop} />,
    },
    '41-c-migrationdownloadmodal': {
        ...SURFACE_META['41-c-migrationdownloadmodal'],
    },
    '43-c-scantodownloadmodal': {
        ...SURFACE_META['43-c-scantodownloadmodal'],
        render: () => <ScanToDownloadModal visible onClose={noop} surface="home_banner" />,
    },
    '44-c-otaupdatemodal': {
        ...SURFACE_META['44-c-otaupdatemodal'],
        render: () => <OtaUpdateModal visible onClose={noop} />,
    },
    '45-c-residencechangemodal': {
        ...SURFACE_META['45-c-residencechangemodal'],
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
        ...SURFACE_META['46-c-perkclaimmodal'],
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
        ...SURFACE_META['47-c-welcomeunlockmodal'],
        render: () => <WelcomeUnlockModal isOpen onClose={noop} />,
    },
    '48-c-balancewarningmodal': {
        ...SURFACE_META['48-c-balancewarningmodal'],
        render: () => <BalanceWarningModal visible onCloseAction={noop} />,
    },
    '49-c-tokenandnetworkconfirmationmodal': {
        ...SURFACE_META['49-c-tokenandnetworkconfirmationmodal'],
        render: () => <TokenAndNetworkConfirmationModal isVisible onClose={noop} onAccept={noop} />,
    },
    '50-d-transactiondetailsdrawer': {
        ...SURFACE_META['50-d-transactiondetailsdrawer'],
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
        ...SURFACE_META['51-d-homeactiondrawers'],
    },
    '52-d-contributorsdrawer': {
        ...SURFACE_META['52-d-contributorsdrawer'],
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
        ...SURFACE_META['53-d-cancelsendlinkdrawer'],
        render: () => (
            <CancelSendLinkDrawer showCancelLinkDrawer setShowCancelLinkDrawer={noop} amount="$25.00" onClick={noop} />
        ),
    },
    '54-d-qrbottomdrawer': {
        ...SURFACE_META['54-d-qrbottomdrawer'],
        modalsContextFlag: 'qrScanner',
    },
    '55-d-supportdrawer': {
        ...SURFACE_META['55-d-supportdrawer'],
        modalsContextFlag: 'support',
    },
    '56-d-camerapermissionmodal': {
        ...SURFACE_META['56-d-camerapermissionmodal'],
        render: () => <CameraPermissionModal visible onRetry={noop} onClose={noop} />,
    },
    '57-d-raincooldownintromodal': {
        ...SURFACE_META['57-d-raincooldownintromodal'],
    },
    '58-d-stalecardapprovalreenablemodal': {
        ...SURFACE_META['58-d-stalecardapprovalreenablemodal'],
    },
    '59-d-successviewdetailscard': {
        ...SURFACE_META['59-d-successviewdetailscard'],
        render: () => (
            <div className="p-4">
                <SuccessViewDetailsCard title="Sent to @ana" amountDisplay="25.00" description="Arrives in minutes" />
            </div>
        ),
    },
    '60-d-offlinescreen': {
        ...SURFACE_META['60-d-offlinescreen'],
        render: () => <OfflineScreen />,
    },
    '61-d-backenderrorscreen': {
        ...SURFACE_META['61-d-backenderrorscreen'],
        render: () => <BackendErrorScreen />,
    },
    '62-d-unsupportedwebviewscreen': {
        ...SURFACE_META['62-d-unsupportedwebviewscreen'],
        render: () => <UnsupportedWebViewScreen />,
    },
    '63-d-emptystate': {
        ...SURFACE_META['63-d-emptystate'],
        render: () => (
            <div className="p-4">
                <EmptyState icon="search" title="Nothing here yet" description="Payments you make will show up here." />
            </div>
        ),
    },
    '64-d-nodataemptystate': {
        ...SURFACE_META['64-d-nodataemptystate'],
        render: () => (
            <div className="p-4">
                <NoDataEmptyState message="No transactions yet" />
            </div>
        ),
    },
    '65-d-faqs': {
        ...SURFACE_META['65-d-faqs'],
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
    '66-e-avatarpicker': {
        ...SURFACE_META['66-e-avatarpicker'],
        render: () => (
            <div className="p-4">
                <AvatarPicker open onOpenChange={noop} />
            </div>
        ),
    },
    '67-e-provideemailstep': {
        ...SURFACE_META['67-e-provideemailstep'],
        render: () => (
            <div className="p-4">
                <ProvideEmailStep visible onComplete={noop} onSkip={noop} />
            </div>
        ),
    },
    '68-e-bridgetosstep': {
        ...SURFACE_META['68-e-bridgetosstep'],
        render: () => (
            <div className="p-4">
                <BridgeTosStep visible onComplete={noop} onSkip={noop} />
            </div>
        ),
    },
    '69-e-kycprepchecklist-standard': {
        ...SURFACE_META['69-e-kycprepchecklist-standard'],
        render: () => (
            <div className="p-4">
                <KycPrepChecklist path="standard" />
            </div>
        ),
    },
    '70-e-kycprepchecklist-extended': {
        ...SURFACE_META['70-e-kycprepchecklist-extended'],
        render: () => (
            <div className="p-4">
                <KycPrepChecklist path="extended" />
            </div>
        ),
    },
    '71-e-kycprepchecklist-hosted': {
        ...SURFACE_META['71-e-kycprepchecklist-hosted'],
        render: () => (
            <div className="p-4">
                <KycPrepChecklist path="hosted" />
            </div>
        ),
    },
    '72-e-kycfailedcontent-terminal': {
        ...SURFACE_META['72-e-kycfailedcontent-terminal'],
        render: () => (
            <div className="p-4">
                <KycFailedContent isTerminal rejectLabels={['DOCUMENT_DAMAGED']} />
            </div>
        ),
    },
    '73-e-rejectlabelslist': {
        ...SURFACE_META['73-e-rejectlabelslist'],
        render: () => (
            <div className="p-4">
                <RejectLabelsList rejectLabels={['DOCUMENT_DAMAGED', 'UNSATISFACTORY_PHOTOS']} />
            </div>
        ),
    },
    '74-e-kycactionrequired': {
        ...SURFACE_META['74-e-kycactionrequired'],
        render: () => (
            <div className="p-4">
                <KycActionRequired onResume={noop} rejectLabels={['UNSATISFACTORY_PHOTOS']} />
            </div>
        ),
    },
    '75-e-rateunavailable': {
        ...SURFACE_META['75-e-rateunavailable'],
        render: () => (
            <div className="p-4">
                <RateUnavailable onRetry={noop} />
            </div>
        ),
    },
    '76-e-limitswarningcard-warning': {
        ...SURFACE_META['76-e-limitswarningcard-warning'],
        render: () => (
            <div className="p-4">
                <LimitsWarningCard
                    type="warning"
                    titleKind="warning"
                    title="Transaction limit"
                    items={[{ text: 'You can pay up to $500 today.' }]}
                />
            </div>
        ),
    },
    '77-e-limitswarningcard-error': {
        ...SURFACE_META['77-e-limitswarningcard-error'],
        render: () => (
            <div className="p-4">
                <LimitsWarningCard
                    type="error"
                    titleKind="blocking"
                    title="Transaction limit"
                    items={[{ text: 'You can pay up to $500 today.' }]}
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
