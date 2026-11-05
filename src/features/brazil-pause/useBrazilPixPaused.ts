'use client'

import { useResidenceIso2s } from '@/features/deposit-accounts/useResidenceIso2s'
import { useBrazilServicesPaused } from './useBrazilServicesPaused'

/**
 * True when Pix payments and Pix-key sends are closed for this user: while the
 * Brazil pause covers them, and for a Brazil resident even once the pause is
 * off, until Pix pay runs on a provider that serves residents. Every Pix entry
 * then shows the Brazil paused drawer or screen.
 *
 * Residence is the one every gate reads (`useResidenceIso2s`), and the API
 * refuses a Pix payment on the same rule (`PIX_RESIDENCE_NOT_SUPPORTED`).
 */
export function useBrazilPixPaused(): boolean {
    const brazilPaused = useBrazilServicesPaused()
    const residesInBrazil = useBrazilResident()
    return brazilPaused || residesInBrazil
}

/** The residence half of `useBrazilPixPaused`, for screens that only hide Pix offers. */
export function useBrazilResident(): boolean {
    return useResidenceIso2s().includes('BR')
}
