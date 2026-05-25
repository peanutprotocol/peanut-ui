import { fireEvent, render, screen } from '@testing-library/react'
import { KycNotStarted } from '../KycNotStarted'

jest.mock('use-haptic', () => ({
    useHaptic: () => ({ triggerHaptic: jest.fn() }),
}))

jest.mock('@/hooks/useLongPress', () => ({
    useLongPress: () => ({
        isLongPressed: false,
        pressProgress: 0,
        handlers: {},
    }),
}))

jest.mock('../../KYCStatusDrawerItem', () => ({
    KYCStatusDrawerItem: () => <div data-testid="kyc-status-drawer-item" />,
}))

jest.mock('@/components/Global/InfoCard', () => ({
    __esModule: true,
    default: ({ description }: { description: string }) => <div>{description}</div>,
}))

describe('KycNotStarted', () => {
    it('does not pass the click event to onResume', () => {
        const onResume = jest.fn()
        render(<KycNotStarted onResume={onResume} />)

        fireEvent.click(screen.getByText('Continue verification'))

        expect(onResume).toHaveBeenCalledTimes(1)
        expect(onResume).toHaveBeenCalledWith()
    })
})
