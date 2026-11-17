'use client'

import { parseAsString, useQueryState } from 'nuqs'
import { EQrType } from '@/components/Global/DirectSendQR/utils'
import { findPixRoute, pixPaysThroughPayRoutes } from '@/features/pix/pixRoute.utils'
import type { PixSetupState } from '@/features/pix/pixRouteStep'
import { usePixFlowSetupState } from '@/features/pix/usePixFlowSetupState'
import { useCapabilities } from '@/hooks/useCapabilities'
import type { CapabilityRoute } from '@/types/capabilities'
import { isPixEmvcoQr } from '@/utils/withdraw.utils'

/**
 * What /qr-pay mounts for a scan, from the pay:PIX_BR route:
 * - `loading`: a Pix code, and the route is not read yet.
 * - `flow`: the QR pay flow. Every code that is not a Pix code on the neutral routes, a Pix code whose
 *   route is ready or paused (the flow shows the pause), and a payment already opened (`?intentId=`),
 *   which shows its outcome whatever the route says now.
 * - `setup`: the route's step before Pix works (verify, the provider's terms, the account the first
 *   use opens, the wait). The terms gate each scan, never a payment already opened
 *   (`usePixFlowSetupState`).
 * - `support`: the provider refused the user; support fixes it.
 */
export type QrPayRouteStep = 'loading' | 'flow' | 'setup' | 'support'

export function qrPayRouteStep(input: {
    route: CapabilityRoute | undefined
    /** The route's setup state as the flow reads it for this attempt (`usePixFlowSetupState`). */
    setupState: PixSetupState
    viaPixRoutes: boolean
    isPixCode: boolean
    isLoading: boolean
    hasOpenedPayment: boolean
}): QrPayRouteStep {
    if (!input.isPixCode) return 'flow'
    if (input.isLoading) return 'loading'
    if (!input.viaPixRoutes || input.hasOpenedPayment) return 'flow'
    switch (input.route?.state) {
        case 'paused':
            return 'flow'
        case 'refused':
            return 'support'
        default:
            return input.setupState === 'ready' ? 'flow' : 'setup'
    }
}

/**
 * The route a scanned code is paid on. A Pix code goes through the neutral pay routes when the
 * pay:PIX_BR route says so (`pixPaysThroughPayRoutes`); every other code, and a Pix code on any other
 * route, keeps its provider's QR flow (API-CONTRACT-M4 §1).
 *
 * A payment already opened stays on the rail that opened it: only the neutral pay routes put its id in
 * the URL (`?intentId=`), so the flow reads that payment there whatever the route says now (a gate
 * flip, the BRL switch, a route that is gone). Moving it to Manteca's flow would offer a second
 * payment for the same scan while the first one exists.
 */
export function useQrPayRoute(qrCode: string, qrType: string | null) {
    const { capabilities, isLoading } = useCapabilities()
    const [intentId] = useQueryState('intentId', parseAsString)
    const isPixCode = qrType === EQrType.PIX || isPixEmvcoQr(qrCode)
    const route = isPixCode ? findPixRoute(capabilities.routes, 'pay') : undefined
    const viaPixRoutes = isPixCode && (!!intentId || pixPaysThroughPayRoutes(route))
    // one scan is one attempt: the page mounts anew for each scan
    const setupState = usePixFlowSetupState(route, !!intentId)
    return {
        route,
        viaPixRoutes,
        step: qrPayRouteStep({ route, setupState, viaPixRoutes, isPixCode, isLoading, hasOpenedPayment: !!intentId }),
    }
}
