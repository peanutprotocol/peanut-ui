/**
 * Central registry of all PostHog analytics event names.
 * Provides autocomplete, compile-time safety, and a single place to audit the full taxonomy.
 */
export const ANALYTICS_EVENTS = {
    // ── Signup funnel ──
    SIGNUP_CLICKED: 'signup_signup_clicked',
    SIGNUP_LOGIN_ERROR: 'signup_login_error',
    SIGNUP_CREATE_WALLET_CLICKED: 'signup_create_wallet_clicked',
    SIGNUP_USERNAME_VALIDATED: 'signup_username_validated',
    SIGNUP_PASSKEY_STARTED: 'signup_passkey_started',
    SIGNUP_PASSKEY_SUCCEEDED: 'signup_passkey_succeeded',
    SIGNUP_PASSKEY_FAILED: 'signup_passkey_failed',
    SIGNUP_TEST_TX_STARTED: 'signup_test_tx_started',
    SIGNUP_TEST_TX_SIGNED: 'signup_test_tx_signed',
    SIGNUP_TEST_TX_FAILED: 'signup_test_tx_failed',
    SIGNUP_COMPLETED: 'signup_completed',

    // ── PWA install ──
    PWA_INSTALL_CLICKED: 'pwa_install_clicked',
    PWA_INSTALL_DISMISSED: 'pwa_install_dismissed',
    PWA_INSTALL_COMPLETED: 'pwa_install_completed',

    // ── KYC (Bridge) ──
    KYC_INITIATED: 'kyc_initiated',
    KYC_TOS_ACCEPTED: 'kyc_tos_accepted',
    KYC_SUBMITTED: 'kyc_submitted',
    KYC_APPROVED: 'kyc_approved',
    KYC_REJECTED: 'kyc_rejected',
    KYC_ABANDONED: 'kyc_abandoned',

    // ── KYC (Manteca) ──
    MANTECA_KYC_INITIATED: 'manteca_kyc_initiated',
    MANTECA_KYC_COMPLETED: 'manteca_kyc_completed',
    MANTECA_KYC_ABANDONED: 'manteca_kyc_abandoned',

    // ── Send ──
    SEND_METHOD_SELECTED: 'send_method_selected',

    // ── Send Link ──
    SEND_LINK_CREATED: 'send_link_created',
    SEND_LINK_FAILED: 'send_link_failed',
    SEND_LINK_SHARED: 'send_link_shared',

    // ── Claim Link ──
    CLAIM_LINK_VIEWED: 'claim_link_viewed',
    CLAIM_LINK_STARTED: 'claim_link_started',
    CLAIM_LINK_COMPLETED: 'claim_link_completed',
    CLAIM_LINK_FAILED: 'claim_link_failed',
    CLAIM_RECIPIENT_SELECTED: 'claim_recipient_selected',

    // ── Deposit / Onramp ──
    DEPOSIT_METHOD_SELECTED: 'deposit_method_selected',
    DEPOSIT_AMOUNT_ENTERED: 'deposit_amount_entered',
    DEPOSIT_CONFIRMED: 'deposit_confirmed',
    DEPOSIT_COMPLETED: 'deposit_completed',
    DEPOSIT_FAILED: 'deposit_failed',

    // ── Withdraw ──
    WITHDRAW_AMOUNT_ENTERED: 'withdraw_amount_entered',
    WITHDRAW_METHOD_SELECTED: 'withdraw_method_selected',
    WITHDRAW_CONFIRMED: 'withdraw_confirmed',
    WITHDRAW_COMPLETED: 'withdraw_completed',
    WITHDRAW_FAILED: 'withdraw_failed',

    // ── Invites / Referrals ──
    INVITE_LINK_SHARED: 'invite_link_shared',
    INVITE_LINK_COPIED: 'invite_link_copied',
    INVITE_PAGE_VIEWED: 'invite_page_viewed',
    INVITE_CLAIM_CLICKED: 'invite_claim_clicked',
    INVITE_ACCEPTED: 'invite_accepted',
    INVITE_ACCEPT_FAILED: 'invite_accept_failed',

    // ── Points / Rewards ──
    POINTS_PAGE_VIEWED: 'points_page_viewed',
    POINTS_EARNED: 'points_earned',

    // ── Activation Funnel ──
    ACTIVATION_STEP_VIEWED: 'activation_step_viewed',

    // ── Surprise Moment (funnel handoff) ──
    SURPRISE_MOMENT_SHOWN: 'surprise_moment_shown',

    // ── Reward Claim Lifecycle ──
    REWARD_CLAIM_SHOWN: 'reward_claim_shown',
    REWARD_CLAIMED: 'reward_claimed',
    REWARD_CLAIM_DISMISSED: 'reward_claim_dismissed',

    // ── Referral Funnel ──
    REFERRAL_CTA_SHOWN: 'referral_cta_shown',
    REFERRAL_CTA_CLICKED: 'referral_cta_clicked',

    // ── Notifications ──
    NOTIFICATION_PERMISSION_REQUESTED: 'notification_permission_requested',
    NOTIFICATION_PERMISSION_GRANTED: 'notification_permission_granted',
    NOTIFICATION_PERMISSION_DENIED: 'notification_permission_denied',
    NOTIFICATION_SUBSCRIBED: 'notification_subscribed',

    // ── Modal Fatigue ──
    MODAL_SHOWN: 'modal_shown',
    MODAL_DISMISSED: 'modal_dismissed',
    MODAL_CTA_CLICKED: 'modal_cta_clicked',

    // ── QR ──
    QR_SCANNED: 'qr_scanned',

    // ── Home ──
    BALANCE_VISIBILITY_TOGGLED: 'balance_visibility_toggled',

    // ── Error / Churn ──
    BACKEND_ERROR_SHOWN: 'backend_error_shown',
    BACKEND_ERROR_RETRY: 'backend_error_retry',
    BACKEND_ERROR_LOGOUT: 'backend_error_logout',
} as const

/**
 * Valid modal_type values for MODAL_SHOWN / MODAL_DISMISSED / MODAL_CTA_CLICKED events.
 */
export const MODAL_TYPES = {
    NOTIFICATIONS: 'notifications',
    EARLY_USER: 'early_user',
    POST_SIGNUP: 'post_signup',
    BALANCE_WARNING: 'balance_warning',
    CARD_PIONEER: 'card_pioneer',
    KYC_COMPLETED: 'kyc_completed',
    INVITE: 'invite',
} as const

/**
 * Valid source values for REFERRAL_CTA_SHOWN / REFERRAL_CTA_CLICKED events.
 */
export const REFERRAL_SOURCES = {
    FLOATING_BUTTON: 'floating_button',
    CAMPAIGN_MODAL: 'campaign_modal',
    INVITE_MODAL: 'invite_modal',
    SURPRISE_MOMENT: 'surprise_moment',
} as const

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS]
