import { MetadataRoute } from 'next'
import { manifest as manifest_object } from '@/constants'

export default function manifest(): MetadataRoute.Manifest {
    return manifest_object
}
