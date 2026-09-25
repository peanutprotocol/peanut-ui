/**
 * `tone` is the semantic color contract: yellow is for attention only, red for
 * errors, green for success, blue for plain information, pink for Peanut's
 * own. An icon never renders without one. Call sites used to
 * pick the bubble color through a free-form class, which is how every second
 * modal ended up yellow.
 */
import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import ActionModal from '@/components/Global/ActionModal'

jest.mock('@/components/Global/Modal', () => ({
    __esModule: true,
    default: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
        visible ? <div>{children}</div> : null,
}))

type Props = React.ComponentProps<typeof ActionModal>
const renderModal = (props: Partial<Props>) =>
    render(<ActionModal {...({ visible: true, onClose: jest.fn(), title: 'Title', ...props } as Props)} />, {
        wrapper: IntlWrapper,
    })

const bubble = (container: HTMLElement) =>
    container.querySelector('[data-testid="action-modal-icon"]') as HTMLElement | null

describe('ActionModal tone', () => {
    it.each([
        ['error', 'bg-background-icon-bubble-red', 'lucide-ban'],
        ['attention', 'bg-background-icon-bubble-yellow', 'lucide-triangle-alert'],
        ['success', 'bg-background-icon-bubble-green', 'lucide-check'],
        ['info', 'bg-background-icon-bubble-blue', 'lucide-info'],
    ] as const)('%s maps to the %s bubble with its default icon', (tone, bg, iconClass) => {
        const { container } = renderModal({ tone })
        expect(bubble(container)).toHaveClass(bg)
        expect(bubble(container)!.querySelector(`.${iconClass}`)).not.toBeNull()
    })

    it('brand is the pink bubble around the given icon', () => {
        const { container } = renderModal({ tone: 'brand', icon: 'bell' })
        expect(bubble(container)).toHaveClass('bg-background-brand')
        expect(bubble(container)!.querySelector('.lucide-bell')).not.toBeNull()
    })

    it('draws no bubble without a tone: there is no implicit color', () => {
        const { container } = renderModal({})
        expect(bubble(container)).toBeNull()
    })

    it('lets an explicit icon and container class win over the tone', () => {
        const { container } = renderModal({
            tone: 'error',
            icon: 'lock',
            iconContainerClassName: 'bg-background-icon-bubble-gray',
        })
        expect(bubble(container)).toHaveClass('bg-background-icon-bubble-gray')
        expect(bubble(container)).not.toHaveClass('bg-background-icon-bubble-red')
        expect(bubble(container)!.querySelector('.lucide-lock')).not.toBeNull()
        expect(bubble(container)!.querySelector('.lucide-ban')).toBeNull()
    })

    it('renders the DS checkbox and reports its state', () => {
        const onChange = jest.fn()
        renderModal({ checkbox: { text: 'I understand', checked: false, onChange } })
        fireEvent.click(screen.getByLabelText('I understand'))
        expect(onChange).toHaveBeenCalledWith(true)
    })
})
