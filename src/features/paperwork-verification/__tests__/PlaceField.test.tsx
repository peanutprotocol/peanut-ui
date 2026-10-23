import { act, fireEvent, screen } from '@testing-library/react'
import { useState } from 'react'
import { renderWithIntl } from '@/test-utils/intl'
import { searchKycPlaces } from '@/app/actions/kyc-paperwork-verification'
import { PlaceField, PlacePicker } from '../components/PlaceField'

jest.mock('@/app/actions/kyc-paperwork-verification', () => ({ searchKycPlaces: jest.fn() }))
const mockSearch = searchKycPlaces as jest.MockedFunction<typeof searchKycPlaces>

function Harness({ country, onChange }: { country: string | null; onChange?: (value: string) => void }) {
    const [value, setValue] = useState('')
    return (
        <PlaceField
            id="city"
            value={value}
            country={country}
            onChange={(next) => {
                setValue(next)
                onChange?.(next)
            }}
        />
    )
}

const type = async (text: string) => {
    fireEvent.change(screen.getByTestId('verify-input-place'), { target: { value: text } })
    await act(async () => {
        jest.advanceTimersByTime(300)
    })
}

beforeEach(() => {
    jest.useFakeTimers()
    mockSearch.mockReset()
})
afterEach(() => jest.useRealTimers())

describe('PlaceField', () => {
    it('searches only from the third letter, in the chosen country', async () => {
        mockSearch.mockResolvedValue([{ name: 'São Paulo', region: 'São Paulo' }])
        renderWithIntl(<Harness country="BR" />)
        fireEvent.focus(screen.getByTestId('verify-input-place'))
        await type('Sa')
        expect(mockSearch).not.toHaveBeenCalled()
        await type('São')
        expect(mockSearch).toHaveBeenCalledWith('BR', 'São')
        expect(screen.getByRole('option', { name: /São Paulo/ })).toBeInTheDocument()
    })

    it('takes a suggestion as the answer', async () => {
        const onChange = jest.fn()
        mockSearch.mockResolvedValue([{ name: 'Munich', region: 'Bavaria' }])
        renderWithIntl(<Harness country="DE" onChange={onChange} />)
        fireEvent.focus(screen.getByTestId('verify-input-place'))
        await type('münch')
        fireEvent.click(screen.getByRole('option', { name: /Munich/ }))
        expect(onChange).toHaveBeenLastCalledWith('Munich')
        expect(screen.getByTestId('verify-input-place')).toHaveValue('Munich')
        expect(screen.queryByTestId('verify-place-list')).not.toBeInTheDocument()
    })

    it('keeps a name the list does not have', async () => {
        const onChange = jest.fn()
        mockSearch.mockResolvedValue([])
        renderWithIntl(<Harness country="FR" onChange={onChange} />)
        fireEvent.focus(screen.getByTestId('verify-input-place'))
        await type('Ploumanac’h')
        expect(screen.getByTestId('verify-place-list')).toHaveTextContent('Not in the list')
        expect(onChange).toHaveBeenLastCalledWith('Ploumanac’h')
    })

    it('waits for the country', () => {
        renderWithIntl(<Harness country={null} />)
        expect(screen.getByTestId('verify-input-place')).toBeDisabled()
        expect(screen.getByTestId('verify-input-place')).toHaveAttribute('placeholder', 'Choose the country first')
    })
})

function PickerHarness({ onChange }: { onChange: (value: string) => void }) {
    const [value, setValue] = useState('')
    return (
        <PlacePicker
            field={{ key: 'cityOfBirth', kind: 'place', required: true, value: null, countryField: 'countryOfBirth' }}
            value={value}
            country="DE"
            onChange={(next) => {
                setValue(next)
                onChange(next)
            }}
        />
    )
}

describe('PlacePicker', () => {
    it('keeps a typed name that is not in the list once Done is tapped', async () => {
        mockSearch.mockResolvedValue([])
        const onChange = jest.fn()
        renderWithIntl(<PickerHarness onChange={onChange} />)
        expect(screen.getByTestId('verify-pick-cityOfBirth')).toHaveTextContent('Choose')
        fireEvent.click(screen.getByTestId('verify-pick-cityOfBirth'))
        expect(screen.getByText('Places in Germany. A name that isn’t listed works too.')).toBeInTheDocument()
        await type('Kleindorf')
        expect(screen.getByTestId('verify-place-list')).toHaveTextContent('Not in the list')
        expect(onChange).not.toHaveBeenCalled()
        fireEvent.click(screen.getByTestId('verify-place-done'))
        expect(onChange).toHaveBeenCalledWith('Kleindorf')
        expect(screen.getByTestId('verify-pick-cityOfBirth')).toHaveTextContent('Kleindorf')
    })

    it('picks a suggestion and closes in one tap', async () => {
        mockSearch.mockResolvedValue([{ name: 'Berlin', region: 'Berlin' }])
        const onChange = jest.fn()
        renderWithIntl(<PickerHarness onChange={onChange} />)
        fireEvent.click(screen.getByTestId('verify-pick-cityOfBirth'))
        await type('Ber')
        expect(mockSearch).toHaveBeenCalledWith('DE', 'Ber')
        fireEvent.click(screen.getByRole('option', { name: /Berlin/ }))
        expect(onChange).toHaveBeenCalledWith('Berlin')
        expect(screen.getByTestId('verify-pick-cityOfBirth')).toHaveTextContent('Berlin')
    })
})
