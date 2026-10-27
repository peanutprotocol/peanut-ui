import { type IconName } from '../Icons/Icon'

/** `copyKey` picks the copy under `home.postVerification` in the app catalogs. */
export const POST_SIGNUP_ACTIONS = [
    {
        // this regex will match any path that contains the word "claim", this helps in determing if the user is coming from a claim link
        pathPattern: /claim/,
        config: {
            copyKey: 'claim',
            icon: 'check' as IconName,
        },
    },
    {
        // this regex will match any path that resembles the request link, this helps in determing if the user is coming from a request link
        pathPattern: /^\/[^\/]+\/[^\/\?]+\?.*chargeId=/,
        config: {
            copyKey: 'request',
            icon: 'check' as IconName,
        },
    },
] as const
