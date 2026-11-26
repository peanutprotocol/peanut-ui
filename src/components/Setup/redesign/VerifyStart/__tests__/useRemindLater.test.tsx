/** @jest-environment jsdom */
// "Remind me later" schedules the nudge engine's reminder (TASK-22683, api#2307): a checklist snooze until tomorrow
// 09:00 on the user's clock, written to the profile, and one line saying when. A refused write promises nothing.
import type { ReactNode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { updateUserById } from '@/app/actions/users'
import * as Sentry from '@/utils/sentry-lazy'
import { CATALOGS, msg, type TestLocale } from '@/components/Setup/redesign/Landing/__tests__/redesign-harness'
import { tomorrowMorning, useRemindLater } from '../useRemindLater'

jest.mock('@/app/actions/users', () => ({ updateUserById: jest.fn() }))
jest.mock('@/utils/sentry-lazy', () => ({ captureMessage: jest.fn() }))
const mockToast = { success: jest.fn(), error: jest.fn() }
jest.mock('@/components/0_Bruddle/Toast', () => ({ useToast: () => mockToast }))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: { user: { userId: 'user-1' } } }) }))

const update = updateUserById as jest.Mock
// the app's provider formats in the device's time zone (useClientTimeZone), so the test does too
const deviceTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
const NOW = new Date(2026, 10, 26, 22, 15)

function remind(locale: TestLocale = 'en') {
    const wrapper = ({ children }: { children: ReactNode }) => (
        <NextIntlClientProvider locale={locale} messages={CATALOGS[locale] as never} timeZone={deviceTimeZone}>
            {children}
        </NextIntlClientProvider>
    )
    return renderHook(() => useRemindLater(), { wrapper }).result.current
}

beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers({ now: NOW })
})
afterEach(() => jest.useRealTimers())

describe('tomorrowMorning', () => {
    it('is 09:00 the next day on the device clock, from late evening and from just after midnight', () => {
        expect(tomorrowMorning(NOW)).toEqual(new Date(2026, 10, 27, 9, 0, 0, 0))
        expect(tomorrowMorning(new Date(2026, 10, 30, 0, 5))).toEqual(new Date(2026, 11, 1, 9, 0, 0, 0))
    })
})

describe('useRemindLater', () => {
    it('writes the checklist snooze for tomorrow 09:00 and says when the reminder comes', async () => {
        update.mockResolvedValue({ data: {} })
        const remindLater = remind()
        let saved: boolean | undefined
        await act(async () => {
            saved = await remindLater()
        })

        expect(saved).toBe(true)
        expect(update).toHaveBeenCalledTimes(1)
        expect(update.mock.calls[0][0]).toEqual({
            userId: 'user-1',
            attentionLedger: {
                checklist: {
                    snoozedUntil: new Date(2026, 10, 27, 9, 0).toISOString(),
                    updatedAt: NOW.toISOString(),
                },
            },
        })
        expect(mockToast.success).toHaveBeenCalledWith(
            expect.stringMatching(/^We’ll remind you tomorrow at 9:00\sAM\.$/u)
        )
        expect(mockToast.error).not.toHaveBeenCalled()
    })

    it('says the time in the user’s language', async () => {
        update.mockResolvedValue({ data: {} })
        const remindLater = remind('pt-BR')
        await act(async () => {
            await remindLater()
        })
        expect(mockToast.success).toHaveBeenCalledWith('Vamos te lembrar amanhã às 09:00.')
    })

    it('promises no reminder when the API refuses the write, and reports the refusal', async () => {
        update.mockResolvedValue({ error: 'attentionLedger is not a ledger', failureKind: 'http', status: 400 })
        const remindLater = remind()
        let saved: boolean | undefined
        await act(async () => {
            saved = await remindLater()
        })

        expect(saved).toBe(false)
        expect(mockToast.success).not.toHaveBeenCalled()
        expect(mockToast.error).toHaveBeenCalledWith(msg('setupRedesign.verifyStart.remindFailed'))
        expect(Sentry.captureMessage).toHaveBeenCalledWith(
            'remind me later: snooze write failed',
            expect.objectContaining({ extra: { status: 400, error: 'attentionLedger is not a ledger' } })
        )
    })
})
