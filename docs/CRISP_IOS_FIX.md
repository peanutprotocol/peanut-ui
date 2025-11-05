# Crisp iOS Fix

**Problem:** Support drawer blank forever on iOS  
**Fix:** Removed Suspense + manual URL params + device-specific timeouts  
**Status:** Ready to test on iOS device

## What Was Wrong

iOS Safari + Suspense + useSearchParams = streaming deadlock → blank screen forever

## Changes (44 net lines)

1. **Removed Suspense wrapper** - Causes Safari buffering issue
2. **Manual URLSearchParams** - Replaced useSearchParams() hook (iOS hydration bug)
3. **Device timeouts** - 3s desktop, 8s iOS (DRY hook: `useCrispIframeReady`)
4. **iOS height styles** - Added `-webkit-fill-available` fallback

## Files

```
src/app/crisp-proxy/page.tsx                  | ±40 lines
src/hooks/useCrispIframeReady.ts              | +55 (NEW)
src/components/Global/SupportDrawer/index.tsx | -19 lines
src/app/(mobile-ui)/support/page.tsx          | -11 lines
```

## How Timeouts Work

**NOT forced delays** - Shows content immediately when ready:

```typescript
// Listens for CRISP_READY postMessage
// Shows iframe AS SOON as message received (typically 1-2s)
// Timeout = MAX wait to prevent infinite loading
```

**Timeline:**

- Good connection: Crisp loads in 1-2s → shows immediately ✅
- Slow connection: Still waits for CRISP_READY, up to timeout
- Crisp fails: Timeout fires → shows friendly error with retry button

**Why device-specific?**

- Desktop/Android: 3s max (fast execution)
- iOS: 8s max (stricter security, slower in iframes)

## Fallback Behavior

If Crisp never loads (timeout or failure):

1. Loading spinner hides after timeout
2. Shows friendly error message:
    - "Having trouble loading support chat"
    - "Check your internet connection and try again"
    - Retry button to try loading again
    - Fallback email: support@peanut.me
3. User can retry, contact via email, or close drawer

## Known Limitations

1. **iOS PWA cookie blocking** - Cannot be fixed (iOS WKWebView limitation)
2. **Very slow networks** - Timeout may fire before Crisp loads on 2G (but user can retry)

## Testing

**iOS Safari:**

- [ ] Visit `/support` → loads quickly
- [ ] Open drawer → loads quickly
- [ ] Fast WiFi: < 3s, Slow 3G: < 8s

**Desktop/Android (no regression):**

- [ ] Loads in < 3s as before
