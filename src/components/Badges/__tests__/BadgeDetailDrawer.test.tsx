import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import type { ReactNode } from 'react'
import { BadgeDetailDrawer } from '../BadgeDetailDrawer'
import en from '@/i18n/app/messages/en.json'
import ptBR from '@/i18n/app/messages/pt-BR.json'

type MockShareButtonProps = {
    children?: ReactNode
    generateText: () => Promise<string>
    onSuccess?: () => void
}

const mockShareButton = jest.fn<void, [MockShareButtonProps]>()

jest.mock('@/components/Global/ShareButton', () => ({
    __esModule: true,
    default: (props: MockShareButtonProps) => {
        mockShareButton(props)
        return (
            <button type="button" onClick={props.onSuccess}>
                {props.children}
            </button>
        )
    },
}))

jest.mock('@/components/Global/ActionModal', () => ({
    __esModule: true,
    default: ({ visible, content }: { visible: boolean; content?: ReactNode }) =>
        visible ? <div>{content}</div> : null,
}))

jest.mock('next/image', () => ({
    __esModule: true,
    default: () => null,
}))

jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { user: { username: 'satoshi' } } }),
}))

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

const onClose = jest.fn()

function renderModal(locale: 'en' | 'pt-BR') {
    const messages = locale === 'en' ? en : ptBR

    return render(
        <NextIntlClientProvider locale={locale} messages={messages}>
            <BadgeDetailDrawer
                isOpen
                onClose={onClose}
                code="CARD_FIRST_SWIPE"
                title="First Swipe"
                description="First swipe badge"
                logo="/badges/happy_card.svg"
            />
        </NextIntlClientProvider>
    )
}

function renderLockedModal(code = 'FIRST_INVITE') {
    return render(
        <NextIntlClientProvider locale="en" messages={en}>
            <BadgeDetailDrawer
                isOpen
                onClose={onClose}
                code={code}
                title="First Invite"
                description="Invite a friend"
                logo="/badges/first_invite.svg"
                earned={false}
                unlockText="Invite one friend who joins Peanut."
            />
        </NextIntlClientProvider>
    )
}

beforeEach(() => {
    jest.clearAllMocks()
})

describe('BadgeDetailDrawer', () => {
    it('shares bespoke English copy with the signed-in user profile and closes on success', async () => {
        renderModal('en')

        expect(screen.getByRole('button', { name: en.badges.shareAchievement })).toBeInTheDocument()
        const shareProps = mockShareButton.mock.calls[0][0]
        await expect(shareProps.generateText()).resolves.toContain('Just put my Peanut card to work')
        // attributed share link, asserted origin-agnostically: shareableUrl resolves
        // to the jsdom origin here, not NEXT_PUBLIC_BASE_URL.
        await expect(shareProps.generateText()).resolves.toContain('/invite?code=satoshi')

        screen.getByRole('button', { name: en.badges.shareAchievement }).click()
        expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('lists the avatars an earned badge unlocks', () => {
        renderModal('en')

        expect(screen.getByText(en.badges.whatYouGet)).toBeInTheDocument()
        expect(screen.getByText('3 profile avatars')).toBeInTheDocument()
    })

    it('lists the avatars a locked badge would unlock above how to unlock it', () => {
        renderLockedModal('CARD_SPENT_1K')

        const whatYouGet = screen.getByText(en.badges.whatYouGet)
        expect(screen.getByText('3 profile avatars')).toBeInTheDocument()
        expect(
            whatYouGet.compareDocumentPosition(screen.getByText(en.badges.howToUnlock)) &
                Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy()
    })

    it('keeps the translated generic share copy outside English', async () => {
        renderModal('pt-BR')

        expect(screen.getByRole('button', { name: ptBR.badges.shareAchievement })).toBeInTheDocument()
        const text = await mockShareButton.mock.calls[0][0].generateText()
        expect(text).toContain('Ganhei o selo First Swipe no Peanut!')
        expect(text).toContain('/invite?code=satoshi')
        expect(text).not.toContain('Just put my Peanut card to work')
        expect(screen.getByText('3 avatares de perfil')).toBeInTheDocument()
    })

    it('shows the unlock requirement instead of sharing for a locked badge', () => {
        renderLockedModal()

        expect(screen.getByText(en.badges.howToUnlock)).toBeInTheDocument()
        expect(screen.getByText('Invite one friend who joins Peanut.')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: en.badges.shareAchievement })).not.toBeInTheDocument()
        expect(mockShareButton).not.toHaveBeenCalled()
    })

    it('hides the benefit box for a badge with no avatar art', () => {
        renderLockedModal()

        expect(screen.queryByText(en.badges.whatYouGet)).not.toBeInTheDocument()
    })
})
