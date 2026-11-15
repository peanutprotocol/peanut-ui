import { within } from '@testing-library/dom'
import { clearAuthToken } from '@/utils/auth-token'
import { mountCardContinuation } from '../addon-continuation/addon-ui-real-render-adapter'
import { issuedCardOverview } from '../addon-continuation/fixtures'
import type { Identity, Phase, Receipt, VerificationAdapter } from './adapter-contract'

const overviewFor = (identity: Identity) => {
    const overview = issuedCardOverview()
    overview.pendingVerification = { kind: 'card_addon', generation: identity.generation, entryScope: identity.scope }
    return overview
}

export const verificationAdapter: VerificationAdapter = {
    mountIssuedCard: async (identity) => {
        const view = await mountCardContinuation({
            session: { userId: identity.owner },
            overview: overviewFor(identity),
        })
        const phases: Phase[] = []
        const refreshTokens: string[] = []
        await view.settle()
        const capturedRequests = (): Receipt[] =>
            view.requests
                .filter((request) => request.kind === 'resume')
                .map((request, index) => ({
                    phase: phases[index] ?? phases[phases.length - 1],
                    identity: {
                        owner: request.headers['x-kyc-entry-user'],
                        scope: request.headers['x-kyc-entry-scope'],
                        generation: (request.body as { generation: string }).generation,
                    },
                }))
        const setIdentity = async (next: Identity) => {
            await view.setSession({ userId: next.owner })
            await view.publishOverview(overviewFor(next))
            await view.settle()
        }
        return {
            tapPendingVerification: async () => {
                phases.push('start')
                await view.tap(within(view.root).getByText(/^complete verification$/i))
                await view.settle()
            },
            requestSdkRefresh: async () => {
                phases.push('refresh')
                const sdk = view.sdk.sessions.findLast((session) => session.mounted)
                if (!sdk) throw new Error('No mounted SDK session')
                void view.sdk.refresh(sdk.id).then(
                    (token) => {
                        refreshTokens.push(token as string)
                    },
                    () => undefined
                )
                await view.settle()
            },
            deferNext: () => {
                const pending = view.deferNextResume()
                return { deliver: async (token) => pending.reply(200, { token }) }
            },
            clearAuthenticationKeepingRenderedAccount: async () => {
                await actClearAuthentication()
            },
            signIn: setIdentity,
            changeAuthenticatedAccount: setIdentity,
            flush: view.settle,
            observations: () => ({
                requests: capturedRequests(),
                sdkOpenTokens: view.sdk.sessions.map((session) => session.token),
                sdkRefreshTokens: refreshTokens,
                issuanceCalls:
                    view.forbiddenCalls.filter((call) => call.kind === 'issuance' || call.kind === 'create-card')
                        .length +
                    view.requests.filter((request) => request.kind === 'issuance' || request.kind === 'create-card')
                        .length,
                applicationCalls:
                    view.forbiddenCalls.filter((call) => call.kind === 'apply').length +
                    view.requests.filter((request) => request.kind === 'apply').length,
                pendingActionVisible: !!within(view.root).queryByText(/^complete verification$/i),
                blockingOverlayVisible: !!view.root.querySelector('[role="alertdialog"]'),
            }),
            dispose: view.dispose,
        }
    },
}

async function actClearAuthentication() {
    await clearAuthToken()
}
