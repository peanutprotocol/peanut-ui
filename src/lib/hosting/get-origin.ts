import { headers } from "next/headers"

export default async function getOrigin(): Promise<string> {
  const h = await headers()
  const host = h.get("host")
  const forwardedProto = h.get("x-forwarded-proto")
  const protocol = forwardedProto || "http"

  return `${protocol}://${host}`
}
