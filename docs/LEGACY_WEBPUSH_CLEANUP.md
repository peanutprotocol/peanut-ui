# Legacy Web Push Cleanup Plan

## Context

We migrated from **web-push (VAPID)** to **OneSignal** for push notifications. The old VAPID-based code is still present in the codebase but is no longer used in production. This technical debt should be removed to:

- Reduce bundle size
- Remove unused dependencies
- Simplify the codebase
- Eliminate confusion for new developers

## Current State

### Active System (OneSignal)

- **Hook**: `src/hooks/useNotifications.ts` - Handles OneSignal initialization and permission management
- **Used in**: Home page, various prompts throughout the app
- **Features**: Permission modals, reminder banners, user linking

### Legacy System (VAPID/web-push)

- **Server actions**: `src/app/actions.ts` - Contains `subscribeUser`, `unsubscribeUser`, `sendNotification`
- **Context**: `src/context/pushProvider.tsx` - Provides VAPID-based push subscription context
- **Usage**: Only used in `src/components/Global/DirectSendQR/index.tsx` for "Get notified when feature is available"

## Files to Modify

### 1. Remove VAPID Server Actions

**File**: `src/app/actions.ts`

**Action**: Remove the following:

- `import webpush from 'web-push'`
- `validateVapidEnv()` function
- `webpush.setVapidDetails()` initialization block
- `subscribeUser()` function
- `unsubscribeUser()` function
- `sendNotification()` function
- `updateSubscription()` function (if only used for VAPID)

**Keep**: Only if there are other server actions in this file

### 2. Remove or Replace PushProvider

**File**: `src/context/pushProvider.tsx`

**Option A**: Delete entirely if not used elsewhere
**Option B**: Migrate to use OneSignal's `useNotifications` hook instead

**Action**:

- Remove entire file if only VAPID-based
- Update `src/context/contextProvider.tsx` to remove `PushProvider` wrapper

### 3. Update DirectSendQR Component

**File**: `src/components/Global/DirectSendQR/index.tsx`

**Current behavior** (lines 50-75):

```typescript
const pushNotifications = usePush()
// ...
if (pushNotifications.isSupported && !pushNotifications.isSubscribed) {
    pushNotifications.subscribe().then(() => {
        setModalContent(EModalType.WILL_BE_NOTIFIED)
    })
}
```

**Replace with**:

```typescript
const { requestPermission, permissionState } = useNotifications()
// ...
if (permissionState !== 'granted') {
    await requestPermission()
    setModalContent(EModalType.WILL_BE_NOTIFIED)
} else {
    setModalContent(EModalType.WILL_BE_NOTIFIED)
}
```

### 4. Update Context Provider

**File**: `src/context/contextProvider.tsx`

**Action**:

- Remove `import { PushProvider } from './pushProvider'`
- Remove `<PushProvider>` wrapper from the context tree

### 5. Remove Test Mocks

**File**: `src/utils/__mocks__/web-push.ts`

**Action**: Delete file entirely

### 6. Update Jest Setup

**File**: `jest.setup.ts`

**Action**: Remove VAPID environment variable mocks:

```typescript
process.env.VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'test-vapid-public'
process.env.VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'test-vapid-private'
process.env.VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:test@example.com'
```

### 7. Clean up package.json

**File**: `package.json`

**Action**:

- Remove `"web-push": "^3.6.7"` from dependencies
- Remove `"@types/web-push": "^3.6.4"` from devDependencies
- Remove `"^web-push$": "<rootDir>/src/utils/__mocks__/web-push.ts"` from jest moduleNameMapper

### 8. Remove Environment Variables

**Files**: `.env`, `.env.local`, `vercel` project settings

**Action**: Remove:

- `NEXT_PUBLIC_VAPID_SUBJECT`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`

## Migration Steps

### Phase 1: Preparation

1. ✅ Verify OneSignal is working in production
2. ✅ Confirm no active users are using VAPID subscriptions
3. ✅ Review all usages of `usePush()` hook

### Phase 2: Code Changes

1. Update `DirectSendQR` to use `useNotifications` instead of `usePush`
2. Remove `PushProvider` from context tree
3. Delete `src/context/pushProvider.tsx`
4. Remove VAPID functions from `src/app/actions.ts`
5. Clean up test mocks and environment variables

### Phase 3: Dependency Cleanup

1. Remove `web-push` and `@types/web-push` from `package.json`
2. Run `pnpm install` to clean up `pnpm-lock.yaml`
3. Update Jest configuration

### Phase 4: Testing

1. Run test suite: `pnpm test`
2. Test "Get notified" feature in DirectSendQR locally
3. Verify no console errors related to VAPID
4. Check that OneSignal notifications still work
5. Test on staging environment

### Phase 5: Deployment

1. Deploy to staging
2. Smoke test push notification flows
3. Deploy to production
4. Monitor for any VAPID-related errors in Sentry

## Risk Assessment

**Risk Level**: 🟢 Low

**Reasons**:

- Legacy code is isolated and not used in core features
- OneSignal has been in production successfully
- Only one component (`DirectSendQR`) uses the old system
- Easy to rollback if needed

**Mitigation**:

- Test thoroughly on staging first
- Deploy during low-traffic period
- Monitor Sentry for errors
- Have rollback plan ready

## Benefits

1. **Bundle Size**: Remove ~50KB from client bundle (web-push library)
2. **Code Quality**: Remove 200+ lines of unused code
3. **Maintenance**: One less system to maintain
4. **Clarity**: Clear separation - OneSignal is the only push notification system
5. **Security**: Remove unused environment variables

## Success Criteria

- [ ] All VAPID-related code removed
- [ ] All tests passing
- [ ] "Get notified" feature works with OneSignal
- [ ] No VAPID-related errors in production
- [ ] Bundle size reduced
- [ ] Documentation updated

## Timeline

**Estimated effort**: 2-4 hours

**Recommended schedule**:

1. Code changes: 1 hour
2. Testing: 1 hour
3. Staging deployment: 30 min
4. Production deployment: 30 min
5. Monitoring: 1 hour

---

_Created: 2025-10-16_  
_Status: Planned_  
_Priority: Low (Tech Debt)_
