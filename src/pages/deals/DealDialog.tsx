/**
 * DealDialog — create / edit a single deal.
 *
 * Round 3A scope only: name, stage, status, amount, currency, owner, notes,
 * one linked company, multi-link contacts, expected close date.
 */
import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { X, Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

import { useAuth } from "@/contexts/AuthContext";
import type { Deal, DealInput, PipelineStage } from "@/hooks/use-deals";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stages: PipelineStage[];
  deal?: Deal | null;
  onSubmit: (input: DealInput, existingId?: string) => Promise<unknown>;
}

interface CompanyOpt { id: string; name: string | null }
interface ContactOpt { id: string; first_name: string | null; last_name: string | null; email: string | null }
interface UserOpt { id: string; full_name: string | null; email: string | null }

function contactLabel(c: ContactOpt) {
  const n = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
  return n || c.email || c.id.slice(0, 8);
}

export function DealDialog({ open, onOpenChange, stages, deal, onSubmit }: Props) {
  const { user, workspaceId } = useAuth();
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [stageId, setStageId] = useState<string>("");
  const [status, setStatus] = useState<Deal["status"]>("open");
  const [amount, setAmount] = useState<string>("");
  const [currency, setCurrency] = useState<string>("USD");
  const [notes, setNotes] = useState<string>("");
  const [expectedClose, setExpectedClose] = useState<string>("");

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyLabel, setCompanyLabel] = useState<string>("");
  const [companyQuery, setCompanyQuery] = useState("");
  const [companyOptions, setCompanyOptions] = useState<CompanyOpt[]>([]);
  const [companyOpen, setCompanyOpen] = useState(false);
  const [companyLoading, setCompanyLoading] = useState(false);

  const [contactIds, setContactIds] = useState<string[]>([]);
  const [contactsSelected, setContactsSelected] = useState<ContactOpt[]>([]);
  const [contactQuery, setContactQuery] = useState("");
  const [contactOptions, setContactOptions] = useState<ContactOpt[]>([]);
  const [contactOpen, setContactOpen] = useState(false);
  const [contactLoading, setContactLoading] = useState(false);

  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [members, setMembers] = useState<UserOpt[]>([]);

  // Load workspace members for owner selection
  useEffect(() => {
    if (!open || !workspaceId) return;
    (async () => {
      const { data: rows } = await (supabase as any)
        .from("workspace_members")
        .select("user_id")
        .eq("workspace_id", workspaceId);
      const ids = (rows ?? []).map((r: any) => r.user_id).filter(Boolean);
      if (ids.length === 0) {
        if (user) {
          const { data: me } = await (supabase as any)
            .from("profiles").select("id, full_name, email").eq("id", user.id).maybeSingle();
          if (me) setMembers([me]);
        }
        return;
      }
      const { data: profs } = await (supabase as any)
        .from("profiles")
        .select("id, full_name, email")
        .in("id", ids);
      setMembers((profs ?? []) as UserOpt[]);
    })();
  }, [open, workspaceId, user]);

  // Reset from deal
  useEffect(() => {
    if (!open) return;
    if (deal) {
      setName(deal.name);
      setStageId(deal.stage_id ?? "");
      setStatus(deal.status);
      setAmount(deal.amount != null ? String(deal.amount) : "");
      setCurrency(deal.currency ?? "USD");
      setNotes(deal.notes ?? "");
      setExpectedClose(deal.expected_close_date ?? "");
      setCompanyId(deal.company_id ?? null);
      setCompanyLabel(deal.company?.name ?? "");
      setOwnerId(deal.owner_id ?? null);
      const sel = (deal.contacts ?? [])
        .map((c) => c.contact)
        .filter((c): c is ContactOpt => !!c);
      setContactsSelected(sel);
      setContactIds(sel.map((c) => c.id));
    } else {
      setName("");
      setStageId(stages[0]?.id ?? "");
      setStatus("open");
      setAmount("");
      setCurrency("USD");
      setNotes("");
      setExpectedClose("");
      setCompanyId(null);
      setCompanyLabel("");
      setOwnerId(user?.id ?? null);
      setContactsSelected([]);
      setContactIds([]);
    }
  }, [open, deal, stages, user?.id]);

  // Company search
  useEffect(() => {
    if (!companyOpen || !workspaceId) return;
    const t = setTimeout(async () => {
      setCompanyLoading(true);
      let q = (supabase as any).from("companies").select("id, name").eq("workspace_id", workspaceId).limit(20);
      if (companyQuery.trim()) q = q.ilike("name", `%${companyQuery.trim()}%`);
      const { data } = await q;
      setCompanyOptions((data ?? []) as CompanyOpt[]);
      setCompanyLoading(false);
    }, 200);
    return () => clearTimeout(t);
  }, [companyOpen, companyQuery, workspaceId]);

  // Contact search
  useEffect(() => {
    if (!contactOpen || !workspaceId) return;
    const t = setTimeout(async () => {
      setContactLoading(true);
      let q = (supabase as any)
        .from("contacts")
        .select("id, first_name, last_name, email")
        .eq("workspace_id", workspaceId)
        .limit(20);
      const term = contactQuery.trim();
      if (term) {
        q = q.or(
          `first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%`
        );
      }
      const { data } = await q;
      setContactOptions((data ?? []) as ContactOpt[]);
      setContactLoading(false);
    }, 200);
    return () => clearTimeout(t);
  }, [contactOpen, contactQuery, workspaceId]);

  const canSave = name.trim().length > 0 && stages.length > 0 && stageId;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    const input: DealInput = {
      name: name.trim(),
      status,
      stage_id: stageId || null,
      amount: amount === "" ? null : Number(amount),
      currency: currency || "USD",
      notes: notes || null,
      company_id: companyId,
      owner_id: ownerId,
      expected_close_date: expectedClose || null,
      contact_ids: contactIds,
    };
    try {
      await onSubmit(input, deal?.id);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const toggleContact = (c: ContactOpt) => {
    if (contactIds.includes(c.id)) {
      setContactIds(contactIds.filter((id) => id !== c.id));
      setContactsSelected(contactsSelected.filter((x) => x.id !== c.id));
    } else {
      setContactIds([...contactIds, c.id]);
      setContactsSelected([...contactsSelected, c]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{deal ? "Edit deal" : "Create deal"}</DialogTitle>
          <DialogDescription>
            Basic CRM fields — name, stage, value, owner, notes, linked company and contacts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="deal-name">Name *</Label>
            <Input id="deal-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme – Q3 expansion" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Stage *</Label>
              <Select value={stageId} onValueChange={setStageId}>
                <SelectTrigger><SelectValue placeholder="Pick stage" /></SelectTrigger>
                <SelectContent>
                  {stages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.stage_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as Deal["status"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="won">Won</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                  <SelectItem value="abandoned">Abandoned</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 space-y-1">
              <Label htmlFor="deal-amount">Amount</Label>
              <Input
                id="deal-amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["USD", "EUR", "GBP", "CAD", "AUD"].map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Owner</Label>
              <Select value={ownerId ?? ""} onValueChange={(v) => setOwnerId(v || null)}>
                <SelectTrigger><SelectValue placeholder="Pick owner" /></SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.full_name || m.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="deal-close">Expected close</Label>
              <Input
                id="deal-close"
                type="date"
                value={expectedClose}
                onChange={(e) => setExpectedClose(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Linked company</Label>
            <Popover open={companyOpen} onOpenChange={setCompanyOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between font-normal">
                  {companyId ? (companyLabel || "Selected company") : "Select a company"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[420px] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput placeholder="Search companies..." value={companyQuery} onValueChange={setCompanyQuery} />
                  <CommandList>
                    {companyLoading ? (
                      <div className="p-3 text-sm text-muted-foreground flex items-center gap-2">
                        <Loader2 className="h-3 w-3 animate-spin" /> Searching…
                      </div>
                    ) : companyOptions.length === 0 ? (
                      <CommandEmpty>No companies found.</CommandEmpty>
                    ) : (
                      companyOptions.map((c) => (
                        <CommandItem
                          key={c.id}
                          onSelect={() => {
                            setCompanyId(c.id);
                            setCompanyLabel(c.name ?? "");
                            setCompanyOpen(false);
                          }}
                        >
                          <Check className={`mr-2 h-4 w-4 ${companyId === c.id ? "opacity-100" : "opacity-0"}`} />
                          {c.name ?? c.id.slice(0, 8)}
                        </CommandItem>
                      ))
                    )}
                    {companyId && (
                      <CommandItem
                        onSelect={() => {
                          setCompanyId(null);
                          setCompanyLabel("");
                          setCompanyOpen(false);
                        }}
                      >
                        <X className="mr-2 h-4 w-4" /> Clear selection
                      </CommandItem>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1">
            <Label>Linked contacts</Label>
            <Popover open={contactOpen} onOpenChange={setContactOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between font-normal">
                  {contactsSelected.length > 0 ? `${contactsSelected.length} selected` : "Add contacts"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[420px] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput placeholder="Search contacts..." value={contactQuery} onValueChange={setContactQuery} />
                  <CommandList>
                    {contactLoading ? (
                      <div className="p-3 text-sm text-muted-foreground flex items-center gap-2">
                        <Loader2 className="h-3 w-3 animate-spin" /> Searching…
                      </div>
                    ) : contactOptions.length === 0 ? (
                      <CommandEmpty>No contacts found.</CommandEmpty>
                    ) : (
                      contactOptions.map((c) => (
                        <CommandItem key={c.id} onSelect={() => toggleContact(c)}>
                          <Check className={`mr-2 h-4 w-4 ${contactIds.includes(c.id) ? "opacity-100" : "opacity-0"}`} />
                          <div className="flex flex-col">
                            <span>{contactLabel(c)}</span>
                            {c.email && <span className="text-xs text-muted-foreground">{c.email}</span>}
                          </div>
                        </CommandItem>
                      ))
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            {contactsSelected.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-2">
                {contactsSelected.map((c) => (
                  <Badge key={c.id} variant="secondary" className="gap-1">
                    {contactLabel(c)}
                    <button
                      type="button"
                      onClick={() => toggleContact(c)}
                      className="ml-1 rounded hover:bg-muted"
                      aria-label="Remove contact"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="deal-notes">Notes</Label>
            <Textarea
              id="deal-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Context, next steps, decision criteria…"
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={!canSave || saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {deal ? "Save changes" : "Create deal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
