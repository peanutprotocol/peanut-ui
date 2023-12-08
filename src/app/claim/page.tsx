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

function createURL(searchParams: { [key: string]: string | string[] | undefined }): string {
    const baseURL = 'http://localhost:3000/claim'
    const queryParams = new URLSearchParams()

    Object.keys(searchParams).forEach((key) => {
        const value = searchParams[key]
        if (Array.isArray(value)) {
            value.forEach((item) => queryParams.append(key, item))
        } else if (value) {
            queryParams.append(key, value)
        }
    })

    return `${baseURL}?${queryParams.toString()}`
}

export async function generateMetadata({ params, searchParams }: Props, parent: ResolvingMetadata): Promise<Metadata> {
    const url = createURL(searchParams)
    console.log('url: ', url)
    let title = 'you got sent some money!'
    if (url !== '') {
        const linkDetails = await getLinkDetails({ link: url })
        title =
            'you got sent ' +
            utils.formatAmount(Number(linkDetails.tokenAmount)) +
            ' in ' +
            linkDetails.tokenSymbol +
            '!'
    }
    console.log('title: ', title)
    return {
        title: title,
    }
}

function ClaimPage() {
    return (
        <global_components.PageWrapper>
            <components.Claim />
        </global_components.PageWrapper>
    )
}

export default ClaimPage
