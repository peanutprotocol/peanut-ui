import { evaluateSumsubStatusEvent } from '@/components/Kyc/sumsubStatusEvent.utils'

const greenPayload = { reviewStatus: 'completed', reviewResult: { reviewAnswer: 'GREEN' } }
const redPayload = { reviewStatus: 'completed', reviewResult: { reviewAnswer: 'RED' } }
const pendingPayload = { reviewStatus: 'pending' }
const emptyPayload = {}

describe('evaluateSumsubStatusEvent', () => {
    describe('within the 3s early-event guard', () => {
        it('GREEN marks submitted but does not auto-close', () => {
            expect(
                evaluateSumsubStatusEvent({
                    payload: greenPayload,
                    sdkInitTime: 1000,
                    now: 2999,
                    isMultiLevel: false,
                })
            ).toEqual({ markSubmitted: true, autoClose: false })
        })

        it('RED is a no-op (stale retry state — let user resubmit)', () => {
            expect(
                evaluateSumsubStatusEvent({
                    payload: redPayload,
                    sdkInitTime: 1000,
                    now: 2999,
                    isMultiLevel: false,
                })
            ).toEqual({ markSubmitted: false, autoClose: false })
        })

        it('non-completed status is a no-op', () => {
            expect(
                evaluateSumsubStatusEvent({
                    payload: pendingPayload,
                    sdkInitTime: 1000,
                    now: 2999,
                    isMultiLevel: false,
                })
            ).toEqual({ markSubmitted: false, autoClose: false })
        })

        it('multi-level + GREEN still marks submitted (close-warning fix takes priority)', () => {
            expect(
                evaluateSumsubStatusEvent({
                    payload: greenPayload,
                    sdkInitTime: 1000,
                    now: 2999,
                    isMultiLevel: true,
                })
            ).toEqual({ markSubmitted: true, autoClose: false })
        })
    })

    describe('outside the early-event guard', () => {
        it('GREEN marks submitted AND auto-closes', () => {
            expect(
                evaluateSumsubStatusEvent({
                    payload: greenPayload,
                    sdkInitTime: 1000,
                    now: 5000,
                    isMultiLevel: false,
                })
            ).toEqual({ markSubmitted: true, autoClose: true })
        })

        it('multi-level suppresses both flags even on GREEN', () => {
            expect(
                evaluateSumsubStatusEvent({
                    payload: greenPayload,
                    sdkInitTime: 1000,
                    now: 5000,
                    isMultiLevel: true,
                })
            ).toEqual({ markSubmitted: false, autoClose: false })
        })

        it('RED is a no-op', () => {
            expect(
                evaluateSumsubStatusEvent({
                    payload: redPayload,
                    sdkInitTime: 1000,
                    now: 5000,
                    isMultiLevel: false,
                })
            ).toEqual({ markSubmitted: false, autoClose: false })
        })

        it('empty payload is a no-op', () => {
            expect(
                evaluateSumsubStatusEvent({
                    payload: emptyPayload,
                    sdkInitTime: 1000,
                    now: 5000,
                    isMultiLevel: false,
                })
            ).toEqual({ markSubmitted: false, autoClose: false })
        })
    })

    it('boundary at exactly 3000ms is treated as outside guard', () => {
        expect(
            evaluateSumsubStatusEvent({
                payload: greenPayload,
                sdkInitTime: 1000,
                now: 4000,
                isMultiLevel: false,
            })
        ).toEqual({ markSubmitted: true, autoClose: true })
    })
})
