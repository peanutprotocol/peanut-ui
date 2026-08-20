import { generateMetadata } from '@/app/metadata'
import { Careers } from '@/components/Jobs/Careers'
import Footer from '@/components/LandingPage/Footer'

export const metadata = generateMetadata({
    title: 'Careers | Work at Peanut',
    description:
        'Open roles at Peanut, the money app for people who cross borders — send and receive money globally, spend with the Peanut Card, and cash in and out through local rails.',
    keywords: 'careers, jobs, remote jobs, Peanut careers, fintech jobs, stablecoin jobs, growth jobs',
    // Without this the page inherits the root layout's `canonical: '/'` and
    // declares the homepage as its canonical while sitting in the sitemap.
    canonical: '/careers',
})

export default function CareersPage() {
    return (
        // /careers lives outside [locale], so it never inherits the marketing
        // layout's footer — render it here explicitly.
        <main className="flex min-h-dvh flex-col bg-white">
            <div className="flex-1">
                <Careers />
            </div>
            <Footer />
        </main>
    )
}
