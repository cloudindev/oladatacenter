import { redirect } from "next/navigation"

/** Bare Metal Cloud has no landing of its own yet: its first product is the VPS list. */
export default function BareMetalPage(): never {
  redirect("/app/bare-metal/vps")
}
