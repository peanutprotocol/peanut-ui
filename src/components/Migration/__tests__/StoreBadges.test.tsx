import { act, fireEvent, render, screen } from '@testing-library/react'
import StoreBadges from '../StoreBadges'
import { copyIOSHandoff, trackDeferredHandoffCreated } from '@/utils/deferred-link'

jest.mock('@/hooks/useGetDeviceType', () => ({
    DeviceType: { WEB: 'web', IOS: 'ios', ANDROID: 'android' },
    useDeviceType: () => ({ deviceType: 'web' }),
}))
jest.mock('@/utils/migration.utils', () => ({ trackStoreClick: jest.fn() }))
jest.mock('@/utils/deferred-link', () => ({
    copyIOSHandoff: jest.fn(),
    trackDeferredHandoffCreated: jest.fn(),
    playStoreUrlWithReferrer: (payload: string) => `https://play.google.com/store/apps?referrer=${payload}`,
}))
jest.mock('@/components/0_Bruddle/Button', () => ({
    Button: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))

const payload = 'pnutdl=1&badge_campaign=door&dest=%2Fcard'
beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(copyIOSHandoff).mockResolvedValue(undefined)
})

it('counts an Android handoff once when the visitor follows its store link', () => {
    render(<StoreBadges surface="landing_door" payload={payload} />)
    expect(trackDeferredHandoffCreated).not.toHaveBeenCalled()
    const link = screen.getByRole('link', { name: 'Google Play' })
    fireEvent.click(link)
    fireEvent.click(link)
    expect(trackDeferredHandoffCreated).toHaveBeenCalledTimes(1)
    expect(trackDeferredHandoffCreated).toHaveBeenCalledWith('android')
})

it('counts an iOS handoff only after the clipboard write succeeds, once per payload', async () => {
    let copied!: () => void
    jest.mocked(copyIOSHandoff).mockReturnValue(
        new Promise<void>((resolve) => {
            copied = resolve
        })
    )
    render(<StoreBadges surface="landing_door" payload={payload} />)
    fireEvent.click(screen.getByRole('link', { name: 'App Store' }))
    expect(copyIOSHandoff).toHaveBeenCalledWith(payload)
    expect(trackDeferredHandoffCreated).not.toHaveBeenCalled()
    await act(async () => copied())
    expect(trackDeferredHandoffCreated).toHaveBeenCalledWith('ios')
    await act(async () => {
        fireEvent.click(screen.getByRole('link', { name: 'App Store' }))
    })
    expect(trackDeferredHandoffCreated).toHaveBeenCalledTimes(1)
})

it('does not count a failed iOS clipboard write', async () => {
    jest.mocked(copyIOSHandoff).mockRejectedValue(new Error('Clipboard denied'))
    render(<StoreBadges surface="landing_door" payload={payload} />)
    await act(async () => {
        fireEvent.click(screen.getByRole('link', { name: 'App Store' }))
    })
    expect(trackDeferredHandoffCreated).not.toHaveBeenCalled()
})

it('does not count bare store links as deferred handoffs', () => {
    render(<StoreBadges surface="landing_hero" />)
    fireEvent.click(screen.getByRole('link', { name: 'Google Play' }))
    fireEvent.click(screen.getByRole('link', { name: 'App Store' }))
    expect(trackDeferredHandoffCreated).not.toHaveBeenCalled()
    expect(copyIOSHandoff).not.toHaveBeenCalled()
})
