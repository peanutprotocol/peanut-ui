# Routes Configuration

**Version:** 1.0.0 | **Updated:** November 3, 2025

## Overview

All route definitions are centralized in `/src/constants/routes.ts` to maintain consistency across the application and follow the DRY principle.

## Configuration File

**Location:** `/src/constants/routes.ts`

This file exports:

### 1. `DEDICATED_ROUTES`
Routes with dedicated Next.js page files that should not be handled by catch-all routes.

```typescript
['qr', 'api', 'setup', 'home', 'history', 'settings', 'points', ...]
```

### 2. `STATIC_REDIRECT_ROUTES`
Routes from `redirects.json` that are handled by Next.js static redirects.

```typescript
['docs', 'packet', 'create-packet', 'batch', 'raffle', ...]
```

### 3. `RESERVED_ROUTES`
Combined array of dedicated and static redirect routes. Used by catch-all routes to prevent handling reserved paths.

**Usage:** `/src/app/[...recipient]/page.tsx`

### 4. `PUBLIC_ROUTES`
Array of routes accessible without authentication.

```typescript
['request/pay', 'claim', 'pay', 'support', 'invite', 'dev', 'qr']
```

### 5. `PUBLIC_ROUTES_REGEX`
Regex pattern matching public routes for efficient checking.

**Usage:** `/src/app/(mobile-ui)/layout.tsx`

### 6. `MIDDLEWARE_ROUTES`
Routes where Next.js middleware should run. Includes path wildcards (`:path*`).

**⚠️ Note:** This is for documentation only. Next.js requires `config.matcher` to be a static literal array for build-time parsing, so the actual matcher is defined directly in `/src/middleware.ts` with a comment referencing this constant.

## Helper Functions

### `isReservedRoute(path: string): boolean`
Checks if a path is reserved and should not be handled by catch-all routes.

### `isPublicRoute(path: string): boolean`
Checks if a path is publicly accessible without authentication.

## Usage Examples

### Layout Authentication Check
```typescript
import { PUBLIC_ROUTES_REGEX } from '@/constants/routes'

const isPublicPath = PUBLIC_ROUTES_REGEX.test(pathName)
if (!isPublicPath && !user) {
    router.push('/setup')
}
```

### Catch-All Route Guard
```typescript
import { RESERVED_ROUTES } from '@/constants/routes'

const firstSegment = recipient[0]?.toLowerCase()
if (firstSegment && RESERVED_ROUTES.includes(firstSegment)) {
    notFound()
}
```

### Middleware Configuration
```typescript
// NOTE: Must be a static literal array - Next.js requires build-time parsing
// Routes documented in src/constants/routes.ts (MIDDLEWARE_ROUTES)
export const config = {
    matcher: [
        '/',
        '/home',
        '/claim/:path*',
        // ... etc
    ],
}
```

## Adding New Routes

### Public Route (No Auth Required)
1. Add to `PUBLIC_ROUTES` array in `routes.ts`
2. Update `PUBLIC_ROUTES_REGEX` pattern
3. If middleware needed: Add to `matcher` array in `middleware.ts` (static literal)

### Reserved Route (Has Dedicated Page)
1. Add to `DEDICATED_ROUTES` array in `routes.ts`
2. Create the page file in `/src/app/`
3. If middleware needed: Add to `matcher` array in `middleware.ts` (static literal)

### Static Redirect
1. Add to `redirects.json`
2. Add to `STATIC_REDIRECT_ROUTES` in `routes.ts`

### Middleware Route
1. Add to `MIDDLEWARE_ROUTES` in `routes.ts` (for documentation)
2. **Important:** Also add to `config.matcher` in `middleware.ts` (must be static literal)

## Benefits

✅ **Single Source of Truth:** All route definitions in one place  
✅ **Type Safety:** TypeScript ensures consistency  
✅ **Easy Maintenance:** Update once, applies everywhere  
✅ **Clear Documentation:** Self-documenting route categories  
✅ **DRY Principle:** No duplication across files  

## Files Using This Config

- `/src/app/(mobile-ui)/layout.tsx` - Authentication checks
- `/src/middleware.ts` - Middleware matcher
- `/src/app/[...recipient]/page.tsx` - Catch-all route guards
- `/redirects.json` - Static redirects (reference only)

