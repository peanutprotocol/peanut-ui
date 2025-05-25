import { generateMetadata } from '@/app/metadata'
import { Privacy } from '@/components'

export const metadata = generateMetadata({
    title: 'Privacy Policy | Peanut - Instant Global P2P Payments',
    description:
        "Learn about Peanut's commitment to your privacy. Our peer-to-peer payments app handles your data responsibly while enabling fast, global digital dollar transfers.",
})

export default function PrivacyPage() {
    return (
        <div className="flex h-screen flex-col items-center justify-center">
            <Privacy />
        </div>
    )
}
