import { FLAG_DEFAULTS } from '@/utils/featureFlag.utils'
import { SCREENS } from './catalogue'
import { FLAGS, FLAG_EXEMPTIONS, FLAG_VARIANTS } from './flag-variants'

jest.mock('posthog-js', () => ({
    __esModule: true,
    default: {
        featureFlags: {
            hasLoadedFlags: true,
            getFlagVariants: () => ({}),
        },
        getFeatureFlag: () => undefined,
        isFeatureEnabled: () => false,
        onFeatureFlags: () => () => {},
        capture: () => {},
    },
}))

describe('PostHog flag variants in the Screen Library', () => {
    it('lists every flag the app reads', () => {
        expect(Object.keys(FLAGS).sort()).toEqual(Object.keys(FLAG_DEFAULTS).sort())
    })

    it('starts each boolean flag at its registered default, except a nonProdBypass read', () => {
        for (const [flag, value] of Object.entries(FLAG_DEFAULTS)) {
            if (flag === 'user-interviews-invite' || flag === 'stuck-buddy-interventions') {
                expect(FLAGS[flag].baseline).toBe(true)
            } else {
                expect(FLAGS[flag].baseline).toBe(value)
            }
        }
    })

    it('shows every value of every flag in some capture, or says why it cannot', () => {
        for (const [flag, { values, baseline }] of Object.entries(FLAGS)) {
            const variants = FLAG_VARIANTS.filter((variant) => variant.flag === flag)
            if (FLAG_EXEMPTIONS[flag]) {
                expect(variants).toEqual([])
                continue
            }
            for (const value of values)
                expect({ flag, value, shown: value === baseline || variants.some((v) => v.value === value) }).toEqual({
                    flag,
                    value,
                    shown: true,
                })
        }
    })

    it('sets only listed values, each as its own catalogue state', () => {
        for (const variant of FLAG_VARIANTS) {
            expect(FLAGS[variant.flag].values).toContain(variant.value)
            expect(variant.value).not.toBe(FLAGS[variant.flag].baseline)
            expect(
                SCREENS.filter(
                    (screen) => screen.flags?.[variant.flag] === variant.value && screen.id.startsWith(variant.base)
                )
            ).toHaveLength(1)
        }
    })
})
