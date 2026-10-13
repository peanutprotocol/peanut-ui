/**
 * The setup drawer after a document-first identity check: the document list's
 * feature names, one badge per state, and a button that leaves until every
 * feature is available, then continues. Ported from #3581.
 */
/** @jest-environment jsdom */
import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import type { SetupRow } from '@/utils/kyc-setup-status.utils'
import { KycSetupStatusDrawer } from '../KycSetupStatusDrawer'

const push = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

const renderDrawer = (rows: SetupRow[], residence: string | null = 'BR') => {
    const onClose = jest.fn()
    const onContinue = jest.fn()
    render(
        <IntlWrapper>
            <KycSetupStatusDrawer open residence={residence} rows={rows} onClose={onClose} onContinue={onContinue} />
        </IntlWrapper>
    )
    return { onClose, onContinue }
}
const row = (key: string) => within(screen.getByTestId(`setup-row-${key}`))

describe('KycSetupStatusDrawer', () => {
    beforeEach(() => push.mockClear())

    it('names every saved feature as the document list does, with the badge of its state', () => {
        renderDrawer([
            { key: 'qr', state: 'available' },
            { key: 'local', state: 'under-review' },
            { key: 'bank', state: 'setting-up' },
            { key: 'card', state: 'setting-up' },
        ])
        expect(row('qr').getByText('QR payments')).toBeInTheDocument()
        expect(row('qr').getByText('Available')).toBeInTheDocument()
        expect(row('local').getByText('Local bank transfers')).toBeInTheDocument()
        expect(row('local').getByText('Under review')).toBeInTheDocument()
        expect(row('bank').getByText('USD, EUR, MXN and GBP accounts')).toBeInTheDocument()
        expect(row('bank').getByText('Setting up')).toBeInTheDocument()
        expect(row('card').getByText('Peanut card')).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'Setting up' })).toBeInTheDocument()
    })

    it('while a feature is not available yet, the button leaves for Home', () => {
        const { onClose, onContinue } = renderDrawer([
            { key: 'qr', state: 'available' },
            { key: 'card', state: 'setting-up' },
        ])
        fireEvent.click(screen.getByRole('button', { name: 'Go to Home' }))
        expect(onClose).toHaveBeenCalledTimes(1)
        expect(push).toHaveBeenCalledWith('/home')
        expect(onContinue).not.toHaveBeenCalled()
    })

    it('once every feature is available it reads all set and continues', () => {
        const { onClose, onContinue } = renderDrawer([
            { key: 'qr', state: 'available' },
            { key: 'card', state: 'available' },
        ])
        expect(screen.getByRole('heading', { name: 'All set' })).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
        expect(onContinue).toHaveBeenCalledTimes(1)
        expect(onClose).not.toHaveBeenCalled()
        expect(push).not.toHaveBeenCalled()
    })
})
