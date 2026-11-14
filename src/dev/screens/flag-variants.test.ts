import { FLAG_DEFAULTS } from '@/utils/featureFlag.utils'
import { NOTIFICATIONS_EXPERIMENT_FLAG, readNotificationsVariant } from '@/features/setup/notificationsExperiment'
import {
    WELCOME_HEADLINE_EXPERIMENT_FLAG,
    readWelcomeHeadlineVariant,
} from '@/features/setup/welcomeHeadlineExperiment'
import { SCREENS } from './catalogue'
import { FLAGS, FLAG_EXEMPTIONS, FLAG_VARIANTS } from './flag-variants'

const flagState = { value: undefined as unknown }
jest.mock('posthog-js', () => ({
    __esModule: true,
    default: {
        featureFlags: {
            hasLoadedFlags: true,
            getFlagVariants: () => ({ [WELCOME_HEADLINE_EXPERIMENT_FLAG]: flagState.value }),
        },
        getFeatureFlag: () => flagState.value,
        isFeatureEnabled: () => false,
        onFeatureFlags: () => () => {},
        capture: () => {},
    },
}))

describe('PostHog flag variants in the Screen Library', () => {
    it('lists every flag the app reads', () => {
        expect(Object.keys(FLAGS).sort()).toEqual(
            [...Object.keys(FLAG_DEFAULTS), NOTIFICATIONS_EXPERIMENT_FLAG, WELCOME_HEADLINE_EXPERIMENT_FLAG].sort()
        )
    })

    it('lists exactly the experiment arms the app accepts', () => {
        for (const value of FLAGS[NOTIFICATIONS_EXPERIMENT_FLAG].values) {
            flagState.value = value
            expect(readNotificationsVariant()).toBe(value)
        }
        flagState.value = 'unknown-arm'
        expect(readNotificationsVariant()).toBe(FLAGS[NOTIFICATIONS_EXPERIMENT_FLAG].baseline)
    })

    it('starts each boolean flag at its registered default, except a nonProdBypass read', () => {
        for (const [flag, value] of Object.entries(FLAG_DEFAULTS)) {
            if (flag === 'user-interviews-invite') expect(FLAGS[flag].baseline).toBe(true)
            else expect(FLAGS[flag].baseline).toBe(value)
        }
    })

    it('lists exactly the welcome arms accepted by the app', () => {
        for (const value of FLAGS[WELCOME_HEADLINE_EXPERIMENT_FLAG].values) {
            flagState.value = value
            expect(readWelcomeHeadlineVariant(true)).toBe(value)
        }
        flagState.value = 'unknown-arm'
        expect(readWelcomeHeadlineVariant(true)).toBe(FLAGS[WELCOME_HEADLINE_EXPERIMENT_FLAG].baseline)
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
