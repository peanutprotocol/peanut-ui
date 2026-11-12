'use client'

/**
 * Provider-neutral Pix calls (peanut-api-ts /pix/*). The API sends each call to the provider the
 * user's route names (capabilities.routes), and its answers name no provider the app branches on.
 * Every failed call throws an ApiError, so screens branch on its wire `code`, never on the message.
 */

import { apiErrorFromResponse } from '@/services/api-error'
import { apiFetch } from '@/utils/api-fetch'
import { jsonStringify } from '@/utils/cookie-url.utils'
import type { paths } from '@/types/api.generated'

type ApiFetchInit = NonNullable<Parameters<typeof apiFetch>[1]>
type Json<T> = T extends { content: { 'application/json': infer Body } } ? Body : never
type QuoteOperation = paths['/pix/quote']['get']

export type PixQuoteRequest = QuoteOperation['parameters']['query']
export type PixQuote = Json<QuoteOperation['responses'][200]>
/** One deposit, as POST /pix/deposit opens it and GET /pix/deposit/:intentId reads it. */
export type PixDeposit = Json<paths['/pix/deposit/{intentId}']['get']['responses'][200]>
export type PixKeyInfo = Json<paths['/pix/key']['post']['responses'][200]>
export type PixWithdrawDisplay = Json<paths['/pix/withdraw/preview']['post']['responses'][200]>
export type PixWithdrawOpened = Json<paths['/pix/withdraw']['post']['responses'][200]>
/** How the wallet funds the withdrawal; `kind` says which calls it signs. */
export type PixWithdrawSign = PixWithdrawOpened['sign']
export type PixWithdrawSubmitRequest = Json<paths['/pix/withdraw/submit']['post']['requestBody']>
export type PixWithdrawSubmitted = Json<paths['/pix/withdraw/submit']['post']['responses'][200]>

/** One amount: reais to credit, USDC to convert, or USDC to leave the wallet with every fee (`spendUsd`, "Use balance"). */
export type PixWithdrawRequest = { pixKey: string } & (
    | { amountBrl: string }
    | { amountUsd: string }
    | { spendUsd: string }
)

async function call<T>(path: string, init: ApiFetchInit, fallbackMessage: string): Promise<T> {
    const response = await apiFetch(path, init)
    if (!response.ok) throw await apiErrorFromResponse(response, fallbackMessage)
    return (await response.json()) as T
}

const post = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) })
const GET: RequestInit = { method: 'GET' }

export const pixApi = {
    /** An indicative quote for amount entry: no ticket, no key lookup; the deposit and the review quote again. */
    quote: (request: PixQuoteRequest) => {
        const query = new URLSearchParams(
            Object.entries(request).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
        )
        return call<PixQuote>(`/pix/quote?${query.toString()}`, GET, 'Could not quote the amount')
    },

    createDeposit: (amountBrl: string) =>
        call<PixDeposit>('/pix/deposit', post({ amountBrl }), 'Could not create the Pix code'),

    readDeposit: (intentId: string) =>
        call<PixDeposit>(`/pix/deposit/${encodeURIComponent(intentId)}`, GET, 'Could not read the deposit'),

    lookupKey: (pixKey: string) => call<PixKeyInfo>('/pix/key', post({ pixKey }), 'Could not look up the Pix key'),

    previewWithdrawal: (request: PixWithdrawRequest) =>
        call<PixWithdrawDisplay>('/pix/withdraw/preview', post(request), 'Could not quote the withdrawal'),

    openWithdrawal: (request: PixWithdrawRequest) =>
        call<PixWithdrawOpened>('/pix/withdraw', post(request), 'Could not start the withdrawal'),

    /**
     * `transfer-then-submit`: the API opens the payout order for the locked price, then broadcasts the
     * signed transfer. The signed UserOp carries bigints, and the broadcast can take a while.
     */
    submitWithdrawal: (request: PixWithdrawSubmitRequest) =>
        call<PixWithdrawSubmitted>(
            '/pix/withdraw/submit',
            { method: 'POST', body: jsonStringify(request), timeoutMs: 120_000 },
            'Could not send the withdrawal'
        ),

    /** `deposit-with-id`: the mined transaction that funds the withdrawal. Optional for the money: the provider's events move it either way. */
    reportFunding: (intentId: string, txHash: string) =>
        call<{ status: string }>(
            `/pix/withdraw/${encodeURIComponent(intentId)}/funded`,
            post({ txHash }),
            'Could not report the withdrawal'
        ),

    /**
     * Another own Pix key for a withdrawal whose payout the bank refused for its key or account. The
     * provider then pays the waiting money there. 409: the withdrawal is not waiting for a key (any more).
     */
    setRecoveryKey: (intentId: string, pixKey: string) =>
        call<{ accepted: true }>(
            `/pix/withdraw/${encodeURIComponent(intentId)}/recovery-key`,
            post({ pixKey }),
            'Could not save the Pix key'
        ),
}
