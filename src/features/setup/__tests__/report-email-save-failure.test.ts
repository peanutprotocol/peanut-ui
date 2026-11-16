/**
 * The 09 Email save-failure report (contract P4 § 2, "Dev behaviour to keep": `report-email-save-failure.ts`).
 * Ported from dev's Views/__tests__/NotificationSetup.test.tsx, which checked it through the deleted Email view.
 */
import { captureMessage } from '@/utils/sentry-lazy'
import { reportEmailSaveFailure } from '../report-email-save-failure'

jest.mock('@/utils/sentry-lazy', () => ({ captureMessage: jest.fn() }))

type Context = { level: string; fingerprint: string[]; tags: Record<string, string | undefined> }

beforeEach(() => jest.clearAllMocks())

it.each([
    ['network', undefined, undefined],
    ['http', 500, '500'],
    ['other', undefined, undefined],
] as const)(
    'P4-13 reports a %s failure at error level under one fingerprint per kind, without the address',
    (kind, status, httpStatus) => {
        reportEmailSaveFailure({ failureKind: kind, status, attempt: 1 })
        expect(captureMessage).toHaveBeenCalledTimes(1)
        const [message, context] = jest.mocked(captureMessage).mock.calls[0] as unknown as [string, Context]
        expect(message).toBe('Sign-up email save failed')
        expect(context).toMatchObject({
            level: 'error',
            fingerprint: ['signup-email-save-failed', kind],
            tags: {
                flow: 'signup',
                step: 'notification-email',
                failure_kind: kind,
                native: 'false',
                platform: expect.any(String),
                attempt: '1',
            },
        })
        expect(context.tags.http_status).toBe(httpStatus)
        expect(JSON.stringify(context)).not.toMatch(/@/)
    }
)

it('P4-13 counts the attempt and defaults a missing kind to other', () => {
    reportEmailSaveFailure({ attempt: 2 })
    const [, context] = jest.mocked(captureMessage).mock.calls[0] as unknown as [string, Context]
    expect(context.tags).toMatchObject({ failure_kind: 'other', attempt: '2' })
    expect(context.fingerprint).toEqual(['signup-email-save-failed', 'other'])
})
