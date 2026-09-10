/**
 * DynamicBankAccountForm — the existing-account branch (Chip round 9).
 *
 * With `onExistingAccount` (withdraw flow) a typed account that matches a
 * saved one short-circuits: the handler receives the saved account and no
 * add/`onSuccess` runs. WITHOUT the handler (claim flow) submission proceeds
 * to `onSuccess` — the old unconditional short-circuit hijacked claim users
 * into the withdraw flow, which dead-ended on its no-amount guard; the
 * backend add is idempotent for the same user's account, so falling through
 * is safe.
 */
import React from 'react'
import { render, act } from '@testing-library/react'

// ---------- module-level mocks ----------

jest.mock('next/navigation', () => ({
    useParams: () => ({}),
    useSearchParams: () => ({ get: () => null }),
}))

jest.mock('next-intl', () => ({
    useTranslations: (ns: string) => {
        const t = (key: string) => `${ns}.${key}`
        t.rich = (key: string) => `${ns}.${key}`
        return t
    },
}))

jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { user: { fullName: 'John Doe', email: 'john@doe.co' } } }),
}))

jest.mock('@/hooks/useSendFlowOrigin', () => ({
    useSendFlowOrigin: () => ({ isFromSendFlow: false }),
}))

const SAVED_US_ACCOUNT = {
    id: 'acct-1',
    identifier: '123456789',
    type: 'us',
    details: { countryCode: 'USA' },
}
jest.mock('@/hooks/useSavedAccounts', () => ({
    __esModule: true,
    default: () => [SAVED_US_ACCOUNT],
}))

jest.mock('@/app/actions/ibanToBic', () => ({
    getBicFromIban: jest.fn(async () => ({ bic: null })),
}))

jest.mock('@/components/Global/PeanutActionDetailsCard', () => ({
    __esModule: true,
    default: () => null,
}))

jest.mock('@/components/0_Bruddle/BaseSelect', () => ({
    __esModule: true,
    default: () => null,
}))

import { DynamicBankAccountForm } from '../DynamicBankAccountForm'

// ---------- helpers ----------

// complete, valid US bank details — matches SAVED_US_ACCOUNT's identifier
const US_INITIAL_DATA = {
    accountOwnerName: 'John Doe',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@doe.co',
    accountNumber: '123456789',
    routingNumber: '021000021', // valid ABA checksum
    street: '1 Main St',
    city: 'New York',
    state: 'NY',
    postalCode: '10001',
}

const renderForm = (props: {
    onSuccess: jest.Mock
    onExistingAccount?: (account: unknown) => void
    flow: 'claim' | 'withdraw'
}) => {
    const ref = React.createRef<{ handleSubmit: () => void }>()
    render(
        <DynamicBankAccountForm
            ref={ref}
            country="USA"
            flow={props.flow}
            initialData={US_INITIAL_DATA}
            error={null}
            onSuccess={props.onSuccess}
            onExistingAccount={props.onExistingAccount}
        />
    )
    return ref
}

beforeEach(() => {
    jest.clearAllMocks()
})

// ---------- tests ----------

describe('DynamicBankAccountForm — existing-account branch (Chip round 9)', () => {
    it('withdraw flow: a typed account that already exists goes to onExistingAccount, never onSuccess', async () => {
        const onSuccess = jest.fn(async () => ({}))
        const onExistingAccount = jest.fn()
        const ref = renderForm({ flow: 'withdraw', onSuccess, onExistingAccount })

        await act(async () => {
            ref.current!.handleSubmit()
        })

        expect(onExistingAccount).toHaveBeenCalledWith(expect.objectContaining({ identifier: '123456789' }))
        expect(onSuccess).not.toHaveBeenCalled()
    })

    it('claim flow (no handler): an already-saved account proceeds to onSuccess instead of navigating', async () => {
        // the backend add is idempotent for the same user's account — the old
        // unconditional short-circuit pushed claim users into the withdraw
        // flow's no-amount dead end
        const onSuccess = jest.fn(async () => ({}))
        const ref = renderForm({ flow: 'claim', onSuccess })

        await act(async () => {
            ref.current!.handleSubmit()
        })

        expect(onSuccess).toHaveBeenCalledTimes(1)
        expect(onSuccess).toHaveBeenCalledWith(
            expect.objectContaining({ accountNumber: '123456789' }),
            expect.objectContaining({ accountNumber: '123456789' })
        )
    })
})
