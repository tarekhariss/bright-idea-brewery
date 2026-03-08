import { CalendarCheck } from "lucide-react";
import { PageShell } from "@/components/PageShell";

export default function MeetingsPage() {
  return (
    <PageShell
      icon={CalendarCheck}
      title="Meetings"
      description="Schedule, track, and manage all prospect and client meetings in one place."
      emptyState={{
        icon: CalendarCheck,
        title: "No meetings scheduled",
        description: "Meetings booked through sequences, calendar links, or manual scheduling will appear here with attendee details and outcomes.",
      }}
    />
  );
}
