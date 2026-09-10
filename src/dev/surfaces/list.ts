/**
 * The surface list, as plain data. Kept free of component imports so the
 * Playwright shot spec (e2e/shots/surfaces.spec.ts) can require it under Node —
 * the same rule src/dev/fixtures/registry.ts follows.
 *
 * `blocked` marks a surface that opens itself from live state and has no prop
 * to force; the gallery prints the reason instead of a staged mock.
 */

export type SurfaceMeta = {
    name: string
    path: string
    blocked?: string
}

export const SURFACE_META: Record<string, SurfaceMeta> = {
    '01-a-landing': { name: 'Landing', path: 'Setup/Views/Landing.tsx' },
    '02-a-joinwaitlist': { name: 'JoinWaitlist', path: 'Setup/Views/JoinWaitlist.tsx' },
    '03-a-residence-select': { name: 'Residence — select', path: 'Setup/Views/Residence.tsx' },
    '04-a-installpwa': {
        name: 'InstallPWA',
        path: 'Setup/Views/InstallPWA.tsx',
        blocked:
            'Redirects to /home when a session exists (InstallPWA.tsx:75), and the harness is signed in — the shot lands on the home screen, not this step.',
    },
    '05-a-signtesttransaction': {
        name: 'SignTestTransaction — account ready',
        path: 'Setup/Views/SignTestTransaction.tsx',
    },
    '06-a-signup': { name: 'Signup', path: 'Setup/Views/Signup.tsx' },
    '07-a-setuppasskey': { name: 'SetupPasskey', path: 'Setup/Views/SetupPasskey.tsx' },
    '08-a-passkeysetuphelpmodal': { name: 'PasskeySetupHelpModal', path: 'Setup/Views/PasskeySetupHelpModal.tsx' },
    '09-a-passkeyinfomodal': { name: 'PasskeyInfoModal', path: 'Setup/components/PasskeyInfoModal.tsx' },
    '10-a-confirminvitemodal': { name: 'ConfirmInviteModal', path: 'Global/ConfirmInviteModal/index.tsx' },
    '11-a-earlyusermodal': {
        name: 'EarlyUserModal',
        path: 'Global/EarlyUserModal/index.tsx',
        blocked: 'Opens itself from the signed-in user’s creation date — no visible prop.',
    },
    '12-a-eastereggmodal': { name: 'EasterEggModal', path: 'Global/EasterEggModal/index.tsx' },
    '13-a-guestloginmodal': { name: 'GuestLoginModal', path: 'Global/GuestLoginModal/index.tsx' },
    '14-a-guestverificationmodal': { name: 'GuestVerificationModal', path: 'Global/GuestVerificationModal/index.tsx' },
    '15-a-invitefriendsmodal': { name: 'InviteFriendsModal', path: 'Global/InviteFriendsModal/index.tsx' },
    '16-a-iospwainstallmodal': { name: 'IosPwaInstallModal', path: 'Global/IosPwaInstallModal/index.tsx' },
    '17-a-nomorejailmodal': { name: 'NoMoreJailModal', path: 'Global/NoMoreJailModal/index.tsx' },
    '18-a-reconsentmodal': {
        name: 'ReConsentModal',
        path: 'Global/ReConsentModal/index.tsx',
        blocked:
            'Opens only when the consent-status endpoint reports outdated documents — needs a fixture that serves them, which does not exist yet.',
    },
    '19-a-unsupportedbrowsermodal': {
        name: 'UnsupportedBrowserModal',
        path: 'Global/UnsupportedBrowserModal/index.tsx',
    },
    '20-a-setupnotificationsmodal': {
        name: 'SetupNotificationsModal',
        path: 'Notifications/SetupNotificationsModal.tsx',
        blocked:
            'Driven by a module-level notifications store whose setter is not exported, off the browser push-permission state.',
    },
    '21-b-advisorypreemptmodal': { name: 'AdvisoryPreemptModal', path: 'Kyc/AdvisoryPreemptModal.tsx' },
    '22-b-initiatekycmodal': { name: 'InitiateKycModal (default)', path: 'Kyc/InitiateKycModal.tsx' },
    '23-b-kycreverificationpendingmodal': {
        name: 'KycReverificationPendingModal',
        path: 'Kyc/KycReverificationPendingModal.tsx',
    },
    '24-b-kycverificationinprogressmodal': {
        name: 'KycVerificationInProgressModal (verifying)',
        path: 'Kyc/KycVerificationInProgressModal.tsx',
    },
    '25-b-kycactionrequiredmodal': { name: 'KycActionRequiredModal', path: 'Kyc/modals/KycActionRequiredModal.tsx' },
    '26-b-kycfailedmodal': { name: 'KycFailedModal', path: 'Kyc/modals/KycFailedModal.tsx' },
    '27-b-kycprocessingmodal': { name: 'KycProcessingModal', path: 'Kyc/modals/KycProcessingModal.tsx' },
    '28-b-kycregionrestrictedmodal': {
        name: 'KycRegionRestrictedModal',
        path: 'Kyc/modals/KycRegionRestrictedModal.tsx',
    },
    '29-b-kycstatusdrawer': { name: 'KycStatusDrawer (action-needed)', path: 'Kyc/KycStatusDrawer.tsx' },
    '30-b-unlockmethodmodal': { name: 'UnlockMethodModal', path: 'IdentityVerification/UnlockMethodModal.tsx' },
    '31-b-unlockregionmodal': { name: 'UnlockRegionModal', path: 'IdentityVerification/UnlockRegionModal.tsx' },
    '32-c-cancelcardmodal': { name: 'CancelCardModal (confirm phase)', path: 'Card/CancelCardModal.tsx' },
    '33-c-cardlimiteditmodal': { name: 'CardLimitEditModal', path: 'Card/CardLimitEditModal.tsx' },
    '34-c-lockcardmodal': { name: 'LockCardModal (lock)', path: 'Card/LockCardModal.tsx' },
    '35-c-cardunlockdrawer': { name: 'CardUnlockDrawer', path: 'Card/CardUnlockDrawer.tsx' },
    '36-c-badgedetailmodal': { name: 'BadgeDetailModal', path: 'Badges/BadgeDetailModal.tsx' },
    '37-c-badgestatusdrawer': { name: 'BadgeStatusDrawer', path: 'Badges/BadgeStatusDrawer.tsx' },
    '38-c-howtodepositmodal': { name: 'HowToDepositModal', path: 'AddMoney/components/HowToDepositModal.tsx' },
    '39-c-onrampconfirmationmodal': {
        name: 'OnrampConfirmationModal',
        path: 'AddMoney/components/OnrampConfirmationModal.tsx',
    },
    '40-c-supportednetworksmodal': {
        name: 'SupportedNetworksModal',
        path: 'AddMoney/components/SupportedNetworksModal.tsx',
    },
    '41-c-migrationdownloadmodal': {
        name: 'MigrationDownloadModal (early)',
        path: 'Migration/MigrationDownloadModal.tsx',
        blocked: 'Opens itself off the sunset countdown and a stored dismissal — no visible prop.',
    },
    '43-c-scantodownloadmodal': { name: 'ScanToDownloadModal', path: 'Migration/ScanToDownloadModal.tsx' },
    '44-c-otaupdatemodal': { name: 'OtaUpdateModal (normal)', path: 'Profile/components/OtaUpdateModal.tsx' },
    '45-c-residencechangemodal': { name: 'ResidenceChangeModal', path: 'Profile/views/ResidenceChangeModal.tsx' },
    '46-c-perkclaimmodal': { name: 'PerkClaimModal', path: 'Home/PerkClaimModal.tsx' },
    '47-c-welcomeunlockmodal': { name: 'WelcomeUnlockModal', path: 'Home/WelcomeUnlockModal/index.tsx' },
    '48-c-balancewarningmodal': { name: 'BalanceWarningModal', path: 'Global/BalanceWarningModal/index.tsx' },
    '49-c-tokenandnetworkconfirmationmodal': {
        name: 'TokenAndNetworkConfirmationModal',
        path: 'Global/TokenAndNetworkConfirmationModal/index.tsx',
    },
    '50-d-transactiondetailsdrawer': {
        name: 'TransactionDetailsDrawer',
        path: 'TransactionDetails/TransactionDetailsDrawer.tsx',
    },
    '51-d-homeactiondrawers': {
        name: 'HomeActionDrawers',
        path: 'features/home/components/HomeActionDrawers.tsx',
        blocked: 'Driven by the home screen’s own action state — nothing to force from outside.',
    },
    '52-d-contributorsdrawer': {
        name: 'ContributorsDrawer',
        path: 'features/payments/flows/contribute-pot/components/ContributorsDrawer.tsx',
    },
    '53-d-cancelsendlinkdrawer': { name: 'CancelSendLinkDrawer', path: 'Global/CancelSendLinkDrawer/index.tsx' },
    '54-d-qrbottomdrawer': {
        name: 'QRBottomDrawer',
        path: 'Global/QRBottomDrawer/index.tsx',
        blocked:
            'Always-open snap-point drawer: it starts at its peek snap and is positioned against the screen behind it, so on an empty harness page it sits off-frame.',
    },
    '55-d-supportdrawer': {
        name: 'SupportDrawer (chat-failed)',
        path: 'Global/SupportDrawer/index.tsx',
        blocked:
            'Renders its real loading state: the Crisp chat host is an external origin the capture blocks, and the chat-failed state needs that request to time out.',
    },
    '56-d-camerapermissionmodal': { name: 'CameraPermissionModal', path: 'Global/QRScanner/CameraPermissionModal.tsx' },
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
    },
    '60-d-offlinescreen': { name: 'OfflineScreen', path: 'Global/OfflineScreen/index.tsx' },
    '61-d-backenderrorscreen': { name: 'BackendErrorScreen', path: 'Global/BackendErrorScreen/index.tsx' },
    '62-d-unsupportedwebviewscreen': {
        name: 'UnsupportedWebViewScreen',
        path: 'Global/UnsupportedWebViewScreen/index.tsx',
    },
    '63-d-emptystate': { name: 'EmptyState', path: 'Global/EmptyStates/EmptyState.tsx' },
    '64-d-nodataemptystate': { name: 'NoDataEmptyState', path: 'Global/EmptyStates/NoDataEmptyState.tsx' },
    '65-d-faqs': { name: 'FAQs', path: 'Global/FAQs/index.tsx' },
}

export const SURFACE_IDS = Object.keys(SURFACE_META).sort()
