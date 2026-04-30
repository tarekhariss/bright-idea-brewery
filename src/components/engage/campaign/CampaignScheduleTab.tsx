import { useEffect, useMemo, useState } from "react";
import { Calendar, Clock, Globe, Save, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useCampaign, useUpdateCampaign } from "@/hooks/use-campaigns";
import { useWorkspaceSendingWindows } from "@/hooks/use-campaign-detail";

const DAYS = [
  { v: "mon", label: "Mon" },
  { v: "tue", label: "Tue" },
  { v: "wed", label: "Wed" },
  { v: "thu", label: "Thu" },
  { v: "fri", label: "Fri" },
  { v: "sat", label: "Sat" },
  { v: "sun", label: "Sun" },
];

const TIMEZONES = [
  "UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Madrid",
  "Asia/Dubai", "Asia/Singapore", "Asia/Tokyo", "Australia/Sydney",
];

function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CampaignScheduleTab({ campaignId }: { campaignId: string }) {
  const { data: campaign, isLoading } = useCampaign(campaignId);
  const { data: windows } = useWorkspaceSendingWindows();
  const update = useUpdateCampaign();

  const [sendingWindowId, setSendingWindowId] = useState<string>("__none__");
  const [timezone, setTimezone] = useState("UTC");
  const [activeDays, setActiveDays] = useState<string[]>(["mon", "tue", "wed", "thu", "fri"]);
  const [startHour, setStartHour] = useState(9);
  const [endHour, setEndHour] = useState(17);
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");

  // Hydrate from server
  useEffect(() => {
    if (!campaign) return;
    const c: any = campaign;
    setSendingWindowId(c.sending_window_id ?? "__none__");
    setTimezone(c.timezone ?? "UTC");
    const days = Array.isArray(c.active_days) ? c.active_days : ["mon","tue","wed","thu","fri"];
    setActiveDays(days);
    setStartHour(c.send_start_hour ?? 9);
    setEndHour(c.send_end_hour ?? 17);
    setStartAt(toLocalInput(c.start_at));
    setEndAt(toLocalInput(c.end_at));
  }, [campaign]);

  const dirty = useMemo(() => {
    if (!campaign) return false;
    const c: any = campaign;
    const currentDays = Array.isArray(c.active_days) ? c.active_days : ["mon","tue","wed","thu","fri"];
    return (
      (c.sending_window_id ?? "__none__") !== sendingWindowId ||
      (c.timezone ?? "UTC") !== timezone ||
      JSON.stringify(currentDays) !== JSON.stringify(activeDays) ||
      (c.send_start_hour ?? 9) !== startHour ||
      (c.send_end_hour ?? 17) !== endHour ||
      toLocalInput(c.start_at) !== startAt ||
      toLocalInput(c.end_at) !== endAt
    );
  }, [campaign, sendingWindowId, timezone, activeDays, startHour, endHour, startAt, endAt]);

  const toggleDay = (d: string) => {
    setActiveDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]);
  };

  const handleSave = () => {
    update.mutate({
      id: campaignId,
      sending_window_id: sendingWindowId === "__none__" ? null : sendingWindowId,
      timezone,
      active_days: activeDays,
      send_start_hour: startHour,
      send_end_hour: endHour,
      start_at: startAt ? new Date(startAt).toISOString() : null,
      end_at: endAt ? new Date(endAt).toISOString() : null,
    } as any);
  };

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-4">
      {/* Sending Window */}
      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Sending Hours</h3>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label className="text-xs">Sending Window Preset</Label>
            <Select value={sendingWindowId} onValueChange={setSendingWindowId}>
              <SelectTrigger className="mt-1 h-9 text-sm">
                <SelectValue placeholder="No preset (use custom hours)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No preset (use custom hours)</SelectItem>
                {windows?.map((w: any) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name} ({w.start_hour}:00–{w.end_hour}:00 {w.timezone})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Optional. If a preset is selected, the campaign uses its hours and timezone.
            </p>
          </div>

          <div>
            <Label className="text-xs">Timezone</Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Start Hour (24h)</Label>
            <Input
              type="number" min={0} max={23}
              value={startHour}
              onChange={(e) => setStartHour(Math.max(0, Math.min(23, parseInt(e.target.value) || 0)))}
              className="mt-1 h-9 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">End Hour (24h)</Label>
            <Input
              type="number" min={1} max={24}
              value={endHour}
              onChange={(e) => setEndHour(Math.max(1, Math.min(24, parseInt(e.target.value) || 0)))}
              className="mt-1 h-9 text-sm"
            />
          </div>
        </div>
      </Card>

      {/* Active Days */}
      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Active Days</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {DAYS.map((d) => {
            const on = activeDays.includes(d.v);
            return (
              <button
                key={d.v}
                type="button"
                onClick={() => toggleDay(d.v)}
                className={cn(
                  "h-9 min-w-[56px] rounded-md border px-3 text-xs font-medium transition-colors",
                  on
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-accent"
                )}
              >
                {d.label}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Start/End */}
      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Campaign Window</h3>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label className="text-xs">Start Date (optional)</Label>
            <Input
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              className="mt-1 h-9 text-sm"
            />
            <p className="mt-1 text-[10px] text-muted-foreground">Sending begins at this date/time. Leave empty to start immediately when activated.</p>
          </div>
          <div>
            <Label className="text-xs">End Date (optional)</Label>
            <Input
              type="datetime-local"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
              className="mt-1 h-9 text-sm"
            />
            <p className="mt-1 text-[10px] text-muted-foreground">Campaign auto-pauses at this date/time.</p>
          </div>
        </div>
      </Card>

      {/* Save bar */}
      <div className="sticky bottom-0 -mx-1 flex items-center justify-end gap-2 border-t bg-background/80 px-1 py-2 backdrop-blur">
        {dirty && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
        <Button size="sm" onClick={handleSave} disabled={!dirty || update.isPending} className="h-8 gap-1.5 text-xs">
          {update.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save Schedule
        </Button>
      </div>
    </div>
  );
}
