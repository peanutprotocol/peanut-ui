// tests for native-routes url helpers

import { isCapacitor } from '@/utils/capacitor'

jest.mock('@/utils/capacitor', () => ({
    isCapacitor: jest.fn(),
}))

const mockIsCapacitor = isCapacitor as jest.MockedFunction<typeof isCapacitor>

import {
    redactNativePath,
    profileUrl,
    sendUrl,
    requestUrl,
    qrClaimUrl,
    qrSuccessUrl,
    chargePayUrl,
    requestPotUrl,
    addMoneyCountryUrl,
    withdrawCountryUrl,
    withdrawBankUrl,
    rewriteMethodPath,
    deepLinkToNativePath,
    isNativeExportPath,
    resolveInAppNavigation,
    NATIVE_EXPORT_ROOTS,
} from '../native-routes'

describe('native-routes', () => {
    afterEach(() => {
        jest.clearAllMocks()
    })

    describe('isNativeExportPath', () => {
        it('accepts roots the export ships, regardless of params or depth', () => {
            expect(isNativeExportPath('/home')).toBe(true)
            expect(isNativeExportPath('/home?x=1')).toBe(true)
            expect(isNativeExportPath('/profile/backup')).toBe(true)
            expect(isNativeExportPath('/shhhhh')).toBe(true)
            expect(isNativeExportPath('/')).toBe(true)
        })

        it('rejects web-only roots (marketing, help, legal, locale prefixes)', () => {
            expect(isNativeExportPath('/en/help')).toBe(false)
            expect(isNativeExportPath('/en/help/fees-pricing?to=ARS')).toBe(false)
            expect(isNativeExportPath('/terms')).toBe(false)
            expect(isNativeExportPath('/blog/some-post')).toBe(false)
            expect(isNativeExportPath('/careers')).toBe(false)
        })
    })

    describe('capacitor mode', () => {
        beforeEach(() => {
            mockIsCapacitor.mockReturnValue(true)
        })

        describe('profileUrl', () => {
            it('should return the query-param public-profile stand-in', () => {
                expect(profileUrl('alice')).toBe('/profile/view?username=alice')
            })
        })

        describe('sendUrl', () => {
            it('should return /send with recipient query param', () => {
                expect(sendUrl('bob')).toBe('/send?recipient=bob')
            })
        })

        describe('requestUrl', () => {
            it('should return /request with recipient query param', () => {
                expect(requestUrl('charlie')).toBe('/request?recipient=charlie')
            })
        })

        describe('qrClaimUrl', () => {
            it('should return /qr with code query param', () => {
                expect(qrClaimUrl('abc123')).toBe('/qr?code=abc123')
            })
        })

        describe('qrSuccessUrl', () => {
            it('should return /qr with code and view=success query params', () => {
                expect(qrSuccessUrl('abc123')).toBe('/qr?code=abc123&view=success')
            })
        })

        describe('addMoneyCountryUrl', () => {
            it('should return /add-money with country query param', () => {
                expect(addMoneyCountryUrl('belgium')).toBe('/add-money?country=belgium')
            })
        })

        describe('withdrawCountryUrl', () => {
            it('should return /withdraw with country query param', () => {
                expect(withdrawCountryUrl('be')).toBe('/withdraw?country=be')
            })

            it('should append extra query params', () => {
                expect(withdrawCountryUrl('be', '?method=ach')).toBe('/withdraw?country=be&method=ach')
            })

            it('should handle query params without leading ?', () => {
                expect(withdrawCountryUrl('be', 'method=ach')).toBe('/withdraw?country=be&method=ach')
            })
        })

        describe('withdrawBankUrl', () => {
            it('should return /withdraw with country and view=bank query params', () => {
                expect(withdrawBankUrl('be')).toBe('/withdraw?country=be&view=bank')
            })

            it('should append extra query params after view=bank', () => {
                expect(withdrawBankUrl('be', '?method=ach')).toBe('/withdraw?country=be&view=bank&method=ach')
            })

            it('should handle query params without leading ?', () => {
                expect(withdrawBankUrl('be', 'method=ach')).toBe('/withdraw?country=be&view=bank&method=ach')
            })
        })

        describe('rewriteMethodPath', () => {
            it('should rewrite /add-money/belgium/bank to query params', () => {
                expect(rewriteMethodPath('/add-money/belgium/bank')).toBe('/add-money?country=belgium&view=bank')
            })

            it('should rewrite /add-money/argentina/manteca to query params', () => {
                expect(rewriteMethodPath('/add-money/argentina/manteca')).toBe(
                    '/add-money?country=argentina&view=manteca'
                )
            })

            it('should rewrite /add-money/belgium (no sub-view) to query params', () => {
                expect(rewriteMethodPath('/add-money/belgium')).toBe('/add-money?country=belgium')
            })

            it('should rewrite /withdraw/be/bank to query params', () => {
                expect(rewriteMethodPath('/withdraw/be/bank')).toBe('/withdraw?country=be&view=bank')
            })

            it('should rewrite /withdraw/be (no sub-view) to query params', () => {
                expect(rewriteMethodPath('/withdraw/be')).toBe('/withdraw?country=be')
            })

            it('should not rewrite /withdraw/manteca (static route)', () => {
                expect(rewriteMethodPath('/withdraw/manteca')).toBe('/withdraw/manteca')
            })

            it('should not rewrite /withdraw/manteca with query params (static route)', () => {
                expect(rewriteMethodPath('/withdraw/manteca?method=pix')).toBe('/withdraw/manteca?method=pix')
            })

            it('should not rewrite /withdraw/crypto (static route)', () => {
                expect(rewriteMethodPath('/withdraw/crypto')).toBe('/withdraw/crypto')
            })

            it('should not rewrite /add-money/crypto or /add-money/us (static routes)', () => {
                expect(rewriteMethodPath('/add-money/crypto')).toBe('/add-money/crypto')
                expect(rewriteMethodPath('/add-money/us')).toBe('/add-money/us')
            })

            it('should append extraParams to rewritten add-money path', () => {
                expect(rewriteMethodPath('/add-money/belgium/bank', 'method=bank')).toBe(
                    '/add-money?country=belgium&view=bank&method=bank'
                )
            })

            it('should append extraParams to rewritten withdraw path', () => {
                expect(rewriteMethodPath('/withdraw/be/bank', 'method=sepa')).toBe(
                    '/withdraw?country=be&view=bank&method=sepa'
                )
            })

            it('should append extraParams to static withdraw routes', () => {
                expect(rewriteMethodPath('/withdraw/manteca', 'method=pix')).toBe('/withdraw/manteca?method=pix')
            })

            it('should append extraParams to non-matching paths', () => {
                expect(rewriteMethodPath('/some/other/path', 'key=val')).toBe('/some/other/path?key=val')
            })

            it('should append extraParams with & when path already has query', () => {
                expect(rewriteMethodPath('/withdraw/manteca?method=pix', 'foo=bar')).toBe(
                    '/withdraw/manteca?method=pix&foo=bar'
                )
            })
        })
    })

    describe('web mode', () => {
        beforeEach(() => {
            mockIsCapacitor.mockReturnValue(false)
        })

        describe('profileUrl', () => {
            it('should return /{username} path', () => {
                expect(profileUrl('alice')).toBe('/alice')
            })
        })

        describe('sendUrl', () => {
            it('should return /send/{username} path', () => {
                expect(sendUrl('bob')).toBe('/send/bob')
            })
        })

        describe('requestUrl', () => {
            it('should return /request/{username} path', () => {
                expect(requestUrl('charlie')).toBe('/request/charlie')
            })
        })

        describe('qrClaimUrl', () => {
            it('should return /qr/{code} path', () => {
                expect(qrClaimUrl('abc123')).toBe('/qr/abc123')
            })
        })

        describe('qrSuccessUrl', () => {
            it('should return /qr/{code}/success path', () => {
                expect(qrSuccessUrl('abc123')).toBe('/qr/abc123/success')
            })
        })

        describe('addMoneyCountryUrl', () => {
            it('should return /add-money/{country} path', () => {
                expect(addMoneyCountryUrl('belgium')).toBe('/add-money/belgium')
            })
        })

        describe('withdrawCountryUrl', () => {
            it('should return /withdraw/{country} path', () => {
                expect(withdrawCountryUrl('be')).toBe('/withdraw/be')
            })

            it('should append query params', () => {
                expect(withdrawCountryUrl('be', '?method=ach')).toBe('/withdraw/be?method=ach')
            })

            it('should return path without query params when none provided', () => {
                expect(withdrawCountryUrl('be')).toBe('/withdraw/be')
            })
        })

        describe('withdrawBankUrl', () => {
            it('should return /withdraw/{country}/bank path', () => {
                expect(withdrawBankUrl('be')).toBe('/withdraw/be/bank')
            })

            it('should append query params', () => {
                expect(withdrawBankUrl('be', '?method=ach')).toBe('/withdraw/be/bank?method=ach')
            })
        })

        describe('rewriteMethodPath', () => {
            it('should return /add-money/belgium/bank unchanged', () => {
                expect(rewriteMethodPath('/add-money/belgium/bank')).toBe('/add-money/belgium/bank')
            })

            it('should return /add-money/argentina/manteca unchanged', () => {
                expect(rewriteMethodPath('/add-money/argentina/manteca')).toBe('/add-money/argentina/manteca')
            })

            it('should return /withdraw/be/bank unchanged', () => {
                expect(rewriteMethodPath('/withdraw/be/bank')).toBe('/withdraw/be/bank')
            })

            it('should return /withdraw/manteca?method=pix unchanged', () => {
                expect(rewriteMethodPath('/withdraw/manteca?method=pix')).toBe('/withdraw/manteca?method=pix')
            })

            it('should return /withdraw/crypto unchanged', () => {
                expect(rewriteMethodPath('/withdraw/crypto')).toBe('/withdraw/crypto')
            })

            it('should return /add-money/crypto unchanged', () => {
                expect(rewriteMethodPath('/add-money/crypto')).toBe('/add-money/crypto')
            })

            it('should append extraParams on web with ? separator', () => {
                expect(rewriteMethodPath('/add-money/belgium/bank', 'method=bank')).toBe(
                    '/add-money/belgium/bank?method=bank'
                )
            })

            it('should append extraParams on web with & when path already has query', () => {
                expect(rewriteMethodPath('/withdraw/manteca?method=pix', 'foo=bar')).toBe(
                    '/withdraw/manteca?method=pix&foo=bar'
                )
            })
        })
    })

    // chargePayUrl and requestPotUrl are native-only (no isCapacitor branching)
    describe('native-only helpers', () => {
        describe('chargePayUrl', () => {
            it('should return /pay-request with chargeId query param', () => {
                expect(chargePayUrl('charge-123')).toBe('/pay-request?chargeId=charge-123')
            })

            it('should include context param when provided', () => {
                expect(chargePayUrl('charge-123', 'home')).toBe('/pay-request?chargeId=charge-123&context=home')
            })

            it('should omit context param when not provided', () => {
                expect(chargePayUrl('charge-456')).toBe('/pay-request?chargeId=charge-456')
            })
        })

        describe('requestPotUrl', () => {
            it('should return /pay-request with id query param', () => {
                expect(requestPotUrl('pot-789')).toBe('/pay-request?id=pot-789')
            })
        })
    })

    describe('deepLinkToNativePath', () => {
        describe('capacitor mode', () => {
            beforeEach(() => {
                mockIsCapacitor.mockReturnValue(true)
            })

            it('accepts a bare path — push payloads carry the deep link without a host', () => {
                expect(deepLinkToNativePath('/receipt/intent-1?kind=ONRAMP')).toBe('/receipt?id=intent-1&kind=ONRAMP')
            })

            it('accepts a full App-Links url', () => {
                expect(deepLinkToNativePath('https://peanut.me/receipt/intent-1?kind=ONRAMP')).toBe(
                    '/receipt?id=intent-1&kind=ONRAMP'
                )
            })

            it('maps a charge deep link onto the pay-request stand-in for the disabled catch-all route', () => {
                expect(deepLinkToNativePath('/alice?chargeId=charge-123')).toBe('/pay-request?chargeId=charge-123')
            })

            // getRequestLink() shape: /<recipient>/<amount><token>?id=<uuid>. This is what
            // an IRL request QR encodes, and the catch-all that serves it on web is stripped
            // from the static export.
            it('maps a request link with an amount segment onto the pay-request stand-in', () => {
                expect(deepLinkToNativePath('/alice/10USDC?id=req-123')).toBe('/pay-request?id=req-123')
                expect(deepLinkToNativePath('/alice/10USDC?chargeId=charge-123')).toBe(
                    '/pay-request?chargeId=charge-123'
                )
            })

            it('maps a bare request link onto the pay-request stand-in', () => {
                expect(deepLinkToNativePath('https://peanut.me/alice?id=req-123')).toBe('/pay-request?id=req-123')
            })

            it('carries the charge context param through', () => {
                expect(deepLinkToNativePath('/alice/10USDC?chargeId=charge-123&context=card-pioneer')).toBe(
                    '/pay-request?chargeId=charge-123&context=card-pioneer'
                )
            })

            it('drops a three-segment path — deeper than any recipient link, no native stand-in', () => {
                expect(deepLinkToNativePath('/alice/10USDC/extra?id=req-123')).toBeNull()
            })

            // The invite landing page is stripped from the native export — an
            // /invite App Link must land on signup with the code riding along.
            it('maps an invite link onto the signup flow, code preserved', () => {
                expect(deepLinkToNativePath('https://peanut.me/invite?code=alice')).toBe(
                    '/setup?step=signup&code=alice'
                )
            })

            // A bare profile link (no chargeId/id) previously fell through to the
            // raw web path — a route the static export doesn't ship — so a scanned
            // or deep-linked peanut.me/<username> dumped the user at home.
            it('maps a bare username onto the in-app public profile', () => {
                expect(deepLinkToNativePath('https://peanut.me/brbalinda')).toBe('/profile/view?username=brbalinda')
                expect(deepLinkToNativePath('/brbalinda')).toBe('/profile/view?username=brbalinda')
            })

            it('maps payment-shaped recipient links onto the send dispatcher', () => {
                expect(deepLinkToNativePath('/alice/10USDC')).toBe('/send?recipient=alice%2F10USDC')
                expect(deepLinkToNativePath('/0x36eA9C25FA1fa0e5ea15b02cFa1d4CAaeBFa2Cf5@42161/34.4USDC')).toBe(
                    '/send?recipient=0x36eA9C25FA1fa0e5ea15b02cFa1d4CAaeBFa2Cf5%4042161%2F34.4USDC'
                )
                expect(deepLinkToNativePath('/0x36eA9C25FA1fa0e5ea15b02cFa1d4CAaeBFa2Cf5')).toBe(
                    `/send?recipient=${encodeURIComponent('0x36eA9C25FA1fa0e5ea15b02cFa1d4CAaeBFa2Cf5')}`
                )
            })

            it('funnels a semantic pay path (user@chain/amount) into /send?recipient=', () => {
                expect(deepLinkToNativePath('/alice@42161/10usdc')).toBe(
                    `/send?recipient=${encodeURIComponent('alice@42161/10usdc')}`
                )
            })

            it('drops a non-recipient web-only path instead of passing it through', () => {
                expect(deepLinkToNativePath('/not-a-valid.username')).toBeNull()
            })

            it.each(['/rewards', '/history'])('leaves the reserved route %s alone even with an id param', (route) => {
                expect(deepLinkToNativePath(`${route}?id=req-123`)).toBe(`${route}?id=req-123`)
            })

            // The claim password lives only in the fragment — losing it lands the user on an
            // empty claim form.
            it('preserves the fragment on a claim link', () => {
                expect(deepLinkToNativePath('https://peanut.me/claim?c=8453&v=v4.2&i=7#p=s3cret')).toBe(
                    '/claim?c=8453&v=v4.2&i=7#p=s3cret'
                )
            })

            it('leaves a static in-app route untouched', () => {
                expect(deepLinkToNativePath('https://peanut.me/history')).toBe('/history')
            })

            it('still rewrites dynamic routes to their query-param form', () => {
                expect(deepLinkToNativePath('https://peanut.me/send/bob')).toBe('/send?recipient=bob')
                expect(deepLinkToNativePath('https://peanut.me/qr/abc123')).toBe('/qr?code=abc123')
                expect(deepLinkToNativePath('https://peanut.me/withdraw/be/bank')).toBe(
                    '/withdraw?country=be&view=bank'
                )
            })

            // The invite landing page is pruned from the native export, so an
            // App Link onto it must land on signup instead of a chunk-error
            // loop. The code rides the params (setup persists it) and the
            // invite cookie (openDeepLink) as a belt-and-suspenders.
            it('rewrites /invite to signup — the landing page is not in the export', () => {
                expect(deepLinkToNativePath('https://peanut.me/invite?code=kushagra')).toBe(
                    '/setup?step=signup&code=kushagra'
                )
                expect(deepLinkToNativePath('/invite')).toBe('/setup?step=signup')
            })

            // The claim-link password lives in the fragment and is never sent to
            // the server (see peanut-link.utils.ts), so dropping it here yields a
            // link that resolves to a claim page with no way to claim.
            it('preserves the claim-link password fragment', () => {
                expect(deepLinkToNativePath('https://peanut.me/claim?c=42161&v=v4.2&i=99#p=s3cr3t')).toBe(
                    '/claim?c=42161&v=v4.2&i=99#p=s3cr3t'
                )
            })

            it('preserves a fragment on a bare path from a push payload', () => {
                expect(deepLinkToNativePath('/claim?i=99#p=s3cr3t')).toBe('/claim?i=99#p=s3cr3t')
            })

            it('carries the fragment through a dynamic-route rewrite', () => {
                expect(deepLinkToNativePath('https://peanut.me/send/bob#p=s3cr3t')).toBe('/send?recipient=bob#p=s3cr3t')
                expect(deepLinkToNativePath('https://peanut.me/withdraw/be/bank#top')).toBe(
                    '/withdraw?country=be&view=bank#top'
                )
            })

            it('adds no stray # when the link has no fragment', () => {
                expect(deepLinkToNativePath('https://peanut.me/claim?i=99')).toBe('/claim?i=99')
                expect(deepLinkToNativePath('https://peanut.me/history')).toBe('/history')
            })

            it('still rejects an off-host link that carries a fragment', () => {
                expect(deepLinkToNativePath('https://evil.com/claim?i=99#p=s3cr3t')).toBeNull()
            })

            it('rejects an off-domain url rather than rewriting it into an in-app path', () => {
                expect(deepLinkToNativePath('https://evil.com/receipt/intent-1')).toBeNull()
            })

            it('returns null for an unparseable link', () => {
                expect(deepLinkToNativePath('http://')).toBeNull()
            })

            // This runs during render in the notifications list, so a throw here
            // would blank the whole page rather than drop one bad row.
            it.each([
                ['receipt id', '/receipt/%E0%A4%A'],
                ['send recipient', '/send/%E0%A4%A'],
                ['qr code', '/qr/%'],
                ['bare username', '/%'],
            ])('never throws on malformed percent-encoding in the %s', (_label, link) => {
                expect(() => deepLinkToNativePath(link)).not.toThrow()
            })

            it.each(['/receipt/%E0%A4%A', '/send/%E0%A4%A', '/qr/%'])(
                'degrades %s to null when the decode fails mid-mapping',
                (link) => {
                    expect(deepLinkToNativePath(link)).toBeNull()
                }
            )

            it.each(['/rewards', '/history', '/badges', '/profile'])(
                'leaves the reserved route %s alone even with a chargeId param',
                (route) => {
                    expect(deepLinkToNativePath(`${route}?chargeId=charge-123`)).toBe(`${route}?chargeId=charge-123`)
                }
            )
        })

        describe('web mode', () => {
            beforeEach(() => {
                mockIsCapacitor.mockReturnValue(false)
            })

            it('keeps /invite on the web — the landing page exists there', () => {
                expect(deepLinkToNativePath('https://peanut.me/invite?code=kushagra')).toBe('/invite?code=kushagra')
            })

            it('keeps the path-based receipt url', () => {
                expect(deepLinkToNativePath('https://peanut.me/receipt/intent-1?kind=ONRAMP')).toBe(
                    '/receipt/intent-1?kind=ONRAMP'
                )
            })

            it('keeps a profile charge link on the profile route', () => {
                expect(deepLinkToNativePath('/alice?chargeId=charge-123')).toBe('/alice?chargeId=charge-123')
            })

            it('preserves the claim-link password fragment', () => {
                expect(deepLinkToNativePath('https://peanut.me/claim?c=42161&v=v4.2&i=99#p=s3cr3t')).toBe(
                    '/claim?c=42161&v=v4.2&i=99#p=s3cr3t'
                )
            })
        })
    })

    // 2026-08 native-links review coverage: the "My QR" payload, the legacy
    // /request/pay shape, bare-origin push links, static add-money subroutes,
    // and web-only roots.
    describe('deepLinkToNativePath — review additions', () => {
        describe('capacitor mode', () => {
            beforeEach(() => {
                mockIsCapacitor.mockReturnValue(true)
            })

            it('maps /pay/<user> — the "My QR" payload — onto the send dispatcher', () => {
                expect(deepLinkToNativePath('https://peanut.me/pay/alice')).toBe('/send?recipient=alice')
            })

            // payLinkUrl() shape: /pay/<recipient>[/<amount><token>]?id=|?chargeId=.
            // The root catch-all that used to serve these is claimed by neither the
            // AASA nor the Android filter, so shared links now ride the /pay prefix.
            it('maps a /pay request link onto the pay-request stand-in', () => {
                expect(deepLinkToNativePath('https://peanut.me/pay/alice/10USDC?id=req-123')).toBe(
                    '/pay-request?id=req-123'
                )
                expect(deepLinkToNativePath('https://peanut.me/pay/alice?id=req-123')).toBe('/pay-request?id=req-123')
                expect(deepLinkToNativePath('https://peanut.me/pay/alice/10USDC?chargeId=charge-123')).toBe(
                    '/pay-request?chargeId=charge-123'
                )
            })

            it('carries the charge context param through a /pay link', () => {
                expect(
                    deepLinkToNativePath('https://peanut.me/pay/alice?chargeId=charge-123&context=card-pioneer')
                ).toBe('/pay-request?chargeId=charge-123&context=card-pioneer')
            })

            it('funnels an amount-shaped /pay link with no charge into the send dispatcher', () => {
                expect(deepLinkToNativePath('https://peanut.me/pay/alice/10USDC')).toBe(
                    '/send?recipient=alice%2F10USDC'
                )
            })

            it('maps legacy /request/pay?id=<chargeUuid> as a CHARGE, not user "pay"', () => {
                expect(deepLinkToNativePath('https://peanut.me/request/pay?id=charge-123')).toBe(
                    '/pay-request?chargeId=charge-123'
                )
            })

            it('still maps /request/<user> to the request screen', () => {
                expect(deepLinkToNativePath('https://peanut.me/request/alice')).toBe('/request?recipient=alice')
            })

            it('maps the bare-origin shapes legacy pushes and inbox rows carry', () => {
                expect(deepLinkToNativePath('https://peanut.me?id=req-123')).toBe('/pay-request?id=req-123')
                expect(deepLinkToNativePath('https://peanut.me/?chargeId=charge-123')).toBe(
                    '/pay-request?chargeId=charge-123'
                )
            })

            it('drops the truly bare origin', () => {
                expect(deepLinkToNativePath('https://peanut.me')).toBeNull()
            })

            it('keeps the static add-money subroutes instead of rewriting them to ?country=', () => {
                expect(deepLinkToNativePath('/add-money/crypto')).toBe('/add-money/crypto')
                expect(deepLinkToNativePath('/add-money/us')).toBe('/add-money/us')
            })

            it('returns null for web-only roots so the caller opens them in the in-app browser', () => {
                expect(deepLinkToNativePath('https://peanut.me/help')).toBeNull()
                // retired /quests: reserved in STATIC_REDIRECT_ROUTES, so it must
                // never be read as a recipient — the in-app browser opens the web
                // URL, whose redirects.json entry lands on the homepage.
                expect(deepLinkToNativePath('https://peanut.me/quests')).toBeNull()
                expect(deepLinkToNativePath('https://peanut.me/quests/most_invites')).toBeNull()
                expect(deepLinkToNativePath('https://peanut.me/blog/some-post')).toBeNull()
                expect(deepLinkToNativePath('https://peanut.me/terms')).toBeNull()
                expect(deepLinkToNativePath('https://peanut.me/es-419/pricing')).toBeNull()
                expect(deepLinkToNativePath('https://peanut.me/foodie')).toBeNull()
            })

            it('keeps roots the native export ships', () => {
                expect(deepLinkToNativePath('https://peanut.me/home')).toBe('/home')
                expect(deepLinkToNativePath('https://peanut.me/card')).toBe('/card')
                expect(deepLinkToNativePath('https://peanut.me/pay-request?chargeId=x')).toBe('/pay-request?chargeId=x')
                // outside (mobile-ui) but shipped in the export and linked from /profile
                expect(deepLinkToNativePath('https://peanut.me/shhhhh')).toBe('/shhhhh')
            })
        })

        describe('web mode', () => {
            beforeEach(() => {
                mockIsCapacitor.mockReturnValue(false)
            })

            it('maps /pay/<user> to the send route (mirror of the web page redirect)', () => {
                expect(deepLinkToNativePath('https://peanut.me/pay/alice')).toBe('/send/alice')
            })

            // On web the /pay catch-all renders the payment page itself, so a link
            // carrying payment context must reach it rather than be rewritten away
            // — /send/<user>/<amount> drops the amount segment.
            it('leaves a /pay payment link alone on web', () => {
                expect(deepLinkToNativePath('https://peanut.me/pay/alice/10USDC?id=req-123')).toBe(
                    '/pay/alice/10USDC?id=req-123'
                )
                expect(deepLinkToNativePath('https://peanut.me/pay/alice/10USDC')).toBe('/pay/alice/10USDC')
            })

            it('maps legacy /request/pay?id= to pay-request on web too', () => {
                expect(deepLinkToNativePath('https://peanut.me/request/pay?id=charge-123')).toBe(
                    '/pay-request?chargeId=charge-123'
                )
            })

            it('keeps web-only roots as-is', () => {
                expect(deepLinkToNativePath('https://peanut.me/help')).toBe('/help')
            })

            it('maps the bare-origin id shape to pay-request', () => {
                expect(deepLinkToNativePath('https://peanut.me?id=req-123')).toBe('/pay-request?id=req-123')
            })
        })
    })

    /*
     * AASA drift guard: every path root claimed for the app in
     * public/.well-known/apple-app-site-association must map to a native page
     * (directly or via a rewrite). A root added to the AASA without a mapper
     * branch ships an App Link that cold-boots the app to /home — the exact
     * class of bug the 2026-08 native-links review closed. The Android
     * intent-filter list mirrors the AASA, so this guards both platforms.
     */
    describe('AASA path list maps into the native export', () => {
        beforeEach(() => {
            mockIsCapacitor.mockReturnValue(true)
        })

        // extension-less JSON — require() won't parse it
        const { readFileSync } = require('fs')
        const { join } = require('path')
        const aasa = JSON.parse(
            readFileSync(join(process.cwd(), 'public/.well-known/apple-app-site-association'), 'utf8')
        )
        const roots = new Set<string>(
            aasa.applinks.details
                .flatMap((d: { paths: string[] }) => d.paths)
                .map((p: string) => p.split('/').filter(Boolean)[0])
                .filter(Boolean)
        )

        // A representative deep link per claimed root — dynamic roots get a
        // realistic sample; static roots are tested bare.
        const SAMPLE_BY_ROOT: Record<string, string> = {
            claim: '/claim?c=42161&v=v4.2&i=99#p=pw',
            pay: '/pay/alice',
            'pay-request': '/pay-request?chargeId=x',
            send: '/send/alice',
            request: '/request/alice',
            qr: '/qr/CODE123',
            'add-money': '/add-money/belgium/bank',
            withdraw: '/withdraw/be/bank',
            receipt: '/receipt/intent-1?kind=ONRAMP',
            profile: '/profile',
            invite: '/invite?code=alice',
        }

        it.each([...roots])('claimed root %s resolves to a native path', (root) => {
            const sample = SAMPLE_BY_ROOT[root] ?? `/${root}`
            expect(deepLinkToNativePath(`https://peanut.me${sample}`)).not.toBeNull()
        })
    })
})

