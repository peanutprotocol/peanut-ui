import Layout from '@/components/Global/Layout'
import { CreateRequestLink } from '@/components/Request/Create/Create'
import { generateMetadata } from '@/config'

export const metadata = generateMetadata('requestCreate')

export default function RequestCreate() {
    return (
        <Layout className="!mx-0 w-full !px-0 !pt-0 ">
            <CreateRequestLink />
        </Layout>
    )
}
