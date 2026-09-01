/**
 * Support and debugging tool URLs
 */

/** Arbiscan block explorer for viewing wallet addresses on Arbitrum */
export const ARBISCAN_ADDRESS_BASE_URL = 'https://arbiscan.io/address'

/** PostHog person page for viewing session recordings and events */
export const POSTHOG_PERSON_BASE_URL = 'https://eu.posthog.com/project/138913/person'

/** Bridge dashboard for viewing customer KYC and compliance details */
export const BRIDGE_DASHBOARD_BASE_URL = 'https://dashboard.bridge.xyz/app/customers'

/**
 * Rain card-member KYC portal. Opened as `${base}?userId=<rainUserId>`, it
 * renders Rain's Sumsub WebSDK so a user on a `document_rejected` rail can
 * re-upload identity documents — the self-serve retry route support otherwise
 * has to reach through an engineer + DB lookup (TASK-21687/21964).
 */
export const CARD_MEMBER_PORTAL_BASE_URL = 'https://cardmemberportal.com/kyc'

/** Sentry issue search, scoped to one user — the FE errors they actually hit. */
export const SENTRY_USER_ISSUES_BASE_URL = 'https://us.sentry.io/organizations/peanut-c34d84c05/issues/?query=user.id'
