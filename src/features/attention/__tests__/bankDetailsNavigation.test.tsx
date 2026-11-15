import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import ShareBankDetailsCard from '../surfaces/zone/ShareBankDetailsCard'
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('@/i18n/app/useAppTranslations', () => ({ useAppTranslations: () => (key: string) => key }))
jest.mock('@/components/Home/HomeCarouselCTA/CarouselCTA', () => ({
    __esModule: true,
    default: ({ onClick }: { onClick: () => void }) => <button onClick={onClick}>Share</button>,
}))
test('share bank details opens the bank details hub', () => {
    const onActed = jest.fn()
    const onSnoozed = jest.fn()
    render(
        <ShareBankDetailsCard
            {...({ askId: 'share-bank-details', onActed, onDismissed: jest.fn(), onSnoozed } as any)}
        />
    )
    fireEvent.click(screen.getByText('Share'))
    expect(onActed).not.toHaveBeenCalled()
    expect(onSnoozed).toHaveBeenCalledTimes(1)
    expect(mockPush).toHaveBeenCalledWith('/add-money?method=bank')
})

import VirtualAccountCard from '../surfaces/zone/VirtualAccountCard'
test('opening a virtual account navigates directly to the bank hub', () => {
    mockPush.mockClear()
    render(
        <VirtualAccountCard
            askId="virtual-account"
            mode="ask"
            onActed={jest.fn()}
            onDismissed={jest.fn()}
            onSnoozed={jest.fn()}
        />
    )
    fireEvent.click(screen.getByText('Share'))
    expect(mockPush).toHaveBeenCalledWith('/add-money?method=bank')
})
