import { generateMetadata } from '@/app/metadata'
import { Jobs } from '@/components'

export const metadata = generateMetadata({
    title: 'Jobs | Peanut',
    description: 'Join the Peanut team and help us build the future of crypto payments.',
    image: '/metadata-img.png',
    keywords: 'jobs, careers, work, employment, crypto, payments',
})

export default function JobsPage() {
    return <Jobs />
}
