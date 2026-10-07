import { StrictMode } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import EarlyUserDrawer from '..'
import Modal from '@/components/Global/Modal'
import { Drawer, DrawerContent, DrawerTitle } from '@/components/Global/Drawer'
import en from '@/i18n/app/messages/en.json'
import { loadMessages } from '@/i18n/app/messages'
import { APP_LOCALES } from '@/i18n/app/config'
import { updateUserById } from '@/app/actions/users'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS, MODAL_TYPES } from '@/constants/analytics.consts'

let mockUser: any
let mockModals: any
const mockFetchUser = jest.fn()
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: mockUser, fetchUser: mockFetchUser }) }))
jest.mock('@/context/ModalsContext', () => ({ useModalsContextOptional: () => mockModals }))
jest.mock('@/app/actions/users', () => ({ updateUserById: jest.fn().mockResolvedValue({}) }))
jest.mock('@/utils/general.utils', () => ({
    generateInviteCodeLink: () => ({ inviteLink: 'https://peanut.me/invite?code=TEST' }),
}))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/components/0_Bruddle/IconBubble', () => ({ IconBubble: () => null }))
jest.mock('@/components/Global/Icons/Icon', () => ({ Icon: () => null }))
jest.mock('@/components/Global/ShareButton', () => ({
    __esModule: true,
    default: ({ children }: any) => <button>{children}</button>,
}))
jest.mock('@/components/Global/DocsLink', () => ({
    __esModule: true,
    default: ({ children }: any) => <span>{children}</span>,
}))

const title = en.global.earlyUserModal.title
const clearGate = () => ({ status: 'clear', userId: mockUser.user.userId })
const Harness = ({
    modal = false,
    drawer = false,
    announcementFirst = false,
}: {
    modal?: boolean
    drawer?: boolean
    announcementFirst?: boolean
}) => (
    <StrictMode>
        <NextIntlClientProvider locale="en" messages={en}>
            {announcementFirst && <EarlyUserDrawer />}
            <Modal visible={modal} onClose={() => {}} title="Terms notice">
                <p>Terms body</p>
            </Modal>
            <Drawer open={drawer}>
                <DrawerContent>
                    <DrawerTitle>Another drawer</DrawerTitle>
                </DrawerContent>
            </Drawer>
            {!announcementFirst && <EarlyUserDrawer />}
        </NextIntlClientProvider>
    </StrictMode>
)

beforeAll(() => {
    Element.prototype.getAnimations = () => []
})

beforeEach(() => {
    jest.clearAllMocks()
    mockUser = { user: { userId: 'alice', username: 'alice' }, showEarlyUserModal: true }
    mockModals = { legalConsentGate: clearGate() }
})

it('opens when clear and does not count itself as another drawer', async () => {
    render(<Harness />)
    expect(await screen.findByRole('dialog', { name: title })).toBeInTheDocument()
    expect(screen.getByText(en.global.earlyUserModal.description)).toBeInTheDocument()
    expect(screen.queryByText(/cut of their/)).not.toBeInTheDocument()
    expect(updateUserById).not.toHaveBeenCalled()
})

it.each([false, true])('waits for another modal regardless of mount order (first=%s)', async (announcementFirst) => {
    const view = render(<Harness modal announcementFirst={announcementFirst} />)
    expect(screen.queryByText(title)).not.toBeInTheDocument()
    expect(updateUserById).not.toHaveBeenCalled()
    view.rerender(<Harness announcementFirst={announcementFirst} />)
    expect(await screen.findByRole('dialog', { name: title })).toBeInTheDocument()
})

it('waits until both a modal and a drawer close, then yields and resumes without acknowledging', async () => {
    const view = render(<Harness modal drawer />)
    expect(screen.queryByText(title)).not.toBeInTheDocument()
    view.rerender(<Harness drawer />)
    expect(screen.queryByText(title)).not.toBeInTheDocument()
    view.rerender(<Harness />)
    expect(await screen.findByRole('dialog', { name: title })).toBeInTheDocument()
    view.rerender(<Harness drawer />)
    await waitFor(() => expect(screen.queryByText(title)).not.toBeInTheDocument())
    expect(updateUserById).not.toHaveBeenCalled()
    expect(posthog.capture).not.toHaveBeenCalledWith(ANALYTICS_EVENTS.MODAL_DISMISSED, {
        modal_type: MODAL_TYPES.EARLY_USER,
    })
    view.rerender(<Harness />)
    expect(await screen.findByRole('dialog', { name: title })).toBeInTheDocument()
})

it('waits for the legal status request and the current account to resolve', async () => {
    mockModals.legalConsentGate = { status: 'checking', userId: 'alice' }
    const view = render(<Harness />)
    expect(screen.queryByText(title)).not.toBeInTheDocument()
    mockModals.legalConsentGate = { status: 'prompting', userId: 'alice' }
    view.rerender(<Harness />)
    expect(screen.queryByText(title)).not.toBeInTheDocument()
    mockModals.legalConsentGate = { status: 'clear', userId: 'previous-account' }
    view.rerender(<Harness />)
    expect(screen.queryByText(title)).not.toBeInTheDocument()
    mockModals.legalConsentGate = clearGate()
    view.rerender(<Harness />)
    expect(await screen.findByRole('dialog', { name: title })).toBeInTheDocument()
})

it.each([
    'isSupportModalOpen',
    'isGetAppModalOpen',
    'isSignInModalOpen',
    'isQRScannerOpen',
    'isSecurityVerificationOpen',
])('waits for globally requested overlays before their lazy content mounts (%s)', async (flag) => {
    mockModals[flag] = true
    const view = render(<Harness />)
    expect(screen.queryByText(title)).not.toBeInTheDocument()
    mockModals[flag] = false
    view.rerender(<Harness />)
    expect(await screen.findByRole('dialog', { name: title })).toBeInTheDocument()
})

it('only saves seen on actual dismissal and stays closed across stale user refreshes', async () => {
    const view = render(<Harness />)
    await screen.findByRole('dialog', { name: title })
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' })
    await waitFor(() => expect(updateUserById).toHaveBeenCalledWith({ userId: 'alice', hasSeenEarlyUserModal: true }))
    expect(mockFetchUser).toHaveBeenCalledTimes(1)
    mockUser = { ...mockUser }
    view.rerender(<Harness />)
    expect(screen.getByText(title).closest('[role="dialog"]')).toHaveAttribute('data-state', 'closed')
    mockUser = { user: { userId: 'bob', username: 'bob' }, showEarlyUserModal: true }
    mockModals.legalConsentGate = clearGate()
    view.rerender(<Harness />)
    expect(await screen.findByRole('dialog', { name: title })).toBeInTheDocument()
})

it('does not open for ineligible or logged-out users', () => {
    mockUser.showEarlyUserModal = false
    const view = render(<Harness />)
    expect(screen.queryByText(title)).not.toBeInTheDocument()
    mockUser = null
    view.rerender(<Harness />)
    expect(screen.queryByText(title)).not.toBeInTheDocument()
})

it.each(APP_LOCALES)('renders the translated replacement body in %s through the real locale loader', async (locale) => {
    const messages = await loadMessages(locale)
    await act(async () => {
        render(
            <NextIntlClientProvider locale={locale} messages={messages}>
                <EarlyUserDrawer />
            </NextIntlClientProvider>
        )
    })
    expect(screen.getByText(messages.global.earlyUserModal.description)).toBeInTheDocument()
    expect(messages.global.earlyUserModal.description).not.toContain('referral rewards.')
    if (locale !== 'en')
        expect(messages.global.earlyUserModal.description).not.toBe(en.global.earlyUserModal.description)
})
