/**
 * `tone` is the semantic color contract: yellow is for warnings only, red for
 * errors, green for success, blue for plain information. Call sites used to
 * pick the bubble color through a free-form class, which is how every second
 * modal ended up yellow.
 */
import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import ActionModal from '@/components/Global/ActionModal'

const renderModal = (props: Partial<React.ComponentProps<typeof ActionModal>>) =>
    render(<ActionModal visible onClose={jest.fn()} title="Title" {...props} />, { wrapper: IntlWrapper })

const bubble = (container: HTMLElement) =>
    container.querySelector('[data-testid="action-modal-icon"]') as HTMLElement | null

describe('ActionModal tone', () => {
    it('connects its title and description to the real modal dialog', () => {
        renderModal({ title: 'Payment failed', description: 'Try again.' })
        expect(screen.getByRole('dialog', { name: 'Payment failed' })).toHaveAccessibleDescription('Try again.')
    })

    it.each([
        ['error', 'bg-background-icon-bubble-red', 'lucide-ban'],
        ['warning', 'bg-background-icon-bubble-yellow', 'lucide-triangle-alert'],
        ['success', 'bg-background-icon-bubble-green', 'lucide-check'],
        ['info', 'bg-background-icon-bubble-blue', 'lucide-info'],
    ] as const)('%s maps to the %s bubble with its default icon', (tone, bg, iconClass) => {
        const { baseElement } = renderModal({ tone })
        expect(bubble(baseElement)).toHaveClass(bg)
        expect(bubble(baseElement)!.querySelector(`.${iconClass}`)).not.toBeNull()
    })

    it('keeps the pink default bubble without a tone', () => {
        const { baseElement } = renderModal({ icon: 'alert' })
        expect(bubble(baseElement)).toHaveClass('bg-action-primary')
    })

    it('lets an explicit icon and container class win over the tone', () => {
        const { baseElement } = renderModal({
            tone: 'error',
            icon: 'lock',
            iconContainerClassName: 'bg-background-icon-bubble-gray',
        })
        expect(bubble(baseElement)).toHaveClass('bg-background-icon-bubble-gray')
        expect(bubble(baseElement)).not.toHaveClass('bg-background-icon-bubble-red')
        expect(bubble(baseElement)!.querySelector('.lucide-lock')).not.toBeNull()
        expect(bubble(baseElement)!.querySelector('.lucide-ban')).toBeNull()
    })

    it('renders the DS checkbox and reports its state', () => {
        const onChange = jest.fn()
        renderModal({ checkbox: { text: 'I understand', checked: false, onChange } })
        fireEvent.click(screen.getByLabelText('I understand'))
        expect(onChange).toHaveBeenCalledWith(true)
    })
})
