import { redirect } from "next/navigation"

/** Web Cloud opens on its first product, as Bare Metal Cloud does. */
export default function WebCloudPage(): never {
  redirect("/app/web-cloud/alojamiento")
}
