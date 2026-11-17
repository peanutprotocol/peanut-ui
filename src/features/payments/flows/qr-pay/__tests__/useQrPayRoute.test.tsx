/** @jest-environment jsdom */
import { renderHook } from '@testing-library/react'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import type { ReactNode } from 'react'
import type { CapabilityRoute } from '@/types/capabilities'

let mockRoutes: CapabilityRoute[] = []
let mockIsLoading = false
jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => ({ capabilities: { routes: mockRoutes }, nextActions: [], isLoading: mockIsLoading }),
}))

import { useQrPayRoute } from '../useQrPayRoute'

const PIX_CODE =
    '00020101021226680014br.gov.bcb.pix2546pix.example.com/qr/v2/cobv/padaria-pao-dourado520400005303986540542.505802BR5924PADARIA PAO DOURADO LTDA6009SAO PAULO62070503***63043A47'
const MP_CODE = 'mercadopago://pay?id=123'
const payRoute = (route: Partial<CapabilityRoute>): CapabilityRoute =>
    ({
        operation: 'pay',
        method: 'PIX_BR',
        provider: 'avenia',
        state: 'ready',
        candidates: [],
        ...route,
    }) as CapabilityRoute
const providerRejected = { code: 'provider_rejected', userMessage: 'Message support.' }

const mountRoute = (qrCode: string, qrType: string | null, searchParams = '') =>
    renderHook(() => useQrPayRoute(qrCode, qrType), {
        wrapper: ({ children }: { children: ReactNode }) => (
            <NuqsTestingAdapter searchParams={searchParams}>{children}</NuqsTestingAdapter>
        ),
    })
const renderRoute = (qrCode: string, qrType: string | null, searchParams = '') =>
    mountRoute(qrCode, qrType, searchParams).result.current
const TERMS = { key: 'accept-tos:avenia', url: 'https://app.avenia.io/Avenia-TC.pdf' }

describe('useQrPayRoute: which flow a scanned code mounts (API-CONTRACT-M4 §1)', () => {
    beforeEach(() => {
        mockRoutes = []
        mockIsLoading = false
    })

    it("a Pix code on Avenia's ready pay route goes through the neutral pay routes", () => {
        mockRoutes = [payRoute({})]
        expect(renderRoute(PIX_CODE, 'PIX')).toMatchObject({ viaPixRoutes: true, step: 'flow' })
    })

    it("a Pix code on Manteca's route, or with no pay route, keeps Manteca's QR flow", () => {
        mockRoutes = [payRoute({ provider: 'manteca' })]
        expect(renderRoute(PIX_CODE, 'PIX')).toMatchObject({ viaPixRoutes: false, step: 'flow' })
        mockRoutes = []
        expect(renderRoute(PIX_CODE, 'PIX')).toMatchObject({ viaPixRoutes: false, step: 'flow' })
    })

    it('an Argentine code never reads the Pix route, whatever it says', () => {
        mockRoutes = [payRoute({})]
        expect(renderRoute(MP_CODE, 'MERCADO_PAGO')).toMatchObject({ viaPixRoutes: false, step: 'flow' })
        mockIsLoading = true
        expect(renderRoute(MP_CODE, 'MERCADO_PAGO').step).toBe('flow')
    })

    it('waits for the route before it mounts anything for a Pix code', () => {
        mockIsLoading = true
        expect(renderRoute(PIX_CODE, 'PIX').step).toBe('loading')
    })

    it("no Avenia account yet, or one opening: the route's setup step (the no-tap opening)", () => {
        mockRoutes = [payRoute({ state: 'action_required', action: 'activate' })]
        expect(renderRoute(PIX_CODE, 'PIX').step).toBe('setup')
        mockRoutes = [payRoute({ state: 'pending' })]
        expect(renderRoute(PIX_CODE, 'PIX').step).toBe('setup')
    })

    // TASK-25073: an Avenia account opened before its terms step accepts them at its next Pix payment
    it("a ready route that still names Avenia's terms meets them before the scan's flow", () => {
        mockRoutes = [payRoute({ terms: TERMS })]
        expect(renderRoute(PIX_CODE, 'PIX')).toMatchObject({ viaPixRoutes: true, step: 'setup' })
    })

    it('terms a later read brings do not take the flow of a scan away', () => {
        mockRoutes = [payRoute({})]
        const view = mountRoute(PIX_CODE, 'PIX')
        expect(view.result.current.step).toBe('flow')
        mockRoutes = [payRoute({ terms: TERMS })]
        view.rerender()
        expect(view.result.current.step).toBe('flow')
    })

    it('a user Avenia refused goes to support, never to Manteca', () => {
        mockRoutes = [
            payRoute({
                provider: null,
                state: 'refused',
                reason: providerRejected,
                candidates: [
                    { provider: 'avenia', state: 'refused', reason: providerRejected },
                    { provider: 'manteca', state: 'refused', reason: { code: 'provider_moved', userMessage: '' } },
                ] as CapabilityRoute['candidates'],
            }),
        ]
        expect(renderRoute(PIX_CODE, 'PIX')).toMatchObject({ viaPixRoutes: true, step: 'support' })
    })

    it('a refusal of the residence stays with the QR flow, which shows its own screen', () => {
        const notServed = { code: 'residence_not_served', userMessage: 'Not where you live.' }
        mockRoutes = [payRoute({ provider: null, state: 'refused', reason: notServed })]
        expect(renderRoute(PIX_CODE, 'PIX')).toMatchObject({ viaPixRoutes: false, step: 'flow' })
    })

    it('a payment already opened shows its outcome, whatever the route says now', () => {
        mockRoutes = [payRoute({ state: 'action_required', action: 'activate' })]
        expect(renderRoute(PIX_CODE, 'PIX', '?intentId=pay-1').step).toBe('flow')
    })

    // Chip on 01140e4de: an opened payment is read where it was opened, whatever the route says now
    it.each([
        ['turned to Manteca', [payRoute({ provider: 'manteca' })]],
        ['is gone', []],
    ])('a Pix payment already opened stays on the neutral pay routes when the route %s', (_label, routes) => {
        mockRoutes = routes
        expect(renderRoute(PIX_CODE, 'PIX', '?intentId=pay-1')).toMatchObject({ viaPixRoutes: true, step: 'flow' })
    })

    it('an id in the URL never moves an Argentine code to the Pix routes', () => {
        mockRoutes = [payRoute({ provider: 'manteca' })]
        expect(renderRoute(MP_CODE, 'MERCADO_PAGO', '?intentId=pay-1').viaPixRoutes).toBe(false)
    })
})
