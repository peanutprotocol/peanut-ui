import PageContainer from '@/components/0_Bruddle/PageContainer'
import { use } from 'react'
import PaymentPage from './client'
import getOrigin from '@/lib/hosting/get-origin'
import { BASE_URL } from '@/constants'
import { isAddress } from 'viem'
import { printableAddress } from '@/utils'
import { chargesApi } from '@/services/charges'

type PageProps = {
    params: Promise<{ recipient?: string[] }>
}

export async function generateMetadata({ params, searchParams }: any) {
    let title = 'Request Payment | Peanut'
    const siteUrl: string = (await getOrigin()) || BASE_URL // getOrigin for getting the origin of the site regardless of its a vercel preview or not
    const resolvedSearchParams = await searchParams

    let recipient = params.recipient[0]

    if (recipient.includes('%40') || recipient.includes('@')) {
        // split on @ or %40
        recipient = recipient.split(/%40|@/)[0] || 'Someone'
    }

    const chargeId = resolvedSearchParams.chargeId

    let isPaid = false
    if (chargeId) {
        try {
            //get charge details to determine status
            const chargeDetails = await chargesApi.get(chargeId)
            console.log('chargeDetails', chargeDetails)

            // determine status based on charge data
            isPaid = chargeDetails?.fulfillmentPayment?.status === 'SUCCESSFUL'
        } catch (error) {
            console.error('Failed to fetch charge details:', error)
        }

        let amount, token
        if (params.recipient[1]) {
            const amountToken = params.recipient[1]
            const match = amountToken.match(/^(\d*\.?\d*)(.*)$/)
            if (match) {
                amount = match[1]
                token = match[2]
            }
        }

        const ogUrl = new URL(`${siteUrl}/api/og`)
        ogUrl.searchParams.set('type', 'request')
        ogUrl.searchParams.set('username', recipient)
        if (amount) {
            // if its amount, make request/claim social preview, otherwise make receipt social preview
            ogUrl.searchParams.set('amount', String(amount))
        }
        if (isPaid) {
            // if its paid, make receipt social preview
            ogUrl.searchParams.set('isReceipt', 'true')
        }

        if (!siteUrl) {
            console.error('Error: Unable to determine site origin')
            return { title }
        }

        if (amount && token) {
            title = `${isAddress(recipient) ? printableAddress(recipient) : recipient} is requesting ${amount} ${token.toUpperCase()}`
        } else if (amount) {
            title = `${isAddress(recipient) ? printableAddress(recipient) : recipient} is requesting $${amount}`
        } else {
            title = `${isAddress(recipient) ? printableAddress(recipient) : recipient} | Peanut`
        }

        return {
            title,
            description: 'Send cryptocurrency to friends, family, or anyone else using Peanut on any chain.',
            icons: {
                icon: '/logo-favicon.png',
            },
            openGraph: {
                title,
                description: 'Seamless payment infrastructure for sending and receiving digital assets.',
                images: [{ url: ogUrl.toString(), width: 1200, height: 630 }],
            },
            twitter: {
                card: 'summary_large_image',
                title,
                description: 'Send cryptocurrency to friends, family, or anyone else using Peanut on any chain.',
                images: [ogUrl.toString()],
            },
        }
    }
}

export default function Page(props: PageProps) {
    const params = use(props.params)
    const recipient = params.recipient ?? []
    return (
        <PageContainer className="min-h-[inherit]">
            <PaymentPage recipient={recipient} />
        </PageContainer>
    )
}
