'use client'

// stub for web build — real component is injected by scripts/native-build.js during native builds.
// on web, this code path is never reached (dynamic route /qr/[code] handles it).
export default function Stub() {
    return null
}
