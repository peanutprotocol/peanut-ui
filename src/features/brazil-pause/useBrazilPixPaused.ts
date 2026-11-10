'use client'

import { useResidenceIso2s } from '@/features/deposit-accounts/useResidenceIso2s'
import { useBrazilPauseResidences } from './useBrazilPauseResidences'
import { useBrazilServicesPaused } from './useBrazilServicesPaused'

/**
 * True when Pix payments and Pix-key sends are closed for this user: while the
 * Brazil pause covers them and they do not live outside Brazil, and for a
 * Brazil resident even once the pause is off, until Pix pay runs on a provider
 * that serves residents. Every Pix entry then shows the Brazil paused drawer
 * or screen.
 *
 * Residence is the one every gate reads (`useResidenceIso2s`), and the API
 * refuses a Pix payment on the same rule (`PIX_RESIDENCE_NOT_SUPPORTED`).
 */
export function useBrazilPixPaused(): boolean {
    const brazilPaused = useBrazilServicesPaused()
    const pauseResidences = useBrazilPauseResidences()
    const residesInBrazil = useBrazilResident()
    // The pause's Brazil rails do not close Pix for a resident elsewhere: one
    // Manteca account serves both exchanges, so an Argentine account makes the
    // API rate Pix deposit and withdraw `enabled` (TASK-24724).
    const livesOutsideBrazil = pauseResidences.length > 0 && !pauseResidences.includes('BR')
    return (brazilPaused && !livesOutsideBrazil) || residesInBrazil
}

/** The residence half of `useBrazilPixPaused`, for screens that only hide Pix offers. */
export function useBrazilResident(): boolean {
    return useResidenceIso2s().includes('BR')
}
