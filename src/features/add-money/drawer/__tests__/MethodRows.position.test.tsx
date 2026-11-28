import { render, screen } from '@testing-library/react'
import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { BankMethodRow } from '../BankMethodRow'
import { CryptoMethodRow } from '../CryptoMethodRow'

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('@/hooks/useAppHaptic', () => ({ useAppHaptic: () => ({ triggerHaptic: jest.fn() }) }))

// a row that drops ListGroup's position draws its own full border: a 2px line between Bank and Crypto
it.each([
    ['bank first', true],
    ['crypto first', false],
])('the rows join into one group with a single line between them (%s)', (_, bankFirst) => {
    const bank = (
        <BankMethodRow
            bank={{ offered: true, unknown: false, blocked: false, badge: null }}
            onClick={jest.fn()}
            testId="bank"
        />
    )
    const crypto = <CryptoMethodRow onClick={jest.fn()} testId="crypto" />
    render(
        <ListGroup>
            {bankFirst ? bank : crypto}
            {bankFirst ? crypto : bank}
        </ListGroup>
    )
    const [first, second] = bankFirst ? ['bank', 'crypto'] : ['crypto', 'bank']
    expect(screen.getByTestId(first)).toHaveClass('rounded-t-sm')
    expect(screen.getByTestId(first)).not.toHaveClass('border-t-0')
    expect(screen.getByTestId(second)).toHaveClass('rounded-b-sm', 'border-t-0')
})
