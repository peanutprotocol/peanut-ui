import React from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { readClipboard } from '@/utils/clipboard-extract.utils'
import { clipboardHasStrings } from '@/utils/clipboard-detect'
import { isAndroidNative, isIOSNative } from '@/utils/capacitor'
import { SendAmountKeypad } from '../SendAmountKeypad'

const toastError = jest.fn()

jest.mock('@/utils/clipboard-extract.utils', () => ({ readClipboard: jest.fn() }))
jest.mock('@/utils/clipboard-detect', () => ({ clipboardHasStrings: jest.fn() }))
jest.mock('@/utils/capacitor', () => ({ isAndroidNative: jest.fn(), isIOSNative: jest.fn() }))
jest.mock('@/components/0_Bruddle/Toast', () => ({ useToast: () => ({ error: toastError }) }))
jest.mock('@/components/0_Bruddle/Button', () => ({
    Button: ({ children, variant, ...props }: React.ComponentProps<'button'> & { variant?: string }) => (
        <button {...props}>{children}</button>
    ),
}))
jest.mock('@/utils/general.utils', () => ({ formatTokenAmount: (value: string) => value }))

const mockRead = readClipboard as jest.MockedFunction<typeof readClipboard>
const mockHasStrings = clipboardHasStrings as jest.MockedFunction<typeof clipboardHasStrings>
const mockAndroid = isAndroidNative as jest.MockedFunction<typeof isAndroidNative>
const mockIOS = isIOSNative as jest.MockedFunction<typeof isIOSNative>

beforeEach(() => {
    jest.clearAllMocks()
    mockAndroid.mockReturnValue(false)
    mockIOS.mockReturnValue(false)
})

it('shows a paste chip only for a detected amount on Android', async () => {
    mockAndroid.mockReturnValue(true)
    mockRead.mockResolvedValue({ ok: true, text: '$25.50' })
    const onAmountChange = jest.fn()
    renderWithIntl(
        <SendAmountKeypad amount="" onAmountChange={onAmountChange}>
            <span>Comment</span>
        </SendAmountKeypad>
    )

    const chip = await screen.findByRole('button', { name: /Paste from clipboard/ })
    expect(chip).toHaveTextContent('$25.50')
    fireEvent.click(chip)
    await waitFor(() => expect(onAmountChange).toHaveBeenCalledWith('25.50'))
})

it('does not inspect clipboard text on iOS until the user taps', async () => {
    mockIOS.mockReturnValue(true)
    mockHasStrings.mockResolvedValue(true)
    mockRead.mockResolvedValue({ ok: true, text: 'USD 12.25' })
    const onAmountChange = jest.fn()
    renderWithIntl(
        <SendAmountKeypad amount="" onAmountChange={onAmountChange}>
            <span>Comment</span>
        </SendAmountKeypad>
    )

    const chip = await screen.findByRole('button', { name: /Paste from clipboard/ })
    expect(mockRead).not.toHaveBeenCalled()
    fireEvent.click(chip)
    await waitFor(() => expect(onAmountChange).toHaveBeenCalledWith('12.25'))
})

it('hides the Android shortcut for unrelated clipboard text', async () => {
    mockAndroid.mockReturnValue(true)
    mockRead.mockResolvedValue({ ok: true, text: 'Dinner at 7' })
    renderWithIntl(
        <SendAmountKeypad amount="" onAmountChange={jest.fn()}>
            <span>Comment</span>
        </SendAmountKeypad>
    )

    await waitFor(() => expect(mockRead).toHaveBeenCalled())
    expect(screen.queryByRole('button', { name: /Paste from clipboard/ })).not.toBeInTheDocument()
})

it('offers a tap-to-paste action in the browser when clipboard text cannot be inspected in advance', async () => {
    mockRead.mockResolvedValue({ ok: true, text: '$12.50' })
    const onAmountChange = jest.fn()
    renderWithIntl(
        <SendAmountKeypad amount="" onAmountChange={onAmountChange}>
            <span>Comment</span>
        </SendAmountKeypad>
    )

    const chip = await screen.findByRole('button', { name: /Paste from clipboard/ })
    expect(mockRead).not.toHaveBeenCalled()
    fireEvent.click(chip)
    await waitFor(() => expect(onAmountChange).toHaveBeenCalledWith('12.50'))
})

it('keeps the browser paste action available after nonnumeric clipboard text', async () => {
    mockRead.mockResolvedValue({ ok: true, text: 'Dinner at 7' })
    renderWithIntl(
        <SendAmountKeypad amount="" onAmountChange={jest.fn()}>
            <span>Comment</span>
        </SendAmountKeypad>
    )

    fireEvent.click(await screen.findByRole('button', { name: /Paste from clipboard/ }))
    await waitFor(() => expect(toastError).toHaveBeenCalled())
    expect(screen.getByRole('button', { name: /Paste from clipboard/ })).toBeInTheDocument()
})

it('centers the persistent amount validation message', () => {
    renderWithIntl(
        <SendAmountKeypad
            amount="5"
            onAmountChange={jest.fn()}
            validationMessage="Not enough balance"
            validationAction={<button type="button">Add money</button>}
        >
            {null}
        </SendAmountKeypad>
    )

    expect(screen.getByRole('alert')).toHaveClass('text-center')
    expect(screen.getByRole('alert').compareDocumentPosition(screen.getByRole('button', { name: 'Add money' }))).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING
    )
})

it('removes the number keys while the comment keyboard is active', () => {
    renderWithIntl(
        <SendAmountKeypad amount="12" onAmountChange={jest.fn()} commentActive>
            <span>Comment input</span>
        </SendAmountKeypad>
    )

    expect(screen.getByText('Comment input')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Amount keypad' })).not.toBeInTheDocument()
    expect(document.querySelector('[role="group"][aria-label="Amount keypad"]')).toHaveClass('invisible')
})
