'use server'

import { PEANUT_API_URL } from '@/constants/general.consts'
import { fetchWithSentry } from '@/utils/sentry.utils'
import { getJWTCookie } from '@/utils/cookie-migration.utils'

const API_KEY = process.env.PEANUT_API_KEY
if (!API_KEY) {
    throw new Error('PEANUT_API_KEY environment variable is not set')
}

export interface RainCardApplicationStatus {
    hasApplication: boolean
    railStatus?: string
    applicationStatus?: string
    rainUserId?: string
    /** Collateral proxy address. */
    contractAddress?: string
    /** Rain Coordinator contract — target of `withdrawAsset`. */
    coordinatorAddress?: string
}

export interface RainCardBalance {
    creditLimit: number
    spendingPower: number
    pendingCharges: number
    postedCharges: number
    balanceDue: number
}

export interface RainCardSummary {
    id: string
    rainCardId: string
    last4: string
    expiryMonth: number
    expiryYear: number
    status: string
    network: string
    issuedAt: string
    /** Whether the user has granted the one-time session-key permission
     *  used to submit collateral withdrawals with a single passkey tap. */
    hasWithdrawApproval: boolean
}

export interface RainCardOverview {
    status: RainCardApplicationStatus
    balance: RainCardBalance | null
    cards: RainCardSummary[]
}

/**
 * Fetch the composite Rain card state (application status, collateral balance,
 * issued cards) for the authenticated user in one request.
 */
export const getRainCardOverview = async (): Promise<{ data?: RainCardOverview; error?: string }> => {
    const jwtToken = (await getJWTCookie())?.value
    if (!jwtToken) {
        return { error: 'Authentication required' }
    }

    try {
        const response = await fetchWithSentry(`${PEANUT_API_URL}/rain/cards`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${jwtToken}`,
                'api-key': API_KEY,
            },
        })

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            return { error: errorData.message || errorData.error || 'Failed to load card overview' }
        }

        const data = (await response.json()) as RainCardOverview
        return { data }
    } catch (e: any) {
        return { error: e.message || 'An unexpected error occurred' }
    }
}

/**
 * Mirrors the backend `TransactionIntentKind` enum. Used for history
 * categorization — e.g. a `type: collateral` webhook initiated by a P2P
 * send shows as "P2P_SEND", not "card payment".
 */
export type TransactionIntentKind =
    | 'P2P_SEND'
    | 'QR_PAY'
    | 'LINK_CREATE'
    | 'CRYPTO_WITHDRAW'
    | 'FIAT_OFFRAMP'
    | 'FIAT_ONRAMP'
    | 'REQUEST_PAY'
    | 'AUTO_REBALANCE'
    | 'CARD_SPEND'
    | 'DEPOSIT_EXTERNAL'
    | 'OTHER'

export interface PrepareRainWithdrawalInput {
    amount: string // native units as decimal string (USDC cents: e.g. "500000" for $5.00 at 6dp)
    recipientAddress: string
    directTransfer: boolean
    /** User-semantic kind — drives history categorization for the collateral webhook. */
    kind: TransactionIntentKind
    /** Total user-initiated spend in cents. For mixed strategy this differs from
     *  `amount` (which is only the collateral shortfall). History shows this. */
    totalAmountCents?: string
}

export interface PrepareRainWithdrawalResponse {
    /** Short-lived intent id. Must be echoed back to `/submit`. */
    preparationId: string
    coordinatorAddress: string
    collateralProxy: string
    adminAddress: string
    chainId: string
    tokenAddress: string
    amount: string
    recipientAddress: string
    directTransfer: boolean
    adminSalt: string
    adminNonce: string
    executorSignature: string
    executorSalt: string
    expiresAt: number
}

/**
 * Ask the backend to assemble a Rain V2 withdrawal: fetches Rain's executor
 * signature, reads the current adminNonce from the collateral proxy, and
 * persists a short-lived prep record. The caller then signs the admin EIP-712
 * payload using the kernel and sends the signature to `submitRainWithdrawal`.
 */
export const prepareRainWithdrawal = async (
    input: PrepareRainWithdrawalInput
): Promise<{ data?: PrepareRainWithdrawalResponse; error?: string }> => {
    const jwtToken = (await getJWTCookie())?.value
    if (!jwtToken) return { error: 'Authentication required' }

    try {
        const response = await fetchWithSentry(`${PEANUT_API_URL}/rain/cards/withdraw/prepare`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${jwtToken}`,
                'api-key': API_KEY,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(input),
        })

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            return { error: errorData.message || errorData.error || 'Failed to prepare withdrawal' }
        }

        const data = (await response.json()) as PrepareRainWithdrawalResponse
        return { data }
    } catch (e: any) {
        return { error: e.message || 'An unexpected error occurred' }
    }
}

