import type { ScreenId } from '@/components/Setup/Setup.types'
import {
    clearSignupProgress,
    readSignupProgress,
    resumeScreen,
    saveSignupProgress,
    type SignupProgress,
} from '../signup-progress'

const MASTER: ScreenId[] = [
    'landing',
    'signup',
    'invite',
    'advantage-fees',
    'advantage-card',
    'residence',
    'payment-plan',
    'notification-email',
    'notification-permission',
    'advantage-control',
]
const progress = (screenId: ScreenId): SignupProgress => ({
    screenId,
    answers: {
        residenceCountry: 'AR',
        nationalityCountry: 'BR',
        fundingChannel: 'arsBank',
        paymentChannel: 'qr',
        notificationChoices: { push: true, marketingPush: false, emailUpdates: true, cascaded: true },
        inviterAccepted: true,
        sellScreensCountry: null,
    },
})

beforeEach(() => localStorage.clear())

describe('signup progress storage', () => {
    it('round-trips the step and every answer for that account only', () => {
        saveSignupProgress('u-1', progress('advantage-control'))
        expect(readSignupProgress('u-1')).toEqual(progress('advantage-control'))
        expect(readSignupProgress('u-2')).toBeNull()
        clearSignupProgress('u-1')
        expect(readSignupProgress('u-1')).toBeNull()
    })

    it('drops a record older than 30 days', () => {
        saveSignupProgress('u-1', progress('payment-plan'), 0)
        expect(readSignupProgress('u-1', 31 * 24 * 60 * 60 * 1000)).toBeNull()
        expect(localStorage.length).toBe(0)
    })

    it('drops a record for a step before registration or a corrupt one', () => {
        saveSignupProgress('u-1', progress('signup'))
        expect(readSignupProgress('u-1')).toBeNull()
        localStorage.setItem('peanut:signupProgress:u-1', '{not json')
        expect(readSignupProgress('u-1')).toBeNull()
    })

    it('ignores answers that are not valid values', () => {
        localStorage.setItem(
            'peanut:signupProgress:u-1',
            JSON.stringify({
                version: 1,
                savedAt: Date.now(),
                screenId: 'payment-plan',
                answers: {
                    residenceCountry: 'argentina',
                    fundingChannel: 'cash',
                    notificationChoices: { push: 'yes' },
                },
            })
        )
        expect(readSignupProgress('u-1')?.answers).toMatchObject({
            residenceCountry: '',
            fundingChannel: null,
            notificationChoices: null,
            sellScreensCountry: undefined,
        })
    })
})

describe('resumeScreen', () => {
    const list: ScreenId[] = [
        'landing',
        'signup',
        'residence',
        'payment-plan',
        'notification-email',
        'advantage-control',
    ]

    it('continues at the saved step', () => {
        expect(resumeScreen(progress('advantage-control'), list, MASTER)).toBe('advantage-control')
    })

    it('without progress restarts at the first step after registration', () => {
        expect(resumeScreen(null, list, MASTER)).toBe('residence')
    })

    it('a saved step that left the list continues at the next later step', () => {
        expect(resumeScreen(progress('invite'), list, MASTER)).toBe('residence')
        expect(resumeScreen(progress('notification-permission'), list, MASTER)).toBe('advantage-control')
    })
})
