import { generateMetadata } from '@/app/metadata'
import { Careers } from '@/components'
export const metadata = generateMetadata({
    title: 'Careers | Peanut',
    description: 'Join the Peanut team and help us build the future of crypto payments.',
    image: '/metadata-img.png',
    keywords: 'jobs, careers, work, employment, crypto, payments',
})

export default function CareersPage() {
    return (
        <div className="flex h-screen flex-col items-center justify-center">
            <Careers />
        </div>
    )
}
