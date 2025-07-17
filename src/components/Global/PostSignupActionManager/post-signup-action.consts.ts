import { IconName } from '../Icons/Icon'

export const POST_SIGNUP_ACTIONS = [
    {
        // this regex will match any path that contains the word "claim", this helps in determing if the user is coming from a claim link
        pathPattern: /claim/,
        config: {
            title: 'Claim your money',
            description: `You're almost done! Tap Claim Funds to move the money into your new Peanut Wallet.`,
            cta: 'Claim Funds',
            icon: 'dollar' as IconName,
        },
    },
]
