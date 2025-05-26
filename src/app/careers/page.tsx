import { generateMetadata } from '@/app/metadata'
import { Careers } from '@/components'

export const metadata = generateMetadata({
    title: 'Careers | Join Peanut - Instant Global P2P Payments',
    description:
        'Explore career opportunities at Peanut. Join our team to build the future of fast, global peer-to-peer payments with digital dollars.',
    keywords: 'careers, jobs, employment, Peanut careers, P2P payments jobs, fintech jobs, crypto jobs, tech jobs',
})

export default function CareersPage() {
    return (
        <div className="flex h-screen flex-col items-center justify-center">
            <Careers />
        </div>
    )
}