/*
 * Export drift guard: NATIVE_EXPORT_ROOTS is a hand-written list of what the
 * native static export ships. It once carried `notifications`, a route that
 * never existed. Derive the exported page roots from src/app minus what
 * scripts/native-build.js disables, and pin the two against each other.
 */
describe('NATIVE_EXPORT_ROOTS matches the pages the native export ships', () => {
    const { existsSync, readdirSync, statSync } = require('fs')
    const { join } = require('path')
    const { ITEMS_TO_DISABLE } = require('../../../scripts/native-build.js') as {
        ITEMS_TO_DISABLE: Array<{ path: string; type: 'dir' | 'file' }>
    }
    const APP_DIR = join(process.cwd(), 'src/app')
    const disabled = new Set(ITEMS_TO_DISABLE.map((item) => item.path))
    const PAGE_FILE = /^page\.(tsx|ts|jsx|js)$/

    // Exported, deliberately not in NATIVE_EXPORT_ROOTS:
    // - `app`: the smart store link. It must open externally, never be pushed
    //   in-app, so isNativeExportPath must keep saying no.
    // - `dev`: pruneExportedAssets() strips every /dev page but /dev/deferred,
    //   which is reached through the AASA, not from in-app anchors.
    const WEB_ONLY_EXPORTED = ['app', 'dev']

    // A directory counts once it has a page file anywhere below it that the
    // native build does not disable — a disabled page/dir contributes nothing.
    function hasExportedPage(dir: string, rel: string): boolean {
        if (disabled.has(rel)) return false
        for (const entry of readdirSync(dir)) {
            const entryRel = rel ? `${rel}/${entry}` : entry
            if (disabled.has(entryRel)) continue
            const full = join(dir, entry)
            if (statSync(full).isDirectory()) {
                if (hasExportedPage(full, entryRel)) return true
            } else if (PAGE_FILE.test(entry)) {
                return true
            }
        }
        return false
    }

    function exportedRoots(): Set<string> {
        const roots = new Set<string>()
        for (const group of ['(mobile-ui)', '(setup)', '']) {
            const base = join(APP_DIR, group)
            for (const entry of readdirSync(base)) {
                const full = join(base, entry)
                if (!statSync(full).isDirectory()) continue
                // route groups only at the top level (handled above); dynamic
                // segments have no static root of their own
                if (entry.startsWith('(') || entry.startsWith('[') || entry === '__tests__') continue
                const rel = group ? `${group}/${entry}` : entry
                if (hasExportedPage(full, rel)) roots.add(entry)
            }
        }
        return roots
    }

    const onDisk = exportedRoots()

    it.each([...NATIVE_EXPORT_ROOTS].sort())('listed root %s has a page in the export', (root) => {
        expect(onDisk.has(root)).toBe(true)
    })

    it.each([...onDisk].sort())('exported root %s is listed or explicitly web-only', (root) => {
        expect(NATIVE_EXPORT_ROOTS.has(root) || WEB_ONLY_EXPORTED.includes(root)).toBe(true)
    })

    it('keeps the web-only allowlist honest', () => {
        for (const root of WEB_ONLY_EXPORTED) {
            expect(onDisk.has(root)).toBe(true)
            expect(NATIVE_EXPORT_ROOTS.has(root)).toBe(false)
        }
        expect(existsSync(join(APP_DIR, '(mobile-ui)/notifications'))).toBe(false)
    })
})

