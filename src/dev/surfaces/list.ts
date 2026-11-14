/**
 * The surface list, as plain data. Kept free of component imports so the
 * Playwright shot spec (e2e/shots/surfaces.spec.ts) can require it under Node —
 * the same rule src/dev/fixtures/registry.ts follows.
 *
 * `blocked` marks a surface that opens itself from live state and has no prop
 * to force; the gallery prints the reason instead of a staged mock.
 */

import { API_CONTRACT_STATES } from './api-contract-states'

export type SurfaceMeta = {
    name: string
    path: string
    /** Human-readable state inputs used by this deterministic capture. */
    captureState?: string[]
    /** A visible element owned by the mounted component, not just the gallery shell. */
    expectSelector?: string
    blocked?: string
    /** Fixture the shot spec must load instead of its default — for surfaces
     *  whose open state depends on an API answer the demo baseline lacks. */
    shotFixture?: string
    /** Accessible name of a button the shot spec clicks after load — for
     *  surfaces that mount closed and open on an in-surface action. The spec
     *  asserts a dialog is open before capturing. */
    shotClick?: string
    /** Stable test id for a translated trigger that opens a dialog. The capture
     *  runner proves that the dialog opened before it records the surface. */
    shotClickTestId?: string
}

const apiRibbon = (id: string): SurfaceMeta => {
    const state = API_CONTRACT_STATES[id]
    return {
        name: state.name,
        path: 'Global/TestBuildRibbon.tsx',
        captureState: [`API status: ${state.api.status}`, `route contract fault: ${state.api.contractError}`],
        expectSelector: '[data-testid="test-build-ribbon"]',
    }
}

