import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { apiFetch } from '@/utils/api-fetch'
import { BridgePostalCorrection } from '../components/BridgePostalCorrection'

jest.mock('@/utils/api-fetch', () => ({ apiFetch: jest.fn() }))
const request = apiFetch as jest.MockedFunction<typeof apiFetch>
const revision = 'a'.repeat(64)
const reply = (status: number, body: unknown) =>
    ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response
const setup = () => {
    const onQueued = jest.fn()
    const onSupport = jest.fn()
    renderWithIntl(<BridgePostalCorrection visible onClose={jest.fn()} onQueued={onQueued} onSupport={onSupport} />)
    return { onQueued, onSupport }
}

beforeEach(() => request.mockReset())

it('keeps the postal draft after a field refusal and queues a corrected code', async () => {
    request
        .mockResolvedValueOnce(reply(200, { country: 'US', revision }))
        .mockResolvedValueOnce(reply(422, { errors: { postCode: 'invalid_postal_code' } }))
        .mockResolvedValueOnce(reply(200, { status: 'queued' }))
    const { onQueued } = setup()
    const field = await screen.findByTestId('verify-input-postCode')
    fireEvent.change(field, { target: { value: '0210' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    const refusedField = await screen.findByTestId('verify-input-postCode')
    await waitFor(() => expect(refusedField).toHaveAttribute('aria-invalid', 'true'))
    expect(refusedField).toHaveValue('0210')
    fireEvent.change(refusedField, { target: { value: '02108' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByText('Bank setup queued')
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(onQueued).toHaveBeenCalledTimes(1)
    expect(JSON.parse(request.mock.calls[2][1]!.body as string)).toEqual({ postCode: '02108', revision })
})

it.each([404, 409])('retains support when the API returns %s', async (status) => {
    request.mockResolvedValueOnce(reply(status, {}))
    const { onSupport } = setup()
    fireEvent.click(await screen.findByRole('button', { name: 'Contact support' }))
    expect(onSupport).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('verify-input-postCode')).not.toBeInTheDocument()
})

it('allows retry after a temporary read failure', async () => {
    request.mockResolvedValueOnce(reply(503, {})).mockResolvedValueOnce(reply(200, { country: 'US', revision }))
    setup()
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }))
    expect(await screen.findByTestId('verify-input-postCode')).toBeInTheDocument()
})
