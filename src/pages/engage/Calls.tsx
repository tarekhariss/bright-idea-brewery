import { useState } from "react";
import {
  Phone, Plus, Loader2, MoreHorizontal, PhoneCall, PhoneIncoming, PhoneOutgoing,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { useCalls, useCreateCall, useUpdateCall } from "@/hooks/use-engage";

const outcomeBadge = (o: string | null) => {
  if (!o) return <Badge className="bg-muted text-muted-foreground text-[10px]">No outcome</Badge>;
  const map: Record<string, { cls: string }> = {
    connected: { cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
    interested: { cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
    not_interested: { cls: "bg-destructive/10 text-destructive border-destructive/20" },
    no_answer: { cls: "bg-muted text-muted-foreground" },
    voicemail: { cls: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
    callback: { cls: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
    wrong_number: { cls: "bg-destructive/10 text-destructive border-destructive/20" },
  };
  const m = map[o] || map.no_answer;
  return <Badge className={`${m.cls} text-[10px] capitalize`}>{o.replace(/_/g, " ")}</Badge>;
};

export default function CallsPage() {
  const { data: calls, isLoading } = useCalls();
  const createCall = useCreateCall();
  const updateCall = useUpdateCall();

  const [createOpen, setCreateOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [direction, setDirection] = useState("outbound");
  const [notes, setNotes] = useState("");
  const [outcome, setOutcome] = useState("");

  // For logging outcome on existing call
  const [logId, setLogId] = useState<string | null>(null);
  const [logOutcome, setLogOutcome] = useState("");
  const [logNotes, setLogNotes] = useState("");
  const [logDuration, setLogDuration] = useState("");

  const handleCreate = async () => {
    await createCall.mutateAsync({
      phone_number: phone || undefined,
      direction,
      notes: notes || undefined,
    });
    setCreateOpen(false);
    setPhone(""); setDirection("outbound"); setNotes("");
  };

  const handleLogOutcome = async () => {
    if (!logId) return;
    await updateCall.mutateAsync({
      id: logId,
      outcome: logOutcome as any || undefined,
      notes: logNotes || undefined,
      duration_seconds: logDuration ? parseInt(logDuration) : undefined,
      ended_at: new Date().toISOString(),
    });
    setLogId(null);
    setLogOutcome(""); setLogNotes(""); setLogDuration("");
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Phone className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Calls</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Log calls, track outcomes, and manage your calling workflow.</p>
          </div>
        </div>
        <Button size="sm" className="gap-1.5 text-xs" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Log Call
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : !calls?.length ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
              <Phone className="h-7 w-7 text-muted-foreground/60" />
            </div>
            <h3 className="text-lg font-medium">No calls logged yet</h3>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-md">
              Log calls from your outreach to track outcomes and conversation notes.
            </p>
            <Button size="sm" className="mt-5 gap-1.5 text-xs" onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Log Call
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Direction</TableHead>
                <TableHead className="text-xs">Phone</TableHead>
                <TableHead className="text-xs">Contact</TableHead>
                <TableHead className="text-xs">Outcome</TableHead>
                <TableHead className="text-xs">Duration</TableHead>
                <TableHead className="text-xs">Date</TableHead>
                <TableHead className="text-xs w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {calls.map((call: any) => (
                <TableRow key={call.id}>
                  <TableCell>
                    {call.direction === "inbound" ? (
                      <PhoneIncoming className="h-3.5 w-3.5 text-blue-600" />
                    ) : (
                      <PhoneOutgoing className="h-3.5 w-3.5 text-emerald-600" />
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{call.phone_number || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {call.contacts ? `${call.contacts.first_name || ""} ${call.contacts.last_name || ""}`.trim() : "—"}
                  </TableCell>
                  <TableCell>{outcomeBadge(call.outcome)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {call.duration_seconds ? `${Math.floor(call.duration_seconds / 60)}m ${call.duration_seconds % 60}s` : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{format(new Date(call.created_at), "MMM d, HH:mm")}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-3.5 w-3.5" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setLogId(call.id); setLogNotes(call.notes || ""); setLogOutcome(call.outcome || ""); }}>
                          <PhoneCall className="h-3.5 w-3.5 mr-2" /> Log Outcome
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Log Call</DialogTitle>
            <DialogDescription className="text-sm">Record a new call in the system.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Phone Number</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555-0123" className="mt-1 h-9 text-sm" autoFocus />
            </div>
            <div>
              <Label className="text-xs">Direction</Label>
              <Select value={direction} onValueChange={setDirection}>
                <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="outbound">Outbound</SelectItem>
                  <SelectItem value="inbound">Inbound</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Call notes..." className="mt-1 text-sm" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreate} disabled={createCall.isPending}>
              {createCall.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Log Call
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Log Outcome Dialog */}
      <Dialog open={!!logId} onOpenChange={() => setLogId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Log Call Outcome</DialogTitle>
            <DialogDescription className="text-sm">Record what happened during this call.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Outcome</Label>
              <Select value={logOutcome} onValueChange={setLogOutcome}>
                <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue placeholder="Select outcome" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="connected">Connected</SelectItem>
                  <SelectItem value="interested">Interested</SelectItem>
                  <SelectItem value="not_interested">Not Interested</SelectItem>
                  <SelectItem value="no_answer">No Answer</SelectItem>
                  <SelectItem value="voicemail">Voicemail</SelectItem>
                  <SelectItem value="callback">Callback</SelectItem>
                  <SelectItem value="wrong_number">Wrong Number</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Duration (seconds)</Label>
              <Input type="number" value={logDuration} onChange={(e) => setLogDuration(e.target.value)} placeholder="120" className="mt-1 h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea value={logNotes} onChange={(e) => setLogNotes(e.target.value)} className="mt-1 text-sm" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setLogId(null)}>Cancel</Button>
            <Button size="sm" onClick={handleLogOutcome} disabled={updateCall.isPending}>
              {updateCall.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
