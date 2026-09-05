import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { RejectLabelsList } from '@/components/Kyc/RejectLabelsList'
import messages from '@/i18n/app/messages/en.json'

const renderList = (rejectLabels?: string[] | null) =>
    render(
        <NextIntlClientProvider locale="en" messages={messages}>
            <RejectLabelsList rejectLabels={rejectLabels} />
        </NextIntlClientProvider>
    )

describe('RejectLabelsList', () => {
    // A rejection is a failure, not information: the error tone carries the red
    // badge fill, and role="alert" so it is announced.
    it('renders each reason on the error tone', () => {
        renderList(['UNSATISFACTORY_PHOTOS', 'SCREENSHOTS'])
        const alerts = screen.getAllByRole('alert')
        expect(alerts).toHaveLength(2)
        for (const alert of alerts) expect(alert).toHaveClass('bg-background-badge-error')
    })

    it('renders the no-labels fallback on the same tone', () => {
        renderList(null)
        expect(screen.getByRole('alert')).toHaveClass('bg-background-badge-error')
    })
})
