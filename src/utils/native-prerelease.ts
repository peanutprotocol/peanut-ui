// A dev pre-release binary (release-native.yml dispatched on dev) runs the dev JS
// it was built with. No OTA lane serves it: production carries main JS for older
// native surfaces, and staging bundles sort below its unreleased native version.
export function isNativePrerelease(): boolean {
    return process.env.NEXT_PUBLIC_NATIVE_PRERELEASE === 'true'
}
