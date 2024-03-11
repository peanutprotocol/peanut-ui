import * as components from '@/components'
import { Metadata } from 'next'
import {
    FrameButton,
    FrameContainer,
    FrameImage,
    FrameReducer,
    getPreviousFrame,
    useFramesReducer,
} from 'frames.js/next/server'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
    title: 'Peanut Protocol',
    description: `You've received a slot in a raffle!`,
    metadataBase: new URL('https://peanut.to'),

    icons: {
        icon: '/logo-favicon.png',
    },
    openGraph: {
        images: [
            {
                url: '/raffle-metadata-img.png',
            },
        ],
    },
    twitter: {
        images: [
            {
                url: '/raffle-metadata-img.png',
            },
        ],
    },
}
type Props = {
    params: { id: string }
    searchParams: { [key: string]: string | string[] | undefined }
}

function createURL(searchParams: { [key: string]: string | string[] | undefined }): string {
    const baseURL = `https://peanut.to/raffle/claim`

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

export default async function RafflePage({ searchParams, params }: Props) {
    let url = ''
    let previousFrame: any = {}
    try {
        url = createURL(searchParams)
        previousFrame = getPreviousFrame<State>(searchParams)
    } catch (error) {
        console.log('Error creating URL', error)
    }

    const [state] = useFramesReducer<State>(reducer, initialState, previousFrame)
    return (
        <>
            <components.RaffleClaim />
            <FrameContainer postUrl="/frames" pathname="/raffle/claim" state={state} previousFrame={previousFrame}>
                <FrameImage aspectRatio="1.91:1" src="https://staging.peanut.to/raffle-metadata-img.png" />

                <FrameButton action="link" target={url.toString()}>
                    Claim
                </FrameButton>
            </FrameContainer>
        </>
    )
}
