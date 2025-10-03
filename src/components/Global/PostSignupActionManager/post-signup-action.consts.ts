import { IconName } from '../Icons/Icon'

export const POST_SIGNUP_ACTIONS = [
    {
        // this regex will match any path that contains the word "claim", this helps in determing if the user is coming from a claim link
        pathPattern: /claim/,
        config: {
            title: 'Verification complete!',
            description: `Your identity has been successfully verified. You can now claim money directly to your bank account.`,
            cta: 'Claim to bank',
            icon: 'check' as IconName,
        },
    },
    {
        // this regex will match any path that resembles the request link, this helps in determing if the user is coming from a request link
        pathPattern: /^\/[^\/]+\/[^\/\?]+\?.*chargeId=/,
        config: {
            title: 'Verification complete!',
            description: `Your identity has been successfully verified. You can now send the money your friend requested!`,
            cta: 'Send it!',
            icon: 'check' as IconName,
        },
    },
]
