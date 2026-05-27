import { notFound } from 'next/navigation'
import { generateMetadata as generateMeta } from '@/app/metadata'
import { LandingPageShell } from '@/components/LandingPage/LandingPageShell'
import Footer from '@/components/LandingPage/Footer'
import MerchantLandingPage from './MerchantLandingPage'
import { MERCHANTS, MERCHANT_SLUGS } from './merchants'

export function generateStaticParams() {
    return MERCHANT_SLUGS.map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
    const merchant = MERCHANTS[slug]
    if (!merchant) return {}
    return generateMeta({
        title: `${merchant.name} × peanut`,
        description: merchant.metaDescription,
        canonical: `/m/${slug}`,
    })
}

export default async function MerchantPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
    const merchant = MERCHANTS[slug]
    if (!merchant) notFound()

    return (
        <LandingPageShell>
            <MerchantLandingPage merchant={merchant} />
            <Footer />
        </LandingPageShell>
    )
}
