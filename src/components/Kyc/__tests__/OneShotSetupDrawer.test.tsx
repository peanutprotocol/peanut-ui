/**
 * The setup drawer after a one-shot SDK session (TASK-23329, item 9a): the
 * checklist's row names, one badge per state, and a button that leaves until
 * every feature is available, then continues.
 */
/** @jest-environment jsdom */
import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import type { SetupRow } from '@/utils/one-shot-setup.utils'
import { OneShotSetupDrawer } from '../OneShotSetupDrawer'

const push = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

const renderDrawer = (rows: SetupRow[], residence = 'BR') => {
    const onClose = jest.fn()
    const onContinue = jest.fn()
    render(
        <IntlWrapper>
            <OneShotSetupDrawer open residence={residence} rows={rows} onClose={onClose} onContinue={onContinue} />
        </IntlWrapper>
    )
    return { onClose, onContinue }
}

describe('OneShotSetupDrawer', () => {
    beforeEach(() => push.mockClear())

    it('names every ticked feature as the checklist did, with the badge of its state', () => {
        renderDrawer([
            { key: 'qr', state: 'available' },
            { key: 'local', state: 'under-review' },
            { key: 'card', state: 'setting-up' },
            { key: 'bank', state: 'setting-up' },
        ])
        const row = (key: string) => within(screen.getByTestId(`setup-row-${key}`))
        expect(row('qr').getByText('QR payments')).toBeInTheDocument()
        expect(row('qr').getByText('Available')).toBeInTheDocument()
        expect(row('local').getByText('BRL bank transfers')).toBeInTheDocument()
        expect(row('local').getByText('Under review')).toBeInTheDocument()
        expect(row('card').getByText('Peanut Card')).toBeInTheDocument()
        expect(row('card').getByText('Setting up')).toBeInTheDocument()
        expect(row('bank').getByText('USD and EUR accounts')).toBeInTheDocument()
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

    it('names local bank transfers for the residence', () => {
        renderDrawer([{ key: 'local', state: 'setting-up' }], 'AR')
        expect(screen.getByText('ARS bank transfers')).toBeInTheDocument()
    })
})