/**
 * Shared session-key address the frontend needs to construct the permission
 * approval. Backend holds the private key; frontend only needs to know which
 * address to scope the permission to.
 */
export const getRainSessionKeyAddress = async (): Promise<{ data?: { address: string }; error?: string }> => {
    const jwtToken = (await getJWTCookie())?.value
    if (!jwtToken) return { error: 'Authentication required' }

    try {
        const response = await fetchWithSentry(`${PEANUT_API_URL}/rain/cards/session-key-address`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${jwtToken}`, 'api-key': API_KEY },
        })
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            return { error: errorData.message || errorData.error || 'Failed to get session key address' }
        }
        const data = (await response.json()) as { address: string }
        return { data }
    } catch (e: any) {
        return { error: e.message || 'An unexpected error occurred' }
    }
}

/**
 * Persist the serialized ZeroDev permission on the user's card so the
 * backend can use it to send session-key UserOps for collateral withdrawals.
 */
export const submitRainWithdrawSessionApproval = async (input: {
    serializedApproval: string
}): Promise<{ data?: { ok: boolean }; error?: string }> => {
    const jwtToken = (await getJWTCookie())?.value
    if (!jwtToken) return { error: 'Authentication required' }

    try {
        const response = await fetchWithSentry(`${PEANUT_API_URL}/rain/cards/withdraw/session-approve`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${jwtToken}`,
                'api-key': API_KEY,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(input),
        })
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            return { error: errorData.message || errorData.error || 'Failed to store approval' }
        }
        const data = (await response.json()) as { ok: boolean }
        return { data }
    } catch (e: any) {
        return { error: e.message || 'An unexpected error occurred' }
    }
}

export interface SubmitRainWithdrawalInput {
    preparationId: string
    amount: string
    recipientAddress: string
    directTransfer: boolean
    adminSalt: string
    adminNonce: string
    adminSignature: string
    executorSignature: string
    executorSalt: string
    expiresAt: number
}

export interface SubmitRainWithdrawalResponse {
    txHash: string
}

/**
 * Mixed-strategy completion: frontend submitted the UserOp itself (so the
 * kernel can bundle withdrawAsset + transfer + subsequent calls atomically).
 * This endpoint tells the backend which tx hash the intent settled on, so
 * the Rain collateral webhook reconciles against the right intent.
 */
export const stampRainWithdrawal = async (input: {
    preparationId: string
    txHash: string
}): Promise<{ data?: { ok: boolean }; error?: string }> => {
    const jwtToken = (await getJWTCookie())?.value
    if (!jwtToken) return { error: 'Authentication required' }
    try {
        const response = await fetchWithSentry(`${PEANUT_API_URL}/rain/cards/withdraw/stamp`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${jwtToken}`,
                'api-key': API_KEY,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(input),
        })
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            return { error: errorData.message || errorData.error || 'Failed to stamp withdrawal' }
        }
        const data = (await response.json()) as { ok: boolean }
        return { data }
    } catch (e: any) {
        return { error: e.message || 'An unexpected error occurred' }
    }
}

/**
 * Submit a prepared Rain withdrawal. Backend verifies the admin signature
 * via ERC-1271 against the user's kernel and broadcasts the coordinator
 * call through the shared admin relayer.
 */
export const submitRainWithdrawal = async (
    input: SubmitRainWithdrawalInput
): Promise<{ data?: SubmitRainWithdrawalResponse; error?: string }> => {
    const jwtToken = (await getJWTCookie())?.value
    if (!jwtToken) return { error: 'Authentication required' }

    try {
        const response = await fetchWithSentry(`${PEANUT_API_URL}/rain/cards/withdraw/submit`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${jwtToken}`,
                'api-key': API_KEY,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(input),
        })

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            return { error: errorData.message || errorData.error || 'Failed to submit withdrawal' }
        }

        const data = (await response.json()) as SubmitRainWithdrawalResponse
        return { data }
    } catch (e: any) {
        return { error: e.message || 'An unexpected error occurred' }
    }
}