/*
 * The receipt's Pay CTA assigned an absolute peanut.me URL to window.location —
 * an off-origin top-level navigation the Capacitor WebView hands to the OS.
 */
describe('resolveInAppNavigation', () => {
    describe('capacitor mode', () => {
        beforeEach(() => mockIsCapacitor.mockReturnValue(true))

        it('pushes the native stand-in for a request link', () => {
            expect(resolveInAppNavigation('https://peanut.me/alice?chargeId=abc')).toEqual({
                kind: 'push',
                path: '/pay-request?chargeId=abc',
            })
            expect(resolveInAppNavigation('https://peanut.me/alice/5usdc?id=pot-1')).toEqual({
                kind: 'push',
                path: '/pay-request?id=pot-1',
            })
        })

        it('pushes a bare in-app path unchanged', () => {
            expect(resolveInAppNavigation('/pay-request?chargeId=abc')).toEqual({
                kind: 'push',
                path: '/pay-request?chargeId=abc',
            })
        })

        it('hands a peanut.me page the export does not ship to the browser', () => {
            expect(resolveInAppNavigation('https://peanut.me/en/help')).toEqual({
                kind: 'external',
                url: 'https://peanut.me/en/help',
            })
        })

        // The link is a caller-supplied baseUrl persisted by the charge API, so
        // only an https Peanut origin may leave the app; anything else is dropped.
        it.each([
            ['an off-domain https link', 'https://example.com/pay'],
            ['a look-alike host', 'https://peanut.me.evil.example/pay'],
            ['a javascript: url', 'javascript:alert(1)'],
            ['a data: url', 'data:text/html,<script>alert(1)</script>'],
            ['a plain http peanut link', 'http://peanut.me/en/help'],
        ])('refuses to open %s', (_name, link) => {
            expect(resolveInAppNavigation(link)).toBeNull()
        })

        it('returns null for an empty or unparseable link', () => {
            expect(resolveInAppNavigation('')).toBeNull()
            expect(resolveInAppNavigation('not a url')).toBeNull()
        })
    })

    describe('web mode', () => {
        beforeEach(() => mockIsCapacitor.mockReturnValue(false))

        it('pushes the path of a same-origin link, query and fragment included', () => {
            expect(resolveInAppNavigation(`${window.location.origin}/alice?chargeId=abc#x`)).toEqual({
                kind: 'push',
                path: '/alice?chargeId=abc#x',
            })
        })

        it('pushes a relative path', () => {
            expect(resolveInAppNavigation('/alice?chargeId=abc')).toEqual({
                kind: 'push',
                path: '/alice?chargeId=abc',
            })
        })

        it('hands an https peanut.me link that is not same-origin to the browser', () => {
            expect(resolveInAppNavigation('https://app.peanut.me/en/help')).toEqual({
                kind: 'external',
                url: 'https://app.peanut.me/en/help',
            })
        })

        it.each([
            ['another origin', 'https://example.com/pay'],
            ['a javascript: url', 'javascript:alert(1)'],
            ['a data: url', 'data:text/html,hi'],
        ])('refuses to open %s', (_name, link) => {
            expect(resolveInAppNavigation(link)).toBeNull()
        })

        it('returns null for an empty link', () => {
            expect(resolveInAppNavigation('')).toBeNull()
        })
    })
})

