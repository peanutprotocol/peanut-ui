import * as global_components from '@/components/global'
import * as components from '@/components'
import { headers } from 'next/headers'
import { Metadata, ResolvingMetadata } from 'next'
import { getLinkDetails } from '@squirrel-labs/peanut-sdk'
import * as utils from '@/utils'

type Props = {
    params: { id?: string[] }
    searchParams: { [key: string]: string | string[] | undefined }
}

function createURL(searchParams: { [key: string]: string | string[] | undefined }): string {
    const baseURL = 'https://staging.peanut.to/claim'

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

export async function generateMetadata(params: Props): Promise<Metadata> {
    const url = createURL(params.searchParams)
    let title = ''

    if (url !== '') {
        try {
            const linkDetails = await getLinkDetails({ link: url })
            title =
                'you got sent ' +
                utils.formatAmount(Number(linkDetails.tokenAmount)) +
                ' in ' +
                linkDetails.tokenSymbol +
                '!'
        } catch (e) {
            console.log('error: ', e)
        }
    }
    return {
        title: title,
    }
}

function ClaimPage(props: Props) {
    return (
        <global_components.PageWrapper>
            <components.Claim />
        </global_components.PageWrapper>
    )
}

export default ClaimPage
