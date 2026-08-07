import { fireEvent, render, screen } from '@testing-library/react'
import FacetChecklist from '../FacetChecklist'

describe('FacetChecklist registry fidelity', () => {
    it('distinguishes active-zero rails from inactive historical rails without disabling either', () => {
        const onChange = jest.fn()
        render(
            <FacetChecklist
                label="Rail"
                tooltip="Rail status"
                facets={[
                    {
                        value: 'NEW_LIVE_RAIL',
                        label: 'New live rail',
                        observedCount: 0,
                        configured: true,
                        isActive: true,
                    },
                    {
                        value: 'HISTORICAL_RAIL',
                        label: 'Historical rail',
                        observedCount: 12,
                        configured: true,
                        isActive: false,
                    },
                ]}
                selected={[]}
                onChange={onChange}
            />
        )

        expect(screen.getByLabelText('Active in the live registry; no observations in this window')).toHaveTextContent(
            'live'
        )
        expect(
            screen.getByLabelText('Inactive in the live registry; historical observations remain selectable')
        ).toHaveTextContent('inactive')
        const historical = screen.getByRole('checkbox', { name: /Historical rail/ })
        expect(historical).toBeEnabled()
        fireEvent.click(historical)
        expect(onChange).toHaveBeenCalledWith(['HISTORICAL_RAIL'])
    })
})
