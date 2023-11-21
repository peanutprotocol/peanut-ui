import { useInitWeb3InboxClient } from '@web3inbox/widget-react'

export const web3inboxIsReady = useInitWeb3InboxClient({
    // The project ID and domain you setup in the Domain Setup section
    projectId: process.env.WC_PROJECT_ID ?? '',
    domain: 'peanut.to',

    // Allow localhost development with "unlimited" mode.
    // This authorizes this dapp to control notification subscriptions for all domains (including `app.example.com`), not just `window.location.host`
    isLimited: false,
})
