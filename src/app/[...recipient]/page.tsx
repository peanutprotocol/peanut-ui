import PageContainer from '@/components/0_Bruddle/PageContainer'
import { use } from 'react'
import PaymentPage from './client'
import { buildPaymentMetadata } from './payment-metadata'
import { notFound } from 'next/navigation'
import { couldBeRecipient, isReservedRoute } from '@/constants/routes'

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

    // Guard: Reserved routes should be handled by their specific route files
    // If we reach here, it means Next.js routing didn't catch it properly
    const firstSegment = recipient[0]
    if (firstSegment && isReservedRoute(`/${firstSegment}`)) {
        notFound()
    }

    // Guard: anything that can't be a username/address/ENS/handle is a 404, not a profile.
    // Pre-Feb-21 indexed URLs like /es/argentina previously fell through here and rendered
    // a "es on Peanut" profile page — that's the regression this guards against.
    if (firstSegment && !couldBeRecipient(firstSegment)) {
        notFound()
    }

    return (
        <PageContainer>
            <PaymentPage recipient={recipient} />
        </PageContainer>
    )
}
