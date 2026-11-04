'use client'

/**
 * Avenia — Pix deposits and withdrawals for Brazilian residents (peanut-api-ts
 * /avenia/* routes). Every failed call throws an ApiError, so screens branch
 * on its wire `code` (API_ERROR_CODES), never on the message.
 */

import { apiErrorFromResponse } from '@/services/api-error'
import { apiFetch } from '@/utils/api-fetch'
import type { paths } from '@/types/api.generated'

type Json<T> = T extends { content: { 'application/json': infer Body } } ? Body : never

export type AveniaDepositEligibility = Json<paths['/avenia/deposit/eligibility']['get']['responses'][200]>
export type AveniaDeposit = Json<paths['/avenia/deposit']['post']['responses'][200]>
export type AveniaDepositStatus = Json<paths['/avenia/deposit/{intentId}']['get']['responses'][200]>
export type AveniaKycStart = Json<paths['/avenia/kyc/start']['post']['responses'][200]>
export type PixKeyInfo = Json<paths['/avenia/pix-key-info']['get']['responses'][200]>
export type AveniaWithdrawDisplay = Json<paths['/avenia/withdraw/preview']['post']['responses'][200]>
export type AveniaWithdrawInit = Json<paths['/avenia/withdraw/init']['post']['responses'][200]>
export type AveniaWithdrawSign = AveniaWithdrawInit['sign']

/** One amount, never both: reais to credit, or USDC to convert. */
export type AveniaWithdrawRequest = { pixKey: string } & ({ amountBrl: string } | { amountUsd: string })

async function call<T>(path: string, init: RequestInit, fallbackMessage: string): Promise<T> {
    const response = await apiFetch(path, init)
    if (!response.ok) throw await apiErrorFromResponse(response, fallbackMessage)
    return (await response.json()) as T
}

const post = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) })

export const aveniaApi = {
    depositEligibility: () =>
        call<AveniaDepositEligibility>('/avenia/deposit/eligibility', { method: 'GET' }, 'Pix is not available'),

    createDeposit: (amountBrl: string) =>
        call<AveniaDeposit>('/avenia/deposit', post({ amountBrl }), 'Could not create the Pix code'),

    depositStatus: (intentId: string) =>
        call<AveniaDepositStatus>(
            `/avenia/deposit/${encodeURIComponent(intentId)}`,
            { method: 'GET' },
            'Could not read the deposit'
        ),

    /** First use: creates the Avenia sub-account once and returns the hosted KYC link. */
    startKyc: (redirectUrl?: string) =>
        call<AveniaKycStart>('/avenia/kyc/start', post(redirectUrl ? { redirectUrl } : {}), 'Could not start Pix'),

    pixKeyInfo: (key: string) =>
        call<PixKeyInfo>(
            `/avenia/pix-key-info?${new URLSearchParams({ key }).toString()}`,
            { method: 'GET' },
            'Could not look up the Pix key'
        ),

    previewWithdrawal: (request: AveniaWithdrawRequest) =>
        call<AveniaWithdrawDisplay>('/avenia/withdraw/preview', post(request), 'Could not quote the withdrawal'),

    initWithdrawal: (request: AveniaWithdrawRequest) =>
        call<AveniaWithdrawInit>('/avenia/withdraw/init', post(request), 'Could not start the withdrawal'),

    /** The mined transaction that funds the withdrawal. Optional for the money: Avenia's webhook moves it either way. */
    reportFunding: (intentId: string, txHash: string) =>
        call<{ status: string }>(
            `/avenia/withdraw/${encodeURIComponent(intentId)}/funded`,
            post({ txHash }),
            'Could not report the withdrawal'
        ),
}
