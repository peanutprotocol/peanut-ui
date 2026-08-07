import { type Metadata } from 'next'
import { generateMetadata as metadataHelper } from '@/app/metadata'

// Without this the page inherits the root layout's `canonical: '/'` and
// declares the homepage as its canonical while sitting in the sitemap.
export const metadata: Metadata = metadataHelper({
    title: 'Live Exchange Rates | Peanut',
    description: 'Compare the real exchange rate with what banks and transfer apps actually charge.',
    canonical: '/exchange',
})

export default function ExchangeLayout({ children }: { children: React.ReactNode }) {
    return children
}
