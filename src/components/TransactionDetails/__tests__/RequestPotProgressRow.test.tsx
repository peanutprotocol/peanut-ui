// What the request progress row says is left to pay (TASK-23729).
import React from 'react'
import { screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { RequestPotProgressRow } from '../provider-rows/RequestPotProgressRow'
import type { TransactionDetails } from '../transactionTransformer'

const request = (status: string, amount: number, totalAmountCollected: number) =>
    ({ isRequestPotLink: true, status, amount, totalAmountCollected }) as unknown as TransactionDetails

describe('RequestPotProgressRow', () => {
    it('shows nothing left on a settled request that closed short in USD', () => {
        // €5 asked = $5.64; the bank deposit delivered 5.57 USDC and settled it
        const { container } = renderWithIntl(<RequestPotProgressRow transaction={request('completed', 5.64, 5.57)} />)
        expect(screen.getByText('$5.57 contributed')).toBeInTheDocument()
        expect(screen.getByText('$0.00 remaining')).toBeInTheDocument()
        const bar = container.querySelector('progress')
        expect(bar?.value).toBe(bar?.max)
    })

    it('shows the gap on a request still waiting for payment', () => {
        renderWithIntl(<RequestPotProgressRow transaction={request('pending', 10, 4)} />)
        expect(screen.getByText('$4.00 contributed')).toBeInTheDocument()
        expect(screen.getByText('$6.00 remaining')).toBeInTheDocument()
    })

    // TASK-23856: closed with $73.65 of $99.16 — nobody can pay the rest
    it('calls the gap of a request closed short "not paid", not "remaining"', () => {
        renderWithIntl(<RequestPotProgressRow transaction={request('closed', 99.16, 73.65)} />)
        expect(screen.getByText('$73.65 contributed')).toBeInTheDocument()
        expect(screen.getByText('$25.51 not paid')).toBeInTheDocument()
        expect(screen.queryByText(/remaining/)).toBeNull()
    })
})
