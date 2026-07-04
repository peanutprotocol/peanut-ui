import { fetchWithSentry } from '@/utils/sentry.utils'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { PEANUT_API_URL } from '@/constants/general.consts'
export const dynamic = 'force-dynamic'

// TEAMID.bundleid for the native iOS wallet app. iOS only grants passkeys
// (webcredentials) and universal links (applinks) to apps listed in the AASA;
// the upstream source (peanut-universal-linking-files) does not yet include it,
// so we guarantee its presence here until that repo is updated.
const IOS_WALLET_APP_ID = 'PW388G893L.me.peanut.wallet'

type AASA = {
    applinks?: { apps?: string[]; details?: Array<{ appID?: string; appIDs?: string[]; paths?: string[] }> }
    webcredentials?: { apps?: string[] }
    activitycontinuation?: { apps?: string[] }
}

const withIosWalletApp = (data: AASA): AASA => {
    const details = data.applinks?.details ?? []
    const hasAppLink = details.some((d) => d.appID === IOS_WALLET_APP_ID || d.appIDs?.includes(IOS_WALLET_APP_ID))

    return {
        ...data,
        applinks: {
            ...data.applinks,
            apps: data.applinks?.apps ?? [],
            details: hasAppLink ? details : [...details, { appID: IOS_WALLET_APP_ID, paths: ['*'] }],
        },
        webcredentials: { apps: [...new Set([...(data.webcredentials?.apps ?? []), IOS_WALLET_APP_ID])] },
        activitycontinuation: { apps: [...new Set([...(data.activitycontinuation?.apps ?? []), IOS_WALLET_APP_ID])] },
    }
}

export async function GET(_request: NextRequest) {
    const response = await fetchWithSentry(`${PEANUT_API_URL}/apple-app-site-association`)
    const data = (await response.json()) as AASA
    return NextResponse.json(withIosWalletApp(data), {
        status: 200,
    })
}
