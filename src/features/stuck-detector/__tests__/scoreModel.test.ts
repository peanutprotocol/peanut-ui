import { applyHysteresis, buildFeatureVector, evaluateGbdt, scoreStuckSession, STUCK_MODEL } from '../scoreModel'
import type { StuckScoreInput } from '../types'

describe('stuck-detector GBDT model', () => {
    it('loads the trained 45-tree model with 25 client-observable features', () => {
        expect(STUCK_MODEL.version).toBe('1.0.0')
        expect(STUCK_MODEL.features).toHaveLength(25)
        expect(STUCK_MODEL.trees).toHaveLength(45)
        expect(STUCK_MODEL.defaultThreshold).toBe(0.6)
    })

    it('matches Python trainer test vectors within 1e-5', () => {
        const vectors: Array<{ x: number[]; expected: number }> = [
            {
                x: [
                    0, 0, 1, 0, 0, 0, 8.472405008626103, 1, 1, 0, 1, 5.2832037287379885, 4.143134726391533,
                    3.367295829986474, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1,
                ],
                expected: 0.502721,
            },
            {
                x: [
                    0, 0, 0, 0, 0, 1, 4.927253685157205, 1, 0, 1, 1, 0.6931471805599453, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0,
                    0, 1, 0,
                ],
                expected: 0.589291,
            },
            {
                x: [
                    0, 1, 1, 0, 0, 0, 4.820281565605037, 1, 0, 0, 0, 2.833213344056216, 1.791759469228055,
                    1.0986122886681096, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0,
                ],
                expected: 0.763964,
            },
        ]

        for (const { x, expected } of vectors) {
            expect(evaluateGbdt(STUCK_MODEL, x)).toBeCloseTo(expected, 5)
        }
    })

    it('scores high-friction deposit sessions well above calm sessions', () => {
        const calm: StuckScoreInput = {
            flags: {
                appError: false,
                rageTaps: false,
                longIdle: false,
                moneyFailed: false,
                moneyStuck: false,
                kycBlocked: false,
            },
            durationSeconds: 15,
            loggedIn: true,
            journey: 'send',
            platform: 'ios-native',
            memory: {
                sessionCount: 5,
                priorObsFriction: 0,
                priorStuck: 0,
                prevWasStuck: false,
                seenAddMoneyUnfunded: false,
                dismissedUntil: {},
            },
        }
        const stuck: StuckScoreInput = {
            ...calm,
            journey: 'deposit',
            durationSeconds: 180,
            flags: {
                ...calm.flags,
                moneyFailed: true,
                moneyStuck: true,
                rageTaps: true,
            },
            memory: {
                ...calm.memory,
                priorObsFriction: 2,
                priorStuck: 2,
                prevWasStuck: true,
            },
        }

        expect(buildFeatureVector(calm)).toHaveLength(25)
        const calmRes = scoreStuckSession(calm)
        const stuckRes = scoreStuckSession(stuck)
        expect(stuckRes.rawScore).toBeGreaterThan(0.6)
        expect(stuckRes.rawScore).toBeGreaterThan(calmRes.rawScore + 0.35)
    })

    it('applies asymmetric hysteresis smoothing (faster rise than fall)', () => {
        const rose = applyHysteresis(0.2, 0.8)
        const fell = applyHysteresis(0.8, 0.2)
        expect(rose - 0.2).toBeGreaterThan(0.8 - fell)
        expect(rose).toBeCloseTo(0.53, 2)
        expect(fell).toBeCloseTo(0.68, 2)
    })
})
