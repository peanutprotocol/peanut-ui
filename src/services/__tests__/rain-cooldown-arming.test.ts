/** @jest-environment jsdom */
/**
 * `armRainCooldownFromSuccess` is a writer into the app-wide Rain cooldown —
 * the state that gates every later collateral pull. It is fed from four
 * success paths, two of which (QR pay, Manteca off-ramp) carry `cooldownSec`
 * as a hand-declared optional field, so `undefined` is a real runtime value.
 * A guard slip would arm a lock after every successful payment.
 */
import { armRainCooldownFromSuccess, type RainCooldownEventDetail } from '@/services/rain'

jest.mock('js-cookie', () => ({ __esModule: true, default: { get: () => 'jwt-abc' } }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

function captureEvents() {
    const details: RainCooldownEventDetail[] = []
    const handler = (e: Event) => details.push((e as CustomEvent<RainCooldownEventDetail>).detail)
    window.addEventListener('rain:cooldown', handler)
    return { details, stop: () => window.removeEventListener('rain:cooldown', handler) }
}

describe('armRainCooldownFromSuccess', () => {
    it('dispatches a silent cooldown for a positive number of seconds', () => {
        const { details, stop } = captureEvents()
        armRainCooldownFromSuccess(120)
        stop()
        expect(details).toEqual([{ retryAfterSec: 120, message: '', silent: true }])
    })

    it.each([
        ['undefined', undefined],
        ['null', null],
        ['zero', 0],
        ['negative', -5],
        ['NaN', Number.NaN],
        ['Infinity', Number.POSITIVE_INFINITY],
        ['a numeric string', '120'],
        ['an object', { cooldownSec: 120 }],
    ])('dispatches nothing for %s', (_label, value) => {
        const { details, stop } = captureEvents()
        armRainCooldownFromSuccess(value)
        stop()
        expect(details).toEqual([])
    })
})
