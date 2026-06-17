// Jest stand-in for Next.js static asset imports (svg/png/jpg/gif/webp).
// Next yields StaticImageData ({ src, width, height, ... }), but the previous
// jest-transform-stub flattened imports to a bare string — so any code reading
// `.src` (the prod pattern, e.g. getBadgeIcon's fallback) tested against
// fiction. Mirror the real shape so tests and prod agree.
const staticImageStub = {
    src: '/test-file-stub',
    height: 1,
    width: 1,
    blurDataURL: '/test-file-stub',
}

export default staticImageStub
