import { useState } from "react";
import {
  Clock, Plus, Trash2, Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useSendingWindows, useCreateSendingWindow, useDeleteSendingWindow } from "@/hooks/use-outbound-config";

const TIMEZONES = [
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "Europe/London", "Europe/Paris", "Europe/Berlin", "Asia/Tokyo", "Asia/Shanghai",
  "Australia/Sydney", "Pacific/Auckland",
];

export default function SendingWindowsPage() {
  const { data: windows, isLoading } = useSendingWindows();
  const createWindow = useCreateSendingWindow();
  const deleteWindow = useDeleteSendingWindow();
  const [addOpen, setAddOpen] = useState(false);
  const [start, setStart] = useState(9);
  const [end, setEnd] = useState(17);
  const [tz, setTz] = useState("America/New_York");
  const [weekdaysOnly, setWeekdaysOnly] = useState(true);
  const [name, setName] = useState("");

  const handleAdd = async () => {
    await createWindow.mutateAsync({ name: name || "Default", start_hour: start, end_hour: end, timezone: tz, weekdays_only: weekdaysOnly });
    setAddOpen(false);
    setName(""); setStart(9); setEnd(17); setTz("America/New_York"); setWeekdaysOnly(true);
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Sending Windows</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Configure time windows when emails can be sent.</p>
          </div>
        </div>
        <Button size="sm" className="gap-1.5 text-xs" onClick={() => setAddOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Add Window
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2].map((i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : !windows?.length ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <Clock className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No sending windows configured. Emails will send anytime by default.</p>
            <Button size="sm" className="mt-4 text-xs gap-1.5" onClick={() => setAddOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Add Window
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {windows.map((w) => (
            <Card key={w.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{w.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {w.start_hour}:00 – {w.end_hour}:00 • {w.timezone}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {w.weekdays_only && <Badge variant="secondary" className="text-[10px]">Weekdays only</Badge>}
                  <Badge className={`text-[10px] ${w.is_active ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-muted text-muted-foreground"}`}>
                    {w.is_active ? "Active" : "Inactive"}
                  </Badge>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteWindow.mutate(w.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Add Sending Window</DialogTitle>
            <DialogDescription className="text-sm">Configure when emails can be sent.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Business hours" className="mt-1 h-9 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Start Hour</Label>
                <Input type="number" min={0} max={23} value={start} onChange={(e) => setStart(parseInt(e.target.value) || 0)} className="mt-1 h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs">End Hour</Label>
                <Input type="number" min={0} max={23} value={end} onChange={(e) => setEnd(parseInt(e.target.value) || 17)} className="mt-1 h-9 text-sm" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Timezone</Label>
              <Select value={tz} onValueChange={setTz}>
                <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Weekdays Only</Label>
              <Switch checked={weekdaysOnly} onCheckedChange={setWeekdaysOnly} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleAdd} disabled={createWindow.isPending}>
              {createWindow.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Add Window
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
