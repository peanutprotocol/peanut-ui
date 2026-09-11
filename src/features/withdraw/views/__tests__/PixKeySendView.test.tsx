import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import es419 from '@/i18n/app/messages/es-419.json'
import ptBR from '@/i18n/app/messages/pt-BR.json'
import PixKeySendView from '../PixKeySendView'

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn() }),
}))

jest.mock('@/hooks/useSafeBack', () => ({
    useSafeBack: () => jest.fn(),
}))

jest.mock('@/components/0_Bruddle/PageStack', () => {
    const PageStack = Object.assign(
        function MockPageStack({ children }: { children: React.ReactNode }) {
            return <div>{children}</div>
        },
        {
            Center: function MockPageStackCenter({ children }: { children: React.ReactNode }) {
                return <div>{children}</div>
            },
        }
    )
    return { PageStack }
})

jest.mock('@/components/0_Bruddle/Button', () => ({
    Button: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
}))

jest.mock('@/components/0_Bruddle/FieldError', () => ({
    FieldError: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

jest.mock('@/components/Global/NavHeader', () => ({
    __esModule: true,
    default: () => null,
}))

jest.mock('@/components/Global/ValidatedInput', () => ({
    __esModule: true,
    default: ({ validate }: { validate: (value: string) => Promise<boolean> }) => (
        <button type="button" onClick={() => validate('+5511')}>
            Validate phone
        </button>
    ),
}))

describe('PixKeySendView', () => {
    it.each([
        { locale: 'pt-BR', messages: ptBR, expected: 'Chave Pix inválida' },
        { locale: 'es-419', messages: es419, expected: 'Clave Pix inválida' },
    ] as const)('uses the selected $locale language for validation errors', async ({ locale, messages, expected }) => {
        render(
            <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
                <PixKeySendView />
            </NextIntlClientProvider>
        )

        fireEvent.click(screen.getByRole('button', { name: 'Validate phone' }))

        expect(await screen.findByText(expected)).toBeInTheDocument()
        expect(screen.queryByText('Invalid phone number format')).not.toBeInTheDocument()
    })
})
