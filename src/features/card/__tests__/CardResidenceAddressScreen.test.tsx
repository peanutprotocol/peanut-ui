import { fireEvent, render, screen } from '@testing-library/react'
import messages from '@/i18n/app/messages/en.json'
import { IntlWrapper } from '@/test-utils/intl'
import { CardResidenceAddressScreen } from '../components/CardResidenceAddressScreen'

jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/PeanutMascot', () => ({ __esModule: true, default: () => null }))

it.each(['required', 'rejected', 'in_review', 'unavailable'] as const)(
    'offers the correct next step for %s',
    (state) => {
        const onStart = jest.fn()
        const onRefresh = jest.fn()
        render(
            <IntlWrapper>
                <CardResidenceAddressScreen
                    state={state}
                    loading={false}
                    onStart={onStart}
                    onRefresh={onRefresh}
                    onBack={jest.fn()}
                />
            </IntlWrapper>
        )
        expect(screen.getByText(messages.card.addressStep[state])).toBeVisible()
        const waiting = state === 'in_review' || state === 'unavailable'
        fireEvent.click(screen.getByRole('button'))
        expect(waiting ? onRefresh : onStart).toHaveBeenCalledTimes(1)
        expect(waiting ? onStart : onRefresh).not.toHaveBeenCalled()
        expect(screen.getByRole('heading')).toBeVisible()
    }
)
