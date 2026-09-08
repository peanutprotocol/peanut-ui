import { ACCESSIBILITY_BOOTSTRAP_SCRIPT } from '../accessibility-bootstrap'
import {
    ACCESSIBILITY_STORAGE_KEY,
    parseAccessibilityPreferences,
    REDUCED_MOTION_QUERY,
} from '../accessibility-preferences'

function bootstrap(raw: string | null, systemReduced = false, brokenStorage = false) {
    const dataset: Record<string, string> = {}
    const getItem = jest.fn(() => {
        if (brokenStorage) throw new Error('Storage denied')
        return raw
    })
    const matchMedia = jest.fn(() => ({ matches: systemReduced }))
    // Execute the shipped script with no provider, React effects or app chunks.
    new Function('window', 'document', ACCESSIBILITY_BOOTSTRAP_SCRIPT)(
        { localStorage: { getItem }, matchMedia },
        { documentElement: { dataset } }
    )
    expect(getItem).toHaveBeenCalledWith(ACCESSIBILITY_STORAGE_KEY)
    expect(matchMedia).toHaveBeenCalledWith(REDUCED_MOTION_QUERY)
    return dataset
}

it('applies saved text, contrast and explicit reduced motion synchronously while OS motion is off', () => {
    expect(bootstrap('{"largerText":true,"highContrast":true,"motion":"on"}')).toEqual({
        largerText: 'true',
        highContrast: 'true',
        reducedMotion: 'true',
    })
})

it.each([
    null,
    '{broken',
    'null',
    'true',
    '[]',
    '{"motion":"invalid","largerText":"true","highContrast":1}',
    '{"motion":"off","largerText":true}',
    '{"motion":"on","highContrast":true}',
    '{"motion":"system"}',
])('matches live preference validation for stored value %s', (raw) => {
    const preferences = parseAccessibilityPreferences(raw)
    for (const systemReduced of [false, true]) {
        expect(bootstrap(raw, systemReduced)).toEqual({
            largerText: String(preferences.largerText),
            highContrast: String(preferences.highContrast),
            reducedMotion: String(preferences.motion === 'on' || (preferences.motion === 'system' && systemReduced)),
        })
    }
})

it('still honors OS reduced motion when storage is blocked', () => {
    expect(bootstrap(null, true, true)).toEqual({
        largerText: 'false',
        highContrast: 'false',
        reducedMotion: 'true',
    })
})

it('applies saved settings when matchMedia is unavailable', () => {
    const dataset: Record<string, string> = {}
    new Function('window', 'document', ACCESSIBILITY_BOOTSTRAP_SCRIPT)(
        { localStorage: { getItem: () => '{"motion":"on","largerText":true}' } },
        { documentElement: { dataset } }
    )
    expect(dataset).toEqual({ largerText: 'true', highContrast: 'false', reducedMotion: 'true' })
})
