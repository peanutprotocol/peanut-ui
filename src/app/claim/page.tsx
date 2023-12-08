import * as global_components from '@/components/global'
import * as components from '@/components'
import { headers } from 'next/headers'
import { Metadata, ResolvingMetadata } from 'next'
import { getLinkDetails } from '@squirrel-labs/peanut-sdk'
import * as utils from '@/utils'

type Props = {
    params: { id: string }
    searchParams: { [key: string]: string | string[] | undefined }
}

export async function generateMetadata({ params, searchParams }: Props, parent: ResolvingMetadata): Promise<Metadata> {
    try {
        const headersList = headers()
        const fullUrl = headersList.get('referer') || ''
        if (!fullUrl) throw new Error('no referer')

        const linkDetails = await getLinkDetails({ link: fullUrl })

        const title =
            'you got sent ' +
            utils.formatAmount(Number(linkDetails.tokenAmount)) +
            ' in ' +
            linkDetails.tokenSymbol +
            '!'

        console.log('title: ', title)
        return {
            title: title,
        }
    } catch (error) {
        console.error('error: ', error)
        return {
            title: 'you got sent some money!',
        }
    }
}

function ClaimPage() {
    return <global_components.PageWrapper>{/* <components.Claim /> */}</global_components.PageWrapper>
}

export default ClaimPage
