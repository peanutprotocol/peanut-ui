# Runtime store country

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

Current consumer: when an OTA needs a newer binary, `isStoreUpdateAvailable()`
(`src/utils/store-update.ts`) decides whether Profile offers the store update.
On iOS it looks the update up in the user's own App Store storefront and offers
nothing while the country is unknown, so until a binary carries this plugin the
iOS store-update prompt never appears.

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
global cache. Do not reuse a retained signup observation for a later availability
decision or put this surface's result in React Query, analytics, or Sentry.
Fetch again for a later decision. Signup geo collection is a separate retained
observation, described below.

## Signup geo retention

The product decision recorded in `dbe878e85` (Slava, 2026-10-28) keeps the store
country in signup geo analytics and sends it to the API. This is an explicit
exception to the transient feature-surface usage above; this document describes
the implemented decision, rather than making a new compliance assessment.

`src/features/setup/country-signals.ts` collects the store country, its
`app-store`/`google-play` source and collection time. It registers
`signup_store_country`, `signup_store_country_source` and
`signup_store_country_collected_at` as PostHog super properties, includes them
in the signup country-signals event, and sets identified person properties.
`src/services/signup-geo.ts` sends the observation as `signup.store` to
`POST /users/me/geo`, for retention in `users.geo`. Pending delivery is persisted
per account in localStorage on web or Capacitor Preferences on native, with a
24-hour delivery window. Missing plugins and unknown results stay unknown.

This observation is neither residence nor financial eligibility. The retained
signup value must not replace a fresh `getStoreCountry()` read for later
store-specific decisions. Provider policy references below remain relevant to
the owner's retention decision.

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
unlock the feature. For signup, verify the retained country/source/time in the
analytics and geo payload, account-scoped pending delivery, and unknown handling;
do not interpret that observation as residence or a later storefront read.

Provider documentation:

- [Apple Storefront](https://developer.apple.com/documentation/storekit/storefront/)
  says storefront information can change and must not be saved with customer
  information or used to develop/enhance customer profiles.
- [Google Play billing configuration](https://developer.android.com/google/play/billing/integrate#query-users-billing-configuration)
  says the returned data is for one-time use, must not be stored, and must not
  be used for profiles or advertising/marketing tracking.
