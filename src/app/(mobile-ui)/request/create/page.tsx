import { generateMetadata } from '@/app/metadata'
import { CreateRequestLink } from '@/components/Request/Create/Create'

export const metadata = generateMetadata({
    title: 'Request Payment | Peanut',
    description: 'Request cryptocurrency from friends, family, or anyone else using Peanut on any chain.',
    image: '/metadata-img.png',
    keywords: 'crypto request, crypto payment, crypto invoice, crypto payment link',
})

export default function RequestCreate() {
    return <CreateRequestLink />
}
