import { generateMetadata } from '@/app/metadata'
import { Refund } from '@/components'

export const metadata = generateMetadata({
    title: 'Process Refund',
    description: 'Process refund for a Peanut transaction. Follow the steps to refund your payment.',
})

export default function RefundPage() {
    return <Refund />
}
