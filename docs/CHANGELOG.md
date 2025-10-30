# Changelog

All notable changes should be documented in this file. Be concise.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Points System V2** with tier-based progression (0-4 Tier)
- **QR Payment Perks** with tier-based eligibility and merchant promotions
- Hold-to-claim interaction for perks with progressive screen shake animation
- PWA haptic feedback that intensifies during perk claiming
- Activity feed perk indicators with yellow star icons and strikethrough amounts
- Transaction details "Peanut got you!" banner for claimed perks
- Dev tools page (`/dev/shake-test`) for testing animations and haptics

### Changed

- QR payment flow now fetches payment locks in parallel with KYC checks for latency reduction
- Perk claiming uses optimistic UI updates for instant feedback (claim happens in background)
- Dev pages excluded from production builds for faster compile times
- Removed Points V1 legacy fields from `Account` and `IUserProfile` interfaces

### Fixed

- BigInt type handling in points balance calculations (backend)
- Perk status now correctly reflects `PENDING_CLAIM` vs `CLAIMED` states in activity feed
- Modal focus outline artifacts on initial load
- `crypto.randomUUID` polyfill for older Node.js environments in SSR
- **"Malformed link" race condition**: Added retry logic using TanStack Query (3 attempts with 1-2s delays) on claim side when opening very fresh links. Keeps showing loading state instead of immediate error. Uses existing TanStack Query dependency for automatic retry with linear backoff.
- **Auto-refreshing balance**: Balance now automatically refreshes every 30 seconds and when app regains focus
- **Real-time transaction history**: New transactions appear instantly via WebSocket integration with TanStack Query cache
- **Optimistic updates**: Sending money now shows instant UI feedback with automatic rollback on error
- **🐛 Critical: Unrecoverable loading state and stale passkey errors** - Fixed infinite loading when passkey registration succeeded but backend user creation failed. Fixed AA24 signature errors and "wapk unauthorized" errors caused by stale webAuthnKey from failed login/registration attempts. Added `clearAuthState()` utility that cleans up auth cookies on errors, with defensive detection of stale key errors (AA24/wapk) in transaction signing. Stale key errors during transactions now show user-friendly error messages. Added retry logic for transient Android `NotReadableError` and platform-specific error messages.
- **🐛 PWA crash on cold launch (iOS)** - Fixed app crash when opening PWA immediately after installation. Web3Modal/AppKit now lazy-loads with 10-second timeout only when user needs to connect external wallet, preventing network errors during offline PWA startup. Promise-based initialization prevents race conditions and allows retry on failure.
