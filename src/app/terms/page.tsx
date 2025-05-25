import { generateMetadata } from '@/app/metadata'
import { Terms } from '@/components'

export const metadata = generateMetadata({
    title: 'Terms of Service | Peanut - Instant Global P2P Payments',
    description:
        'Read the Terms of Service for Peanut. Understand the terms for using our instant, global P2P payments app with digital dollars, especially for Latin America.',
})

export default function TermsPage() {
    return (
        <div className="flex h-screen flex-col items-center justify-center">
            <Terms />
        </div>
    )
}
