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
    /** Fixture the shot spec must load instead of its default — for surfaces
     *  whose open state depends on an API answer the demo baseline lacks. */
    shotFixture?: string
    /** Accessible name of a button the shot spec clicks after load — for
     *  surfaces that mount closed and open on an in-surface action. The spec
     *  asserts a dialog is open before capturing. */
    shotClick?: string
}

export const SURFACE_META: Record<string, SurfaceMeta> = {
    '01-a-landing': { name: 'Landing', path: 'Setup/Views/Landing.tsx' },
    '02-a-joinwaitlist': { name: 'JoinWaitlist', path: 'Setup/Views/JoinWaitlist.tsx' },
    '03-a-residence-select': { name: 'Residence — select', path: 'Setup/Views/Residence.tsx' },
    '04-a-installpwa': {
        name: 'InstallPWA',
        path: 'Setup/Views/InstallPWA.tsx',
    },
    '05-a-signtesttransaction': {
        name: 'SignTestTransaction — account ready',
        path: 'Setup/Views/SignTestTransaction.tsx',
    },
    '06-a-signup': { name: 'Signup', path: 'Setup/Views/Signup.tsx' },
    '07-a-setuppasskey': { name: 'SetupPasskey', path: 'Setup/Views/SetupPasskey.tsx' },
    '08-a-passkeysetuphelpmodal': { name: 'PasskeySetupHelpDrawer', path: 'Setup/Views/PasskeySetupHelpDrawer.tsx' },
    '09-a-passkeyinfomodal': { name: 'PasskeyInfoDrawer', path: 'Setup/components/PasskeyInfoDrawer.tsx' },
    '10-a-confirminvitemodal': { name: 'ConfirmInviteModal', path: 'Global/ConfirmInviteModal/index.tsx' },
    '11-a-earlyusermodal': {
        name: 'EarlyUserDrawer',
        path: 'Global/EarlyUserDrawer/index.tsx',
        shotFixture: 'early-user',
    },
    '12-a-eastereggmodal': { name: 'EasterEggDrawer', path: 'Global/EasterEggDrawer/index.tsx' },
    '13-a-guestloginmodal': { name: 'GuestLoginModal', path: 'Global/GuestLoginModal/index.tsx' },
    '14-a-guestverificationmodal': { name: 'GuestVerificationModal', path: 'Global/GuestVerificationModal/index.tsx' },
    '15-a-invitefriendsmodal': { name: 'InviteFriendsDrawer', path: 'Global/InviteFriendsDrawer/index.tsx' },
    '16-a-iospwainstallmodal': { name: 'IosPwaInstallDrawer', path: 'Global/IosPwaInstallDrawer/index.tsx' },
    '17-a-nomorejailmodal': { name: 'NoMoreJailDrawer', path: 'Global/NoMoreJailDrawer/index.tsx' },
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
    '32-c-cancelcardmodal': { name: 'CancelCardModal (confirm phase)', path: 'Card/CancelCardModal.tsx' },
    '33-c-cardlimiteditmodal': { name: 'CardLimitEditDrawer', path: 'Card/CardLimitEditDrawer.tsx' },
    '34-c-lockcardmodal': { name: 'LockCardModal (lock)', path: 'Card/LockCardModal.tsx' },
    '35-c-cardunlockdrawer': { name: 'CardUnlockDrawer', path: 'Card/CardUnlockDrawer.tsx' },
    '36-c-badgedetailmodal': { name: 'BadgeDetailDrawer', path: 'Badges/BadgeDetailDrawer.tsx' },
    '37-c-badgestatusdrawer': { name: 'BadgeStatusDrawer', path: 'Badges/BadgeStatusDrawer.tsx' },
    '38-c-howtodepositmodal': { name: 'HowToDepositDrawer', path: 'AddMoney/components/HowToDepositDrawer.tsx' },
    '39-c-onrampconfirmationmodal': {
        name: 'OnrampConfirmationModal',
        path: 'AddMoney/components/OnrampConfirmationModal.tsx',
    },
    '40-c-supportednetworksmodal': {
        name: 'SupportedNetworksDrawer',
        path: 'AddMoney/components/SupportedNetworksDrawer.tsx',
    },
    '41-c-migrationdownloadmodal': {
        name: 'MigrationDownloadModal (early)',
        path: 'Migration/MigrationDownloadModal.tsx',
        blocked: 'Opens itself off the sunset countdown and a stored dismissal — no visible prop.',
    },
    '43-c-scantodownloadmodal': { name: 'ScanToDownloadModal', path: 'Migration/ScanToDownloadModal.tsx' },
    '44-c-otaupdatemodal': { name: 'OtaUpdateModal (normal)', path: 'Profile/components/OtaUpdateModal.tsx' },
    '45-c-residencechangemodal': { name: 'ResidenceChangeDrawer', path: 'Profile/views/ResidenceChangeDrawer.tsx' },
    '46-c-perkclaimmodal': { name: 'PerkClaimDrawer', path: 'Home/PerkClaimDrawer.tsx' },
    '47-c-welcomeunlockmodal': { name: 'WelcomeUnlockDrawer', path: 'Home/WelcomeUnlockDrawer/index.tsx' },
    '48-c-balancewarningmodal': { name: 'BalanceWarningDrawer', path: 'Global/BalanceWarningDrawer/index.tsx' },
    '49-c-tokenandnetworkconfirmationmodal': {
        name: 'TokenAndNetworkConfirmationDrawer',
        path: 'Global/TokenAndNetworkConfirmationDrawer/index.tsx',
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
    },
    '55-d-supportdrawer': {
        name: 'SupportDrawer (chat-failed)',
        path: 'Global/SupportDrawer/index.tsx',
    },
    '56-d-camerapermissionmodal': {
        name: 'CameraPermissionDrawer',
        path: 'Global/QRScanner/CameraPermissionDrawer.tsx',
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
    '66-e-avatarpicker': { name: 'Avatar picker', path: 'Avatar/AvatarPicker.tsx' },
    '67-e-provideemailstep': { name: 'Provide email', path: 'Kyc/ProvideEmailStep.tsx' },
    '68-e-bridgetosstep': { name: 'Bridge terms', path: 'Kyc/BridgeTosStep.tsx' },
    '69-e-kycprepchecklist-standard': { name: 'Verification checklist — standard', path: 'Kyc/KycPrepChecklist.tsx' },
    '70-e-kycprepchecklist-extended': { name: 'Verification checklist — extended', path: 'Kyc/KycPrepChecklist.tsx' },
    '71-e-kycprepchecklist-hosted': { name: 'Verification checklist — hosted', path: 'Kyc/KycPrepChecklist.tsx' },
    '72-e-kycfailedcontent-terminal': { name: 'Verification — terminal failure', path: 'Kyc/KycFailedContent.tsx' },
    '73-e-rejectlabelslist': { name: 'Verification rejection reasons', path: 'Kyc/RejectLabelsList.tsx' },
    '74-e-kycactionrequired': { name: 'Verification — action required', path: 'Kyc/states/KycActionRequired.tsx' },
    '75-e-rateunavailable': { name: 'Exchange rate unavailable', path: 'Global/RateUnavailable/index.tsx' },
    '76-e-limitswarningcard-warning': {
        name: 'Transaction limits — warning',
        path: 'features/limits/components/LimitsWarningCard.tsx',
    },
    '77-e-limitswarningcard-error': {
        name: 'Transaction limits — error',
        path: 'features/limits/components/LimitsWarningCard.tsx',
    },
    '69-d-perkclaimsuccess': { name: 'PerkClaimSuccessDrawer', path: 'Home/PerkClaimSuccessDrawer.tsx' },
    '70-d-activationctas-outbound': {
        name: 'ActivationCTAs (outbound)',
        path: 'Home/ActivationCTAs.tsx',
        shotFixture: 'card-access',
        shotClick: 'Start Spending',
    },
    '66-d-backupfaqlosephone': { name: 'Backup FAQ — lose phone', path: 'Profile/BackupFaqDrawers.tsx' },
    '67-d-backupfaqchangephone': { name: 'Backup FAQ — change phone', path: 'Profile/BackupFaqDrawers.tsx' },
    '68-d-backupfaqexportkeys': { name: 'Backup FAQ — export keys', path: 'Profile/BackupFaqDrawers.tsx' },
}

export const SURFACE_IDS = Object.keys(SURFACE_META).sort()
