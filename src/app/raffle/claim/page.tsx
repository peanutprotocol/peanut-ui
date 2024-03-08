import * as global_components from '@/components/global'
import * as components from '@/components'
import { Metadata } from 'next'
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

export default function RafflePage({ searchParams }: NextServerPageProps) {
    const previousFrame = getPreviousFrame<State>(searchParams)

    const [state, dispatch] = useFramesReducer<State>(reducer, initialState, previousFrame)
    return (
        <global_components.PageWrapper bgColor="bg-red">
            <components.RaffleClaim />
            <FrameContainer postUrl="/frames" pathname="/" state={state} previousFrame={previousFrame}>
                <FrameImage aspectRatio="1.91:1" src="https://peanut.to/raffle-metadata-img.png" />

                <FrameButton action="link" target={'/'}>
                    Claim
                </FrameButton>
            </FrameContainer>
        </global_components.PageWrapper>
    )
}
