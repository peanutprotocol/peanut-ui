import React from 'react'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { SendCommentEntry } from '../SendCommentEntry'

jest.mock('@/components/0_Bruddle/Button', () => ({
    Button: ({ children, variant, ...props }: React.ComponentProps<'button'> & { variant?: string }) => (
        <button {...props}>{children}</button>
    ),
}))

it('offers three emoji choices and inserts a selected emoji into the comment', () => {
    const onChange = jest.fn()
    renderWithIntl(<SendCommentEntry value="Dinner" onChange={onChange} onEditingChange={jest.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Edit comment' }))
    const choices = screen.getAllByRole('button', { name: /^Add .* to comment$/ })
    expect(choices).toHaveLength(3)
    expect(screen.getByRole('textbox', { name: 'Comment' })).toHaveClass('pr-36')
    expect(screen.queryByText('Comment')).not.toBeInTheDocument()
    expect(choices[0]).toHaveClass('opacity-50')
    expect(screen.getByRole('button', { name: 'Save comment' })).toBeEnabled()
    fireEvent.click(choices[0])
    expect(onChange).toHaveBeenCalledWith(expect.stringMatching(/^Dinner.+$/))
})

it('activates the attached pink check action after an emoji is added', () => {
    function CommentHarness() {
        const [value, setValue] = React.useState('')
        return <SendCommentEntry value={value} onChange={setValue} onEditingChange={jest.fn()} />
    }

    renderWithIntl(<CommentHarness />)
    fireEvent.click(screen.getByRole('button', { name: 'Add comment' }))

    const save = screen.getByRole('button', { name: 'Save comment' })
    const input = screen.getByRole('textbox', { name: 'Comment' })
    expect(save).toBeDisabled()
    expect(save).toHaveClass('disabled:opacity-50')
    expect(input.parentElement?.parentElement).toHaveClass('border-action-primary/50')

    fireEvent.click(screen.getAllByRole('button', { name: /^Add .* to comment$/ })[0])
    expect(save).toBeEnabled()
    expect(input.parentElement?.parentElement).toHaveClass('border-action-primary')

    fireEvent.click(save)
    expect(screen.getByRole('button', { name: 'Edit comment' })).toBeInTheDocument()
})
