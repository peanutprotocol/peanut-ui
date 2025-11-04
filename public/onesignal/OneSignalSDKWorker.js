// Version Pinning: OneSignal uses major version channels (v16) for their CDN.
// Per OneSignal documentation, they do not publish minor or patch-pinned service worker URLs.
// The v16 channel receives security updates and bug fixes automatically while maintaining
// API compatibility. This is the recommended approach per OneSignal's best practices.
// For stricter version control, we can consider self-hosting the SDK, but this requires manual updates.
// Reference: https://documentation.onesignal.com/docs/web-push-quickstart
importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js')