// Ids stay literal: the Screen Library capture finds surfaces by searching this file's text.
export const SURFACE_META: Record<string, SurfaceMeta> = {
    'deposit-address-launch-loading': {
        name: 'Bank address check — opening',
        path: 'features/deposit-accounts/components/AddressLaunchModal.tsx',
        captureState: ['visible=true', 'loading=true'],
        expectSelector: '[role="dialog"] [aria-busy="true"]',
    },
    'deposit-address-launch-error': {
        name: 'Bank address check — launch failed, retry available',
        path: 'features/deposit-accounts/components/AddressLaunchModal.tsx',
        captureState: ['visible=true', 'loading=false', 'error=gate.actFailed'],
        expectSelector: '[role="dialog"] [role="alert"]',
    },
    'deposit-address-submitted-toast': {
        name: 'Bank address check — submitted toast',
        path: 'features/deposit-accounts/useDepositGateRemediation.tsx',
        captureState: ['address step submitted'],
        expectSelector: '[role="status"]',
    },
    'card-address-launch-loading': {
        name: 'Card address check — opening',
        path: 'features/card/components/CardResidenceAddressScreen.tsx',
        captureState: ['state=required', 'loading=true'],
        expectSelector: 'button [role="status"]',
    },
    'card-address-launch-error': {
        name: 'Card address check — launch failed, retry available',
        path: 'features/card/components/CardResidenceAddressScreen.tsx',
        captureState: ['state=required', 'loading=false', 'error=errorStartActionFailed'],
        expectSelector: '[role="alert"]',
    },
    'card-address-unavailable': {
        name: 'Card address check — status unavailable, retry available',
        path: 'features/card/components/CardResidenceAddressScreen.tsx',
        captureState: ['state=unavailable'],
        expectSelector: 'h1',
    },
    'standalone-error-card': {
        name: 'Card — load failed',
        path: 'features/card/CardPage.tsx',
        expectSelector: '[data-testid="standalone-error-card"] h1',
    },
    'standalone-error-card-recovery': {
        name: 'Card recovery — unavailable',
        path: 'features/card-recovery/CardRecoveryPage.tsx',
        expectSelector: '[data-testid="standalone-error-card-recovery"] h1',
    },
    'standalone-error-claim': {
        name: 'Claim — payment failed',
        path: 'Claim/Link/Onchain/Success.view.tsx',
        expectSelector: '[data-testid="standalone-error-claim"] h1',
    },
    'standalone-error-send': {
        name: 'Send — bank payment failed',
        path: 'features/withdraw/views/MantecaBankWithdrawFlow.tsx',
        expectSelector: '[data-testid="standalone-error-send"] h1',
    },
    'standalone-error-withdraw': {
        name: 'Withdraw — bank withdrawal failed',
        path: 'features/withdraw/views/MantecaBankWithdrawFlow.tsx',
        expectSelector: '[data-testid="standalone-error-withdraw"] h1',
    },
    'standalone-error-wallet-recovery': {
        name: 'Recover wallet — unavailable',
        path: 'app/recover-wallet/page.tsx',
        expectSelector: '[data-testid="standalone-error-wallet-recovery"] h1',
    },
    'api-ribbon-loading': apiRibbon('api-ribbon-loading'),
    'api-ribbon-compatible': apiRibbon('api-ribbon-compatible'),
    'api-ribbon-too-old': apiRibbon('api-ribbon-too-old'),
    'api-ribbon-missing-version': apiRibbon('api-ribbon-missing-version'),
    'api-ribbon-unavailable': apiRibbon('api-ribbon-unavailable'),
    'api-ribbon-contract-error': apiRibbon('api-ribbon-contract-error'),
    'numeric-request-amount-4000': {
        name: 'Request amount — 4,000 USDC (input only, no navigation)',
        path: 'Global/AmountInput/index.tsx',
        captureState: ['suggestedAmount=4000', 'realSlider=true'],
        expectSelector: 'input[value="4000"]',
    },
    'numeric-request-rate-unavailable': {
        name: 'Request amount — rate unavailable (input only, no navigation)',
        path: 'Global/AmountInput/index.tsx',
        captureState: ['initialAmount=4000', 'secondaryRate=unavailable'],
        expectSelector: 'button[disabled]',
    },
    'numeric-request-amount-invalid': {
        name: 'Request amount — invalid input cleared (input only, no navigation)',
        path: 'Global/AmountInput/index.tsx',
        captureState: ['initialAmount=invalid', 'realSlider=true'],
        expectSelector: 'input[value=""]',
    },
    '01-a-landing': { name: 'Landing', path: 'Setup/Views/Landing.tsx' },
    '03-c-residence-congrats': {
        name: 'Payment plan',
        path: 'Setup/Views/PaymentPlan.tsx',
        shotFixture: 'setup-payment-plan',
    },
    '03-h-funding-methods': {
        name: 'Setup — funding methods',
        path: 'Setup/Views/PaymentPlan.tsx',
        shotClickTestId: 'setup-funding-channel',
        shotFixture: 'setup-payment-plan',
    },
    '03-i-payment-methods': {
        name: 'Setup — payment methods',
        path: 'Setup/Views/PaymentPlan.tsx',
        shotClickTestId: 'setup-payment-channel',
        shotFixture: 'setup-payment-plan',
    },
    '03-a-residence-select': { name: 'Residence — select', path: 'Setup/Views/Residence.tsx' },
    '03-b-residence-compare': {
        name: 'Residence — two countries compared',
        path: 'Setup/components/ResidenceCompare.tsx',
    },
    '05-a-signtesttransaction': {
        name: 'Final passkey confirmation',
        path: 'Setup/Views/SignTestTransaction.tsx',
    },
    '05-b-signtesttransaction-network-busy': {
        name: 'Final passkey confirmation — network busy, confirm later',
        path: 'Setup/Views/SignTestTransaction.tsx',
    },
    '06-a-signup': { name: 'Signup', path: 'Setup/Views/Signup.tsx' },
    '06-b-invite': { name: 'Invited by a friend', path: 'Setup/Views/Invite.tsx' },
    '02-b-advantage-card': { name: 'Setup benefit — card', path: 'Setup/Views/Advantage.tsx' },
    '04-b-advantage-fees': { name: 'Setup benefit — accounts', path: 'Setup/Views/Advantage.tsx' },
    '07-c-notification-email': { name: 'Setup — notification email', path: 'Setup/Views/Email.tsx' },
    '07-d-notification-settings': { name: 'Setup — notification settings', path: 'Setup/Views/Notifications.tsx' },
    '07-e-setup-celebration': { name: 'Setup — full-screen account celebration', path: 'Setup/Views/Success.tsx' },
    '07-b-advantage-control': { name: 'Setup benefit — control', path: 'Setup/Views/Advantage.tsx' },
    '08-a-passkeysetuphelpmodal': { name: 'PasskeySetupHelpDrawer', path: 'Setup/Views/PasskeySetupHelpDrawer.tsx' },
    '08-b-loginrecoverydrawer': {
        name: 'LoginRecoveryDrawer',
        path: 'Setup/Views/LoginRecoveryDrawer.tsx',
        captureState: ['platform=ios', 'signup=offered'],
    },
    '08-c-loginrecoverydrawer-web': {
        name: 'LoginRecoveryDrawer — web, no sign-up',
        path: 'Setup/Views/LoginRecoveryDrawer.tsx',
        captureState: ['platform=web', 'signup=omitted'],
    },
    '08-d-passkeyproviderunsupporteddrawer': {
        name: 'PasskeyProviderUnsupportedDrawer',
        path: 'Setup/Views/PasskeyProviderUnsupportedDrawer.tsx',
        captureState: ['platform=android-app'],
    },
    '08-e-passkeyproviderunsupporteddrawer-browser-failed': {
        name: 'PasskeyProviderUnsupportedDrawer — browser did not open',
        path: 'Setup/Views/PasskeyProviderUnsupportedDrawer.tsx',
        captureState: ['platform=android-app', 'browser=open-failed'],
    },
    '08-f-passkeyproviderunsupporteddrawer-other': {
        name: 'PasskeyProviderUnsupportedDrawer — iOS and web',
        path: 'Setup/Views/PasskeyProviderUnsupportedDrawer.tsx',
        captureState: ['platform=other'],
    },
    '09-a-passkeyinfomodal': { name: 'PasskeyInfoDrawer', path: 'Setup/components/PasskeyInfoDrawer.tsx' },
    '10-a-confirminvitemodal': {
        name: 'Confirm invite — Bank transfer',
        path: 'Global/ConfirmInviteModal/index.tsx',
        captureState: ['selectedMethod=Bank transfer'],
    },
    '11-a-earlyusermodal': {
        name: 'EarlyUserDrawer',
        path: 'Global/EarlyUserDrawer/index.tsx',
        shotFixture: 'early-user',
    },
    '12-a-eastereggmodal': { name: 'EasterEggDrawer', path: 'Global/EasterEggDrawer/index.tsx' },
    '13-a-guestloginmodal': { name: 'GuestLoginModal', path: 'Global/GuestLoginModal/index.tsx' },
    '14-a-guestverificationmodal': { name: 'GuestVerificationModal', path: 'Global/GuestVerificationModal/index.tsx' },
    '15-a-invitefriendsmodal': { name: 'InviteFriendsModal', path: 'Global/InviteFriendsModal/index.tsx' },
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
    '22-b-initiatekycmodal': { name: 'InitiateKycModal (default)', path: 'Kyc/InitiateKycModal.tsx' },
    '23-b-kycreverificationpendingmodal': {
        name: 'KycReverificationPendingModal',
        path: 'Kyc/KycReverificationPendingModal.tsx',
    },
    '24-b-kycverificationinprogressmodal': {
        name: 'KycVerificationInProgressModal (verifying)',
        path: 'Kyc/KycVerificationInProgressModal.tsx',
    },
    '24-c-kyctaxidsubmitted': {
        name: 'KycVerificationInProgressModal (tax ID submitted)',
        path: 'Kyc/KycVerificationInProgressModal.tsx',
    },
    '24-c-kyc-ready-ars-action': {
        name: 'KYC complete — ARS needs one more step',
        path: 'Kyc/KycVerificationInProgressModal.tsx',
    },
    '24-d-kyc-ready-bank-review': {
        name: 'KYC complete — EUR under review',
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
    '32-c-cancelcardmodal': { name: 'CancelCardModal (confirm phase)', path: 'Card/CancelCardModal.tsx' },
    '33-c-cardlimiteditmodal': { name: 'CardLimitEditDrawer', path: 'Card/CardLimitEditDrawer.tsx' },
    '34-c-lockcardmodal': { name: 'LockCardModal (lock)', path: 'Card/LockCardModal.tsx' },
    '35-c-googlewalletbutton': {
        name: 'Add to Google Wallet button (native Android only)',
        path: 'Card/GoogleWalletButton.tsx',
        expectSelector: 'button[aria-busy="false"]',
    },
    '35-c-googlewalletbutton-adding': {
        name: 'Add to Google Wallet button — adding (held pressed)',
        path: 'Card/GoogleWalletButton.tsx',
        captureState: ['isAdding=true'],
        expectSelector: 'button[aria-busy="true"]',
    },
    '35-c-applewalletrow': {
        name: 'Add to Apple Wallet row (native iOS only)',
        path: 'Card/AppleWalletRow.tsx',
        expectSelector: '[role="button"]:not([aria-disabled])',
    },
    '35-c-applewalletrow-adding': {
        name: 'Add to Apple Wallet row — adding (disabled)',
        path: 'Card/AppleWalletRow.tsx',
        captureState: ['isAdding=true'],
        expectSelector: '[role="button"][aria-disabled="true"]',
    },
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
        blocked:
            'Opens itself for a signed-in web user unless snoozed — no visible prop. Captured through the download-prompt fixture.',
    },
    '43-c-scantodownloadmodal': { name: 'ScanToDownloadModal', path: 'Migration/ScanToDownloadModal.tsx' },
    '44-c-otaupdatemodal': { name: 'OtaUpdateModal (normal)', path: 'Profile/components/OtaUpdateModal.tsx' },
    '45-c-residencechangemodal': { name: 'ResidenceChangeDrawer', path: 'Profile/views/ResidenceChangeDrawer.tsx' },
    '48-c-balancewarningmodal': { name: 'BalanceWarningDrawer', path: 'Global/BalanceWarningDrawer/index.tsx' },
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
        shotClick: 'See all contributors',
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
    '71-e-kycprepchecklist-hosted': { name: 'Verification checklist — hosted', path: 'Kyc/KycPrepChecklist.tsx' },
    '72-e-kycfailedcontent-terminal': {
        name: 'Verification — terminal failure',
        path: 'Kyc/modals/KycFailedModal.tsx',
    },
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
    '78-f-choice-guest-claim': {
        name: 'Guest claim — payment choices',
        path: 'Claim/Link/SendLinkActionList.tsx',
    },
    '79-f-choice-direct-send': {
        name: 'Direct send — payment choices',
        path: 'features/payments/shared/components/PaymentMethodActionList.tsx',
    },
    '80-f-choice-semantic-request': {
        name: 'Semantic request — payment choices',
        path: 'features/payments/shared/components/PaymentMethodActionList.tsx',
    },
    '81-f-choice-request-pot': {
        name: 'Request pot — payment choices',
        path: 'features/payments/flows/contribute-pot/components/RequestPotActionList.tsx',
    },
    '81-g-request-pot-partial': {
        name: 'Request pot — deposit card after a short external-wallet deposit',
        path: 'components/AddMoney/views/RhinoDeposit.view.tsx',
        captureState: ['received=33', 'asked=58.51'],
    },
    '82-f-choice-card-requires-info': {
        name: 'Card application — more information required',
        path: 'Card/ApplicationStatusScreen.tsx',
    },
    '82-f-choice-card-needs-review': {
        name: 'Card application — card partner needs review',
        path: 'Card/ApplicationStatusScreen.tsx',
        captureState: ['variant=requires-info', 'reasonCode=card_needs_review'],
        expectSelector: '[data-testid="app-page-surface-content"] h1',
    },
    '82-g-card-tax-id': {
        name: 'Card application — tax ID requested',
        path: 'Card/ApplicationStatusScreen.tsx',
        captureState: ['variant=requires-info', 'actions=tax_identification_number'],
        expectSelector: '[data-testid="app-page-surface-content"] button',
    },
    '82-h-card-birth-date': {
        name: 'Card application — date of birth requested',
        path: 'Card/ApplicationStatusScreen.tsx',
        captureState: ['variant=requires-info', 'actions=birth_details'],
        expectSelector: '[data-testid="app-page-surface-content"] button',
    },
    '82-i-card-information-both': {
        name: 'Card application — tax ID first, date of birth next',
        path: 'Card/ApplicationStatusScreen.tsx',
        captureState: ['variant=requires-info', 'actions=tax_identification_number,birth_details'],
        expectSelector: '[data-testid="app-page-surface-content"] button',
    },
    '82-j-card-information-error': {
        name: 'Card application — information action failed to start',
        path: 'Card/ApplicationStatusScreen.tsx',
        captureState: ['variant=requires-info', 'actions=tax_identification_number', 'uploadError=retryable'],
        expectSelector: '[data-testid="app-page-surface-content"] [role="alert"]',
    },
    '92-f-withdraw-amount-error': {
        name: 'Bank withdrawal — amount below minimum',
        path: 'features/withdraw/views/WithdrawAmountView.tsx',
        captureState: ['amount=0.01', 'error=minimum', 'continueDisabled=true'],
        expectSelector: '[data-testid="app-page-surface-content"] [role="alert"]',
    },
    '83-f-choice-residence-restricted': {
        name: 'Setup payment plan — restricted residence',
        path: 'Setup/Views/PaymentPlan.tsx',
    },
    '84-f-choice-public-profile-guest': {
        name: 'Public profile — guest actions',
        path: 'Profile/components/PublicProfile.tsx',
    },
    '85-f-choice-claim-error': {
        name: 'Claim error — recovery actions',
        path: 'Claim/Generic/ClaimError.view.tsx',
    },
    '86-f-choice-not-found': { name: 'Not found — recovery actions', path: 'app/not-found.tsx' },
    '87-f-request-created': {
        name: 'Request link — created',
        path: 'Request/link/views/RequestCreatedView.tsx',
    },
    '88-f-request-bank-currency': {
        name: 'Request link — bank currency chooser',
        path: 'features/payments/flows/contribute-pot/components/BankTransferChooserDrawer.tsx',
        shotClickTestId: 'bank-transfer-chooser',
    },
    '89-f-withdraw-review-insufficient': {
        name: 'Withdrawal review — insufficient balance before confirmation',
        path: 'features/withdraw/views/ConfirmWithdrawView.tsx',
        captureState: ['insufficientBalance=true', 'processing=false', 'alreadySpent=false'],
        expectSelector: '[data-testid="app-page-surface-content"] button',
    },
    '90-f-withdraw-review-processing': {
        name: 'Withdrawal review — processing after balance refresh',
        path: 'features/withdraw/views/ConfirmWithdrawView.tsx',
        captureState: ['insufficientBalance=true', 'processing=true', 'alreadySpent=false'],
        expectSelector: '[data-testid="app-page-surface-content"] button',
    },
    '91-f-withdraw-review-spent': {
        name: 'Withdrawal review — already spent after balance refresh',
        path: 'features/withdraw/views/ConfirmWithdrawView.tsx',
        captureState: ['insufficientBalance=true', 'processing=false', 'alreadySpent=true'],
        expectSelector: '[data-testid="app-page-surface-content"] button',
    },
    '92-f-deposit-account-closed': {
        name: 'Manteca deposit — account closed',
        path: 'Common/MantecaAccountUnavailable.tsx',
        captureState: ['code=MANTECA_ACCOUNT_REJECTED', 'action=deposit', 'country=BR', 'kyc=false'],
        expectSelector: '[data-testid="app-page-surface-content"] [role="alert"]',
    },
    '93-f-withdraw-account-closed': {
        name: 'Manteca withdrawal — account closed',
        path: 'Common/MantecaAccountUnavailable.tsx',
        captureState: ['code=MANTECA_ACCOUNT_REJECTED', 'action=withdraw', 'country=AR', 'kyc=false'],
        expectSelector: '[data-testid="app-page-surface-content"] [role="alert"]',
    },
    '94-f-pix-deposit': {
        name: 'Pix deposit — the dynamic code',
        path: 'features/pix/components/PixQrDeposit.tsx',
        captureState: ['amountBrl=100', 'expiresAt=+10 min'],
        // a signed-in user whose Pix deposit route is ready
        shotFixture: 'pix-deposit-amount',
        expectSelector: '[data-testid="app-page-surface-content"] canvas, [data-testid="app-page-surface-content"] svg',
    },
    '94-g-pix-withdraw-on-its-way': {
        name: 'Pix withdrawal — funded, the provider pays: the shared payment loader',
        path: 'features/pix/components/PixWithdrawOutcome.tsx',
        captureState: ['phase=funded', 'entry=PENDING', 'quoted arrival=60 s'],
        shotFixture: 'pix-withdraw-unconfirmed',
        expectSelector: '[data-testid="app-page-surface-content"] [role="status"]',
    },
    '94-h-pix-withdraw-arrived-to': {
        name: 'Pix withdrawal — arrived: the shared success view, key and bank named',
        path: 'features/pix/components/PixWithdrawOutcome.tsx',
        captureState: ['phase=funded', 'entry=COMPLETED', 'key=09579927189', 'bank=Banco Inter'],
        shotFixture: 'pix-withdraw-arrived',
        expectSelector: '[data-testid="app-page-surface-content"] button',
    },
    '94-i-pix-withdraw-arrived-unnamed': {
        name: 'Pix withdrawal — arrived, no bank named: the key alone',
        path: 'features/pix/components/PixWithdrawOutcome.tsx',
        captureState: ['phase=funded', 'entry=COMPLETED', 'key=09579927189', 'bank=none'],
        shotFixture: 'pix-withdraw-arrived',
        expectSelector: '[data-testid="app-page-surface-content"] button',
    },
    '94-j-pix-review-quote-moved': {
        name: 'Pix withdrawal form — the opened quote moved, confirm again',
        path: 'features/pix/components/PixWithdrawForm.tsx',
        captureState: ['phase=reconfirm'],
        expectSelector: '[data-testid="app-page-surface-content"] [role="alert"]',
    },
    '94-k-pix-review-after-init': {
        name: 'Pix withdrawal form — the opened quote expired before the signature',
        path: 'features/pix/components/PixWithdrawForm.tsx',
        captureState: ['phase=idle', 'lockedAfterInit=true', 'error=quoteExpired'],
        expectSelector: '[data-testid="app-page-surface-content"] [role="alert"]',
    },
    '94-l-pix-withdraw-stuck': {
        name: 'Pix withdrawal — funded, but the withdrawal ended with no recovery',
        path: 'features/pix/components/PixWithdrawOutcome.tsx',
        captureState: ['phase=funded', 'entry=CANCELLED', 'outcome=stuck'],
        shotFixture: 'pix-withdraw-not-sent',
        expectSelector: '[data-testid="app-page-surface-content"] button',
    },
    '94-m-pix-withdraw-past-arrival': {
        name: 'Pix withdrawal — still open past the quoted arrival time: on its way, with Done',
        path: 'features/pix/components/PixWithdrawOutcome.tsx',
        captureState: ['phase=funded', 'entry=PENDING', 'quoted arrival=0 s', 'destination=Banco Inter · Ana Souza'],
        shotFixture: 'pix-withdraw-unconfirmed',
        expectSelector: '[data-testid="app-page-surface-content"] button',
    },
    '94-n-pix-withdraw-past-arrival-unnamed': {
        name: 'Pix withdrawal — still open past the quoted arrival time, no holder named',
        path: 'features/pix/components/PixWithdrawOutcome.tsx',
        captureState: ['phase=funded', 'entry=PENDING', 'quoted arrival=0 s', 'destination=none'],
        shotFixture: 'pix-withdraw-unconfirmed',
        expectSelector: '[data-testid="app-page-surface-content"] button',
    },
    // TASK-24910 ruling D7: a Bridge payout takes minutes, so the ending never holds the user on the loader
    '94-o-pix-bridge-send-on-its-way': {
        name: 'Pix send through Bridge — just signed: on its way at once, when it lands, Done',
        path: 'features/pix/components/PixWithdrawOutcome.tsx',
        captureState: ['phase=funded', 'entry=FUNDS_RECEIVED', 'quoted arrival=300 s', 'payee=other'],
        shotFixture: 'pix-bridge-send-on-its-way',
        expectSelector: '[data-testid="app-page-surface-content"] button',
    },
    '94-p-pix-bridge-send-paid': {
        name: "Pix send through Bridge — paid: Sent, to the person, Bridge's final reais",
        path: 'features/pix/components/PixWithdrawOutcome.tsx',
        captureState: ['phase=funded', 'entry=PAYMENT_PROCESSED', 'payee=other'],
        shotFixture: 'pix-bridge-send-paid',
        expectSelector: '[data-testid="app-page-surface-content"] button',
    },
    '94-q-pix-bridge-withdraw-on-its-way': {
        name: 'Pix withdrawal through Bridge — just signed, own key: on its way at once, when it lands, Done',
        path: 'features/pix/components/PixWithdrawOutcome.tsx',
        captureState: ['phase=funded', 'entry=FUNDS_RECEIVED', 'quoted arrival=300 s', 'payee=own'],
        shotFixture: 'pix-bridge-send-on-its-way',
        expectSelector: '[data-testid="app-page-surface-content"] button',
    },
    '70-d-activationctas-outbound': {
        name: 'First-payment chooser',
        path: 'Home/FirstPaymentChooser.tsx',
        shotFixture: 'card-access',
        shotClickTestId: 'checklist-first-payment',
    },
    '66-d-backupfaqlosephone': { name: 'Backup FAQ — lose phone', path: 'Profile/BackupFaqDrawers.tsx' },
    '67-d-backupfaqchangephone': { name: 'Backup FAQ — change phone', path: 'Profile/BackupFaqDrawers.tsx' },
    '68-d-backupfaqexportkeys': { name: 'Backup FAQ — export keys', path: 'Profile/BackupFaqDrawers.tsx' },
}

export const SURFACE_IDS = Object.keys(SURFACE_META).sort()
