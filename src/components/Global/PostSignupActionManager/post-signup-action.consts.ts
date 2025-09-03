import { IconName } from '../Icons/Icon'

export const POST_SIGNUP_ACTIONS = [
    {
        // this regex will match any path that contains the word "claim", this helps in determing if the user is coming from a claim link
        pathPattern: /claim/,
        config: {
            title: 'Identity verification required',
            description: `To claim money to your bank account, you’ll need to complete a quick identity verification.`,
            cta: 'Start verification',
            icon: 'dollar' as IconName,
        },
    },
]
