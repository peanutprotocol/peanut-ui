// A pot contribution paid short of its own charge (TASK-23856): the row shows
// what arrived, marked partly paid, with what the charge asked under it.
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
        askedAmount: '40.65',
        isPartial: false,
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
    it('marks a short contribution with the amount it paid and the amount it asked', () => {
        render([
            row({}),
            row({ uuid: 'charge-2', username: '0xpayer', amount: '33', askedAmount: '58.51', isPartial: true }),
        ])

        expect(screen.getByText('$40.65')).toBeInTheDocument()
        expect(screen.getByText('$33.00')).toBeInTheDocument()
        expect(screen.getByText('Partly paid')).toBeInTheDocument()
        expect(screen.getByText('of $58.51')).toBeInTheDocument()
        expect(screen.queryByText('$58.51')).toBeNull()
    })

    it('shows no badge on a contribution paid in full', () => {
        render([row({})])
        expect(screen.queryByText('Partly paid')).toBeNull()
    })
})
