// A pot contribution paid short of its own charge (TASK-23856): the row shows
// what arrived and nothing about what the charge asked. That figure is the
// payer's, and the requester's receipt labelled a $33 contribution with it.
import React from 'react'
import { screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { RequestPotContributorRows } from '../provider-rows/RequestPotContributorRows'
import type { ReceiptViewModel } from '../useReceiptViewModel'

jest.mock('@/components/Avatar/UserAvatar', () => ({ UserAvatar: () => null }))
jest.mock('@/components/Profile/AvatarWithBadge', () => ({ __esModule: true, default: () => null }))

type Row = ReceiptViewModel['requestPotContributors'][number]

const row = (overrides: Partial<Row>): Row =>
    ({
        uuid: 'charge-1',
        payments: [],
        amount: '40.65',
        username: 'hugo',
        fulfillmentPayment: null,
        isUserVerified: true,
        isPeanutUser: true,
        avatarKey: null,
        ...overrides,
    }) as Row

const render = (rows: Row[]) =>
    renderWithIntl(<RequestPotContributorRows vm={{ requestPotContributors: rows } as unknown as ReceiptViewModel} />)

describe('RequestPotContributorRows', () => {
    it('shows what each contributor paid and nothing about what their charge asked', () => {
        render([row({}), row({ uuid: 'charge-2', username: '0xpayer', amount: '33' })])

        expect(screen.getByText('Contributors (2)')).toBeInTheDocument()
        expect(screen.getByText('$40.65')).toBeInTheDocument()
        expect(screen.getByText('$33')).toBeInTheDocument()
        expect(screen.queryByText(/58\.51/)).toBeNull()
        expect(screen.queryByText(/paid/i)).toBeNull()
    })
})
