import { fireEvent, render, screen } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { CardResidenceAddressScreen } from '../components/CardResidenceAddressScreen'

jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/PeanutMascot', () => ({ __esModule: true, default: () => null }))

const mockCallout = jest.fn()
jest.mock('@/components/0_Bruddle/Callout', () => {
    const actual = jest.requireActual('@/components/0_Bruddle/Callout')
    const React = jest.requireActual('react')
    const wrap = (Component: React.ComponentType) =>
        function CalloutSpy(props: Record<string, unknown>) {
            mockCallout(props)
            return React.createElement(Component, props)
        }
    return {
        ...actual,
        ...(actual.default ? { default: wrap(actual.default) } : {}),
        ...(actual.Callout ? { Callout: wrap(actual.Callout) } : {}),
    }
})

it('announces a launch failure using the shared error Callout and retains the start action for retry', () => {
    const onStart = jest.fn()
    const error = 'Address verification could not open. Please try again.'
    render(
        <IntlWrapper>
            <CardResidenceAddressScreen
                state="required"
                loading={false}
                error={error}
                onStart={onStart}
                onRefresh={jest.fn()}
                onBack={jest.fn()}
            />
        </IntlWrapper>
    )
    expect(screen.getByRole('alert')).toHaveTextContent(error)
    expect(mockCallout).toHaveBeenCalledWith(expect.objectContaining({ priority: 'error' }))
    fireEvent.click(screen.getByRole('button'))
    expect(onStart).toHaveBeenCalledTimes(1)
})
