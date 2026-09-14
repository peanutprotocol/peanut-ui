import PageContainer from '@/components/0_Bruddle/PageContainer'
import { use } from 'react'
import PayRoute from './client'
import { buildPaymentMetadata } from '@/app/[...recipient]/payment-metadata'
import { notFound } from 'next/navigation'
import { couldBeRecipient } from '@/constants/routes'

type PageProps = {
    params: Promise<{ recipient?: string[] }>
    searchParams: Promise<{ chargeId?: string }>
}

export async function generateMetadata({ params, searchParams }: PageProps) {
    const [{ recipient }, { chargeId }] = await Promise.all([params, searchParams])
    return buildPaymentMetadata(recipient, chargeId)
}

export default function Page(props: PageProps) {
    const params = use(props.params)
    const recipient = params.recipient ?? []

    // Same guard the root catch-all applies: anything that can't be a
    // username/address/ENS/handle is a 404, not a payment page. No reserved-route
    // guard is needed here — `/pay` is itself a reserved root, so nothing below it
    // collides with a real page.
    if (recipient[0] && !couldBeRecipient(recipient[0])) {
        notFound()
    }

    return (
        <PageContainer>
            <PayRoute recipient={recipient} />
        </PageContainer>
    )
}
