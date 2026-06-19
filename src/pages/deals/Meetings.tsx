import { CalendarCheck } from "lucide-react";
import { PageShell } from "@/components/PageShell";

export default function MeetingsPage() {
  return (
    <PageShell
      icon={CalendarCheck}
      title="Meetings"
      description="Schedule, track, and manage all prospect and client meetings in one place."
      comingSoon
      comingSoonScope={[
        "Google / Outlook calendar sync",
        "Booking-link based scheduling",
        "Per-deal and per-contact meeting history",
        "Outcome capture (showed, no-show, next steps)",
      ]}
      emptyState={{
        icon: CalendarCheck,
        title: "Meetings module requires a calendar provider",
        description:
          "Once Google or Outlook OAuth is connected, scheduled meetings will sync here. This view is intentionally inert until that integration ships.",
      }}
    />
  );
}
