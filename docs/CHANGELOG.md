# Changelog

## 2025-10-09

### Fixed
- **Critical: Unrecoverable loading state on registration failure**
  - Fixed issue where users would get stuck in an infinite loading state if passkey registration succeeded but backend user creation failed
  - Added automatic cleanup of `web-authn-key` cookies when account creation fails
  - Implemented recovery logic in `KernelClientProvider` that detects auth state mismatch and automatically logs out after 5 seconds
  - Improved error handling in passkey registration to clear any partially set authentication state
  - Added better error logging in user query to help diagnose backend failures
  - See `docs/fix-unrecoverable-loading-state.md` for detailed analysis and solution
  - **Files changed:**
    - `src/components/Setup/Views/SetupPasskey.tsx`
    - `src/context/kernelClient.context.tsx`
    - `src/hooks/query/user.ts`

## init
Initial version
