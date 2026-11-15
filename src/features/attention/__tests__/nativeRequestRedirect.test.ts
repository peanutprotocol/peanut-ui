jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => true }))
import { hasPostSignupRedirect } from '../journeyState'
import { chargePayUrl, deepLinkToNativePath } from '@/utils/native-routes'
test('normalized native request-payment links remain post-signup actions', () => {
    const url = chargePayUrl('test-charge')
    expect(deepLinkToNativePath('https://peanut.me/alice/10USDC?chargeId=test-charge')).toBe(url)
    expect(hasPostSignupRedirect(url)).toBe(true)
})

test.each([
    '/home?chargeId=x',
    '/card?chargeId=x',
    '/pay-request?chargeId=',
    '/pay-request#chargeId=x',
    '//other.invalid/pay-request?chargeId=x',
    '/unrelated?chargeId=x',
])('does not defer unrelated or missing request %s', (destination) => {
    expect(hasPostSignupRedirect(destination)).toBe(false)
})
test.each([
    '/pay-request?chargeId=x',
    '/pay-request/?context=card-pioneer&chargeId=x',
    '/pay-request?id=request-pot',
    '/request/pay?id=legacy-charge',
    '/alice/10USDC?chargeId=x',
])('recognizes supported request %s', (destination) => {
    expect(hasPostSignupRedirect(destination)).toBe(true)
})
