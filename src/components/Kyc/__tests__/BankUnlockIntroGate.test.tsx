import React from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { renderWithIntl } from '@/test-utils/intl'
import { BankUnlockIntroGate } from '../BankUnlockIntroGate'
import { InitiateKycModal } from '../InitiateKycModal'
import AccountsPage from '@/app/(mobile-ui)/profile/accounts/page'
import en from '@/i18n/app/messages/en.json'
import { loadMessages } from '@/i18n/app/messages'

let mockUserId = 'bank-intro-user'
let mockStatus = 'not_started'
let mockBankRestricted = false
let mockDegraded = false
const mockPush = jest.fn()
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: { user: { userId: mockUserId } } }) }))
jest.mock('@/hooks/useIdentityVerification', () => ({
    useIdentityVerification: () => ({ status: mockStatus, isLoading: false, isRegionRestricted: false }),
}))
jest.mock('@/hooks/useResidenceRestrictions', () => ({
    useResidenceRestrictions: () => ({ banking: mockBankRestricted, card: false }),
}))
jest.mock('@/hooks/useKycDegraded', () => ({ useKycDegraded: () => mockDegraded }))
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush }),
    usePathname: () => '/profile/accounts',
}))
jest.mock('@/components/Profile/views/MoneySettings.view', () => ({
    __esModule: true,
    default: () => <div>account-choices</div>,
}))
// Keep the real dialog, persistence, and entry points; animation is independent.
jest.mock('@/components/Setup/components/SetupWrapper', () => ({
    SetupWrapper: ({ title, description, onBack, children, image, showProgress }: any) => (
        <div data-animation={image.animation} data-progress={String(showProgress)}>
            <h1>{title}</h1>
            <p>{description}</p>
            <button onClick={onBack}>Back</button>
            {children}
        </div>
    ),
}))

const title = en.setup.steps['advantage-bank'].title
const introHeading = () => screen.queryByRole('heading', { level: 1, name: title })
const gate = (props: Partial<React.ComponentProps<typeof BankUnlockIntroGate>> = {}) => (
    <BankUnlockIntroGate visible onClose={jest.fn()} {...props}>
        <div>next-step</div>
    </BankUnlockIntroGate>
)

beforeEach(() => {
    localStorage.clear()
    mockUserId = 'bank-intro-user'
    mockStatus = 'not_started'
    mockBankRestricted = false
    mockDegraded = false
    mockPush.mockClear()
})

it('shows the retired banking screen from the Accounts menu and continues to account choices', async () => {
    renderWithIntl(<AccountsPage />)
    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeInTheDocument()
    expect(screen.queryByText('account-choices')).not.toBeInTheDocument()
    expect(screen.getByText(en.setup.steps['advantage-bank'].description)).toBeInTheDocument()
    expect(introHeading()?.parentElement).toHaveAttribute('data-animation', 'bank')
    expect(introHeading()?.parentElement).toHaveAttribute('data-progress', 'false')
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(screen.getByText('account-choices')).toBeInTheDocument()
})

it('Home continues to the existing prep checklist and starts verification only on its own CTA', async () => {
    const onVerify = jest.fn()
    renderWithIntl(<InitiateKycModal showBankIntro visible onClose={jest.fn()} onVerify={onVerify} />)
    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(onVerify).not.toHaveBeenCalled()
    fireEvent.click(await screen.findByRole('button', { name: 'Verify identity' }))
    expect(onVerify).toHaveBeenCalledTimes(1)
})

it('remembers Home completion on a later menu visit, including after remounting', async () => {
    const home = renderWithIntl(<InitiateKycModal showBankIntro visible onClose={jest.fn()} onVerify={jest.fn()} />)
    await screen.findByRole('heading', { level: 1, name: title })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    home.unmount()
    renderWithIntl(<AccountsPage />)
    expect(await screen.findByText('account-choices')).toBeInTheDocument()
    expect(introHeading()).not.toBeInTheDocument()
})

it('remembers menu completion when Home opens later', async () => {
    const menu = renderWithIntl(<AccountsPage />)
    await screen.findByRole('heading', { level: 1, name: title })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    menu.unmount()
    renderWithIntl(<InitiateKycModal showBankIntro visible onClose={jest.fn()} onVerify={jest.fn()} />)
    expect(await screen.findByRole('button', { name: 'Verify identity' })).toBeInTheDocument()
    expect(introHeading()).not.toBeInTheDocument()
})

it('Back returns to the menu and records that the introduction was seen', async () => {
    const menu = renderWithIntl(<AccountsPage />)
    await screen.findByRole('heading', { level: 1, name: title })
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(mockPush).toHaveBeenCalledWith('/profile')
    menu.unmount()
    renderWithIntl(gate())
    expect(await screen.findByText('next-step')).toBeInTheDocument()
})

it('keeps the stored choice scoped to the current account', async () => {
    const view = renderWithIntl(gate())
    await screen.findByRole('heading', { level: 1, name: title })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    mockUserId = 'another-bank-intro-user'
    view.rerender(gate())
    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeInTheDocument()
})

it.each(['processing', 'verified', 'action_required', 'failed'])(
    'preserves existing status/recovery content for %s verification',
    async (status) => {
        mockStatus = status
        renderWithIntl(gate())
        expect(await screen.findByText('next-step')).toBeInTheDocument()
        expect(introHeading()).not.toBeInTheDocument()
    }
)

it.each(['restricted', 'outage', 'closed'])(
    'does not consume the first introduction while the unlock is %s',
    async (state) => {
        mockBankRestricted = state === 'restricted'
        mockDegraded = state === 'outage'
        const view = renderWithIntl(gate({ visible: state !== 'closed' }))
        expect(screen.getByText('next-step')).toBeInTheDocument()
        mockBankRestricted = false
        mockDegraded = false
        view.rerender(gate())
        expect(await screen.findByRole('heading', { level: 1, name: title })).toBeInTheDocument()
    }
)

it('can continue and remembers the introduction in-session when device storage is unavailable', async () => {
    mockUserId = 'storage-unavailable-user'
    const read = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('unavailable')
    })
    const write = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('unavailable')
    })
    try {
        const first = renderWithIntl(gate())
        await screen.findByRole('heading', { level: 1, name: title })
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
        expect(screen.getByText('next-step')).toBeInTheDocument()
        first.unmount()
        renderWithIntl(gate())
        expect(await screen.findByText('next-step')).toBeInTheDocument()
        expect(introHeading()).not.toBeInTheDocument()
    } finally {
        read.mockRestore()
        write.mockRestore()
    }
})

it.each(['en', 'es-419', 'es-AR', 'pt-BR'] as const)(
    'reuses the existing bank introduction and Continue translation for %s',
    async (locale) => {
        const messages = await loadMessages(locale)
        renderWithIntl(
            <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
                {gate()}
            </NextIntlClientProvider>
        )
        await waitFor(() =>
            expect(
                screen.getByRole('heading', {
                    level: 1,
                    name: messages.setup.steps['advantage-bank'].title,
                })
            ).toBeInTheDocument()
        )
        expect(screen.getByText(messages.setup.steps['advantage-bank'].description)).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: messages.common.continue }))
        expect(screen.getByText('next-step')).toBeInTheDocument()
    }
)
