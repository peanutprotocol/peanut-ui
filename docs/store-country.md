# Store country

Use `getStoreCountry()` from `src/utils/store-country.ts` immediately before a
store-specific product-availability decision. It returns either
`{ countryCode: 'US', source: 'app-store' }`,
`{ countryCode: 'BR', source: 'google-play' }`, or `null` (unknown).
Both platforms return ISO 3166-1 alpha-2 codes to JavaScript.

This is the **current account/store region**, not original download country,
physical location, installation-source proof, declared residence, or verified
financial eligibility. Existing residence/KYC/provider checks remain authoritative.
No country-specific features are enabled by this bridge alone; product rules must
explicitly define allowed countries and what to do when the answer is unknown.
Never grant a store-restricted feature on unknown/loading, or replace unknown with
an IP, locale, SIM, or timezone guess.

## Use in a feature surface

```tsx
const { country, isLoading, refresh } = useStoreCountry()
// For display: use an explicit product allowlist and require a known country.
const showFeature = !isLoading && country !== null && allowedCountries.has(country.countryCode)
// For a subsequent decision/action: await refresh() and evaluate that result.
```

Mount `useStoreCountry()` only where needed. It reads on mount and foreground,
clears on background and while refreshing, and ignores superseded/late reads.
Its value lives only in component memory for the current surface. It is not a
global cache. Fetch again for a later decision. A saved signup observation describes
the store region at signup and must not replace this fresh runtime read.

## Signup capture and analytics

The signup country-signal collector calls `getStoreCountry()` once at setup entry,
alongside the Vercel IP and device signals. It retains a separate observation with
these PostHog properties:

- `signup_store_country`: normalized ISO alpha-2 country, or `null` when unknown.
- `signup_store_country_source`: `app-store`, `google-play`, or `null`.
- `signup_store_country_collected_at`: ISO timestamp when the country was read,
  or `null` when unknown.

These properties are saved on `signup_country_signals_captured` events, registered
with the other signup properties, and attached to the identified analytics user.
The signup completion event includes the latest available snapshot. A store read
that finishes after identification also updates the identified user's properties.
This supports product analytics and fraud investigation alongside the other signals.

Collection does not block the setup screens or account completion. Store errors,
timeouts, older binaries, and web/PWA builds leave store country unknown.
Vercel/IP country suggestions and user-confirmed residence remain independent of
store country. This PR does not add geo fields to the API user model.

## Native implementations

- iOS: `StoreCountryPlugin.swift` reads `await Storefront.current`, returning
  StoreKit's alpha-3 code, normalized in JS. Registered by `AppViewController`
  and included in the Xcode app target.
- Android: `StoreCountryPlugin.java` reads
  `BillingClient.getBillingConfigAsync()` after connecting to Google Play,
  returning Play's alpha-2 code. Registered by `MainActivity`, using Billing
  Library 8.3.0. It launches no purchase flow and sets no account identifiers.
  Only one connection is active; concurrent callers queue separate fresh reads.
  The 5-second deadline includes queue time. Every completed read closes the
  connection. There is no result cache.
- Native queries time out after 5 seconds. JavaScript has a 6-second watchdog.
  Errors, disconnects, missing country, web/PWA, and old native shells missing
  the plugin resolve to unknown without blocking app startup.

New iOS and Android **store binaries** are required; an OTA update alone cannot
add either native plugin. Keep consumers tolerant of unknown for older installs.

## Verification before release

On store-enabled iOS/Android devices, check a known account region against the
returned value. Background the app, change the store account region where
supported, return, and verify a fresh read. Check a device without a signed-in
store account, Play service unavailable/unsupported responses, offline reads,
an old binary running the new JS, and a web/PWA build. Confirm unknown does not
unlock the feature. Complete signup and verify that the three store properties
include the correct country, source, and observation timestamp in PostHog.

Provider documentation:

- [Apple Storefront](https://developer.apple.com/documentation/storekit/storefront/)
- [Google Play billing configuration](https://developer.android.com/google/play/billing/integrate#query-users-billing-configuration)
