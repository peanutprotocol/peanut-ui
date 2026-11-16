/** @jest-environment jsdom */
import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import en from '@/i18n/app/messages/en.json'
import type { PixKeyLookup } from '../usePixKeyLookup'

jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
let mockResult: PixKeyLookup | null = null
jest.mock('@/features/pix/usePixKeyLookup', () => ({
    usePixKeyLookup: () => ({ lookup: jest.fn(), result: mockResult }),
}))

import { PixKeyStep } from '../components/PixKeyStep'

const KEY = '11144477735'
const info = {
    provider: 'avenia',
    holderName: 'Ana Souza',
    holderTaxIdMasked: '111.***.***-35',
    bankName: 'Banco Inter',
    ispb: '00416968',
    ownAccount: true,
    blocked: false,
}
const continueButton = () => screen.getByRole('button', { name: en.common.continue })

describe('PixKeyStep holder card', () => {
    it("names the user's own account at a deny-listed bank as their own, with the bank refusal", () => {
        mockResult = { key: KEY, status: 'found', info: { ...info, blocked: true } }
        renderWithIntl(<PixKeyStep title="Withdraw" initialKey={KEY} onBack={jest.fn()} onContinue={jest.fn()} />)

        expect(screen.getByText(en.pix.withdraw.ownAccount)).toBeInTheDocument()
        expect(screen.getByText(en.pix.withdraw.keyBlocked)).toBeInTheDocument()
        expect(continueButton()).toBeDisabled()
    })

    // TASK-24947: any key continues; the card says whom the money goes to
    it("continues with another person's key, named with their bank and masked tax id, and no badge", () => {
        mockResult = { key: KEY, status: 'found', info: { ...info, ownAccount: false } }
        const onContinue = jest.fn()
        renderWithIntl(<PixKeyStep title="Send" initialKey={KEY} onBack={jest.fn()} onContinue={onContinue} />)

        const holder = screen.getByTestId('pix-key-holder')
        expect(holder).toHaveTextContent('Ana Souza')
        expect(holder).toHaveTextContent('Banco Inter · CPF 111.***.***-35')
        expect(screen.queryByText(en.pix.withdraw.ownAccount)).toBeNull()
        expect(screen.queryByRole('alert')).toBeNull()

        fireEvent.click(continueButton())
        expect(onContinue).toHaveBeenCalledWith(KEY, { ...info, ownAccount: false })
    })

    it('continues with a key whose holder the provider cannot tell, with no badge', () => {
        mockResult = { key: KEY, status: 'found', info: { ...info, ownAccount: null } }
        renderWithIntl(<PixKeyStep title="Send" initialKey={KEY} onBack={jest.fn()} onContinue={jest.fn()} />)

        expect(screen.queryByText(en.pix.withdraw.ownAccount)).toBeNull()
        expect(continueButton()).toBeEnabled()
    })
})

// Aleks 2026-11-16: the holder card is what the user looks at once the key resolves, so tapping it continues
describe('PixKeyStep holder card tap', () => {
    // the same step serves every provider the withdraw route names: Avenia and Manteca
    it.each(['avenia', 'manteca'])('continues like Continue when tapped, for %s', (provider) => {
        mockResult = { key: KEY, status: 'found', info: { ...info, provider, ownAccount: false } }
        const onContinue = jest.fn()
        renderWithIntl(<PixKeyStep title="Send" initialKey={KEY} onBack={jest.fn()} onContinue={onContinue} />)

        const holder = screen.getByRole('button', { name: `${en.common.continue}, Ana Souza` })
        expect(holder).toBe(screen.getByTestId('pix-key-holder'))
        fireEvent.click(holder)
        fireEvent.click(continueButton())

        expect(onContinue).toHaveBeenCalledTimes(2)
        expect(onContinue.mock.calls[0]).toEqual([KEY, { ...info, provider, ownAccount: false }])
        expect(onContinue.mock.calls[0]).toEqual(onContinue.mock.calls[1])
    })

    it('continues from the keyboard', () => {
        mockResult = { key: KEY, status: 'found', info }
        const onContinue = jest.fn()
        renderWithIntl(<PixKeyStep title="Withdraw" initialKey={KEY} onBack={jest.fn()} onContinue={onContinue} />)

        fireEvent.keyDown(screen.getByTestId('pix-key-holder'), { key: 'Enter' })
        expect(onContinue).toHaveBeenCalledWith(KEY, info)
    })

    it('names a holder the provider cannot show with the card title', () => {
        mockResult = { key: KEY, status: 'found', info: { ...info, holderName: null } }
        renderWithIntl(<PixKeyStep title="Send" initialKey={KEY} onBack={jest.fn()} onContinue={jest.fn()} />)

        expect(screen.getByRole('button', { name: `${en.common.continue}, ${en.pix.withdraw.unknownHolder}` })).toBe(
            screen.getByTestId('pix-key-holder')
        )
    })

    it('is not a button while Continue is disabled (a bank the provider does not pay)', () => {
        mockResult = { key: KEY, status: 'found', info: { ...info, blocked: true } }
        const onContinue = jest.fn()
        renderWithIntl(<PixKeyStep title="Withdraw" initialKey={KEY} onBack={jest.fn()} onContinue={onContinue} />)

        const holder = screen.getByTestId('pix-key-holder')
        expect(continueButton()).toBeDisabled()
        expect(holder).not.toHaveAttribute('role')
        expect(holder).not.toHaveAttribute('tabindex')
        expect(holder).not.toHaveAttribute('aria-label')

        fireEvent.click(holder)
        fireEvent.keyDown(holder, { key: 'Enter' })
        expect(onContinue).not.toHaveBeenCalled()
    })
})
