import type { Metadata } from "next"
import TrackerPage from "@/components/tracker-page"

export const metadata: Metadata = { title: "Инциденты | SimpleTracker" }

export default function IncidentsPage() {
  return <TrackerPage section="incidents" />
}
