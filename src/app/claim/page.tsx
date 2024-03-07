import * as global_components from '@/components/global'
import * as components from '@/components'
import { Metadata, ResolvingMetadata } from 'next'
import { getLinkDetails } from '@squirrel-labs/peanut-sdk'
import * as utils from '@/utils'
export const dynamic = 'force-dynamic'
import {
    FrameButton,
    FrameContainer,
    FrameImage,
    FrameInput,
    FrameReducer,
    NextServerPageProps,
    getFrameMessage,
    getPreviousFrame,
    useFramesReducer,
} from 'frames.js/next/server'
import Link from 'next/link'

import { headers } from 'next/headers'

function currentURL(pathname: string): URL {
    const headersList = headers()
    const host = headersList.get('x-forwarded-host') || headersList.get('host')
    const protocol = headersList.get('x-forwarded-proto') || 'http'

    return new URL(pathname, `${protocol}://${host}`)
}

type Props = {
    params: { id: string }
    searchParams: { [key: string]: string | string[] | undefined }
}

// function createURL(searchParams: { [key: string]: string | string[] | undefined }): string {
//     const baseURL = 'https://peanut.to/claim'

//     const queryParams = new URLSearchParams()

//     Object.keys(searchParams).forEach((key) => {
//         const value = searchParams[key]
//         if (Array.isArray(value)) {
//             value.forEach((item) => queryParams.append(key, item))
//         } else if (value) {
//             queryParams.append(key, value)
//         }
//     })

//     return `${baseURL}?${queryParams.toString()}`
// }

// export async function generateMetadata({ params, searchParams }: Props, parent: ResolvingMetadata): Promise<Metadata> {
//     let title = 'Peanut Protocol'

//     try {
//         const url = createURL(searchParams)
//         const linkDetails = await getLinkDetails({ link: url })
//         title =
//             'You received ' +
//             (Number(linkDetails.tokenAmount) < 0.01
//                 ? 'some '
//                 : utils.formatAmount(Number(linkDetails.tokenAmount)) + ' in ') +
//             linkDetails.tokenSymbol +
//             '!'
//     } catch (e) {
//         console.log('error: ', e)
//     }

//     return {
//         title: title,
//         icons: {
//             icon: '/logo-favicon.png',
//         },
//         openGraph: {
//             images: [
//                 {
//                     url: '/claim-metadata-img.jpg',
//                 },
//             ],
//         },
//     }
// }

export const metadata: Metadata = {
    // without a title, warpcast won't validate your frame
    title: 'Peanut Protocol',
    description: 'Send crypto with a link',
}

type State = {
    active: string
    total_button_presses: number
}

const initialState = { active: '1', total_button_presses: 0 }

const reducer: FrameReducer<State> = (state, action) => {
    return {
        total_button_presses: state.total_button_presses + 1,
        active: action.postBody?.untrustedData.buttonIndex ? String(action.postBody?.untrustedData.buttonIndex) : '1',
    }
}

export default function ClaimPage({ params, searchParams }: Props) {
    const url = currentURL('/')
    const previousFrame = getPreviousFrame<State>(searchParams)

    const [state] = useFramesReducer<State>(reducer, initialState, previousFrame)

    return (
        <global_components.PageWrapper>
            <components.Claim />
            <FrameContainer postUrl="/frames" pathname="/claim" state={state} previousFrame={previousFrame}>
                <FrameImage aspectRatio="1.91:1" src="https://peanut.to/claim-metadata-img.jpg" />
                <FrameButton action="link" target={url.toString()}>
                    Claim
                </FrameButton>
            </FrameContainer>
        </global_components.PageWrapper>
    )
}
