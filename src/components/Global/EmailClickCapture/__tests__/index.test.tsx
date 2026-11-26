import { render } from '@testing-library/react'
import { NuqsTestingAdapter, type UrlUpdateEvent } from 'nuqs/adapters/testing'
import posthog from 'posthog-js'
import EmailClickCapture from '../index'

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

const mount = (searchParams: string, onUrlUpdate = jest.fn<void, [UrlUpdateEvent]>()) => {
    render(
        <NuqsTestingAdapter searchParams={searchParams} onUrlUpdate={onUrlUpdate}>
            <EmailClickCapture />
        </NuqsTestingAdapter>
    )
    return onUrlUpdate
}

beforeEach(() => jest.clearAllMocks())

describe('EmailClickCapture (TASK-22683)', () => {
    it('records an email click with its message and clears msg, keeping the UTM tags', async () => {
        const onUrlUpdate = mount('?msg=lifecycle.welcome&utm_source=peanut&utm_medium=email&utm_campaign=x')
        expect(posthog.capture).toHaveBeenCalledWith('notification_clicked', {
            msg: 'lifecycle.welcome',
            channel: 'email',
        })
        await new Promise((resolve) => setTimeout(resolve, 100))
        const params = onUrlUpdate.mock.calls.at(-1)![0].searchParams
        expect(params.get('msg')).toBeNull()
        expect(params.get('utm_medium')).toBe('email')
    })

    it('records nothing for a push open, which the click listener already counts', () => {
        mount('?msg=kyc.approved')
        expect(posthog.capture).not.toHaveBeenCalled()
    })

    it('records nothing for a value that is not a message type', () => {
        mount('?msg=a%40b.com&utm_medium=email')
        expect(posthog.capture).not.toHaveBeenCalled()
    })
})
