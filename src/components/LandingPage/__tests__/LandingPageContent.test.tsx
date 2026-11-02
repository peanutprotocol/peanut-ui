import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { contentHrefsFor } from '../landingContentHrefs.server'
import { LandingPageContent } from '../LandingPageContent'

const captured: Array<{ faqItems: Array<{ id: string; learnMoreHref?: string }> }> = []
jest.mock('../HomeFolds', () => ({
    HomeFolds: (props: { faqItems: Array<{ id: string; learnMoreHref?: string }> }) => {
        captured.push(props)
        return null
    },
}))
jest.mock('../LandingPageClient', () => ({
    LandingPageClient: ({ foldsSlot }: { foldsSlot: ReactNode }) => <>{foldsSlot}</>,
}))
jest.mock('../Footer', () => ({ __esModule: true, default: () => null }))

describe('pinned landing FAQ help links', () => {
    it.each(['en', 'es-419', 'es-ar', 'pt-br'] as const)('%s retains links for every numbered FAQ', (locale) => {
        captured.length = 0
        render(<LandingPageContent locale={locale} />)
        const items = captured[0].faqItems
        const hrefs = contentHrefsFor(locale)
        const expected = [
            hrefs.whatAreDigitalDollars,
            hrefs.verification,
            hrefs.passkeys,
            hrefs.securityCustody,
            hrefs.feesPricing,
        ]
        for (let index = 0; index < 5; index++) {
            expect(items.find((item) => item.id === String(index + 1))).toMatchObject({
                learnMoreHref: expected[index],
            })
        }
    })
})
