'use client'

/**
 * Provider-neutral Pix calls: the provider is the one the user's route names
 * (capabilities.routes). Every failed call throws an ApiError, so screens
 * branch on its wire `code`, never on the message.
 */

import { apiErrorFromResponse } from '@/services/api-error'
import { apiFetch } from '@/utils/api-fetch'
import type { paths } from '@/types/api.generated'

type QuoteOperation = paths['/pix/quote']['get']

export type PixQuoteRequest = QuoteOperation['parameters']['query']
export type PixQuote = QuoteOperation['responses'][200]['content']['application/json']

export const pixApi = {
    /** An indicative quote for amount entry: no ticket, no key lookup; the deposit and the review quote again. */
    quote: async (request: PixQuoteRequest): Promise<PixQuote> => {
        const query = new URLSearchParams(
            Object.entries(request).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
        )
        const response = await apiFetch(`/pix/quote?${query.toString()}`, { method: 'GET' })
        if (!response.ok) throw await apiErrorFromResponse(response, 'Could not quote the amount')
        return (await response.json()) as PixQuote
    },
}
