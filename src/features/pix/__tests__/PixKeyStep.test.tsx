/** @jest-environment jsdom */
import { screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import en from '@/i18n/app/messages/en.json'
import type { PixKeyLookup } from '../usePixKeyLookup'

jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
let mockResult: PixKeyLookup | null = null
jest.mock('@/features/pix/usePixKeyLookup', () => ({
    usePixKeyLookup: () => ({ lookup: jest.fn(), result: mockResult }),
}))

import { PixKeyStep } from '../components/PixKeyStep'

const KEY = '09579927189'
const info = {
    provider: 'avenia',
    holderName: 'Ana Souza',
    holderTaxIdMasked: '095.***.***-89',
    bankName: 'Banco Inter',
    ispb: '00416968',
    ownAccount: true,
    blocked: false,
}

describe('PixKeyStep holder badge', () => {
    it("names the user's own account at a deny-listed bank as their own, with the bank refusal", () => {
        mockResult = { key: KEY, status: 'found', info: { ...info, blocked: true }, verdict: 'blocked' }
        renderWithIntl(<PixKeyStep title="Withdraw" initialKey={KEY} onBack={jest.fn()} onContinue={jest.fn()} />)

        expect(screen.getByText(en.pix.withdraw.ownAccount)).toBeInTheDocument()
        expect(screen.queryByText(en.pix.withdraw.someoneElses)).toBeNull()
        expect(screen.getByText(en.pix.withdraw.keyBlocked)).toBeInTheDocument()
    })

    it("names someone else's account as such", () => {
        mockResult = { key: KEY, status: 'found', info: { ...info, ownAccount: false }, verdict: 'not-own' }
        renderWithIntl(<PixKeyStep title="Withdraw" initialKey={KEY} onBack={jest.fn()} onContinue={jest.fn()} />)

        expect(screen.getByText(en.pix.withdraw.someoneElses)).toBeInTheDocument()
    })
})