describe('redactNativePath (deep-link telemetry)', () => {
    // The BLOCKING finding: the code lives in a path segment, so stripping
    // only query and fragment left an unclaimed, claimable QR code readable
    // in analytics.
    it('replaces a QR code in the path with a placeholder', () => {
        expect(redactNativePath('https://peanut.me/qr/aB3xK9mQ2pL7vN4z')).toBe('https://peanut.me/qr/:id')
    })

    it('replaces the code but keeps a known static sub-view', () => {
        expect(redactNativePath('/qr/aB3xK9mQ2pL7vN4z/success')).toBe('/qr/:id/success')
    })

    it('still drops the query and the fragment', () => {
        expect(redactNativePath('/claim?c=8453&v=v4.2#p=SUPERSECRET')).toBe('/claim')
    })

    it('redacts other identifier-bearing routes', () => {
        expect(redactNativePath('/receipt/9f1c2b3a')).toBe('/receipt/:id')
        expect(redactNativePath('/profile/somebody')).toBe('/profile/:id')
        expect(redactNativePath('/claim/abc123')).toBe('/claim/:id')
    })

    it('keeps a bare route family unchanged', () => {
        expect(redactNativePath('https://peanut.me/home')).toBe('https://peanut.me/home')
        expect(redactNativePath('/settings')).toBe('/settings')
    })

    it('keeps the country placeholder out but preserves the view', () => {
        expect(redactNativePath('/add-money/belgium/bank')).toBe('/add-money/:id/bank')
    })

    // Fail closed: a route that is not declared must degrade to a placeholder
    // rather than pass an unknown identifier through.
    it('redacts an undeclared root instead of trusting it', () => {
        expect(redactNativePath('/not-a-declared-route/secret-value')).toBe('/:id/:id')
    })

    // The API allows usernames such as `bank` or `crypto`, and `/<username>` is
    // a profile link — a safe sub-view token must not leak one from the
    // identifier position.
    it('keeps safe sub-view tokens only in the sub-view position', () => {
        expect(redactNativePath('https://peanut.me/bank')).toBe('https://peanut.me/:id')
        expect(redactNativePath('/profile/crypto')).toBe('/profile/:id')
        expect(redactNativePath('/manteca/success')).toBe('/:id/:id')
        expect(redactNativePath('/add-money/us/bank')).toBe('/add-money/:id/bank')
        expect(redactNativePath('/withdraw/manteca')).toBe('/withdraw/:id')
    })

    // The authority can carry userinfo, which is attacker-controlled on a link
    // and would otherwise survive into `raw` next to the redacted path.
    it('drops userinfo from the authority', () => {
        expect(redactNativePath('https://CLAIM_SECRET@peanut.me/qr/aB3xK9mQ2pL7vN4z')).toBe('https://peanut.me/qr/:id')
        expect(redactNativePath('https://user:pass@peanut.me/home')).toBe('https://peanut.me/home')
    })

    // A locale or other prefix must not shift the root out of a positional
    // window and turn the whole path into placeholders.
    it('finds the route family behind a prefix segment', () => {
        expect(redactNativePath('/es/qr/aB3xK9mQ2pL7vN4z')).toBe('/:id/qr/:id')
    })

    it('preserves a custom scheme host', () => {
        expect(redactNativePath('peanut://qr/aB3xK9mQ2pL7vN4z')).toBe('peanut://qr/:id')
    })

    it('handles a trailing slash and an empty path', () => {
        expect(redactNativePath('/qr/')).toBe('/qr/')
        expect(redactNativePath('/')).toBe('/')
        expect(redactNativePath('')).toBe('')
    })
})
