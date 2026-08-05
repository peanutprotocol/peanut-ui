import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import type { ReactNode } from 'react'
import { BadgeDetailModal } from '../BadgeDetailModal'
import { BASE_URL } from '@/constants/general.consts'
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

jest.mock('@/redux/hooks', () => ({
    useUserStore: () => ({ user: { user: { username: 'satoshi' } } }),
}))

const onClose = jest.fn()

function renderModal(locale: 'en' | 'pt-BR') {
    const messages = locale === 'en' ? en : ptBR

    return render(
        <NextIntlClientProvider locale={locale} messages={messages}>
            <BadgeDetailModal
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

beforeEach(() => {
    jest.clearAllMocks()
})

describe('BadgeDetailModal', () => {
    it('shares bespoke English copy with the signed-in user profile and closes on success', async () => {
        renderModal('en')

        expect(screen.getByRole('button', { name: en.badges.shareAchievement })).toBeInTheDocument()
        const shareProps = mockShareButton.mock.calls[0][0]
        await expect(shareProps.generateText()).resolves.toContain('Just put my Peanut card to work')
        await expect(shareProps.generateText()).resolves.toContain(`${BASE_URL}/satoshi`)

        screen.getByRole('button', { name: en.badges.shareAchievement }).click()
        expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('keeps the translated generic share copy outside English', async () => {
        renderModal('pt-BR')

        expect(screen.getByRole('button', { name: ptBR.badges.shareAchievement })).toBeInTheDocument()
        const text = await mockShareButton.mock.calls[0][0].generateText()
        expect(text).toContain('Ganhei o selo First Swipe no Peanut!')
        expect(text).toContain(`${BASE_URL}/satoshi`)
        expect(text).not.toContain('Just put my Peanut card to work')
    })
})
