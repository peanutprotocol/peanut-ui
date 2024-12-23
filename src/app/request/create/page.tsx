import { generateMetadata } from '@/app/metadata'
import Layout from '@/components/Global/Layout'
import { CreateRequestLink } from '@/components/Request/Create/Create'

export const metadata = generateMetadata({
    title: 'Request Payment | Peanut',
    description: 'Request cryptocurrency from friends, family, or anyone else using Peanut on any chain.',
    image: '/metadata-img.png',
    keywords: 'crypto request, crypto payment, crypto invoice, crypto payment link',
})

export default function RequestCreate() {
    return (
        <Layout className="!mx-0 w-full !px-0 !pt-0 ">
            <CreateRequestLink />
        </Layout>
    )
}
