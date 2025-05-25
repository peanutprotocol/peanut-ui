import { generateMetadata } from '@/app/metadata'
import { Refund } from '@/components'

export const metadata = generateMetadata({
    title: 'Claim Refund | Peanut',
    description:
        'Claim a refund for a Peanut transaction. Follow the steps to process your refund for digital dollar payments.',
})

export default function RefundPage() {
    return <Refund />
}
