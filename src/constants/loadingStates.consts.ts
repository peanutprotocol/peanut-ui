export type LoadingStates =
    | 'Idle'
    | 'Loading'
    | 'Preparing transaction'
    | 'Approve transaction'
    | 'Sign in wallet'
    | 'Executing transaction'
    | 'Allow network switch'
    | 'Creating link'
    | 'Switching network'
    | 'Fetching route'
    | 'Awaiting route fulfillment'
    | 'Asserting values'
    | 'Generating details'
    | 'Estimating points'
    | 'Getting deposit details'
    | 'Getting KYC status'
    | 'Awaiting TOS confirmation'
    | 'Awaiting KYC confirmation'
    | 'Linking IBAN'
    | 'Linking account'
    | 'Submitting Offramp'
    | 'Getting profile'
    | 'Registering'
    | 'Logging in'
    | 'Logging out'
