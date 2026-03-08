import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfiles } from "@/hooks/use-profiles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Settings, User, Tag, Shield, Activity, Upload, Database, Trash2, Edit2, Plus, Palette
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import type { AppRole } from "@/integrations/supabase/db-types";

interface TagRow {
  id: string;
  name: string;
  color: string | null;
  created_at: string;
  contactCount?: number;
  companyCount?: number;
}

interface UserRow {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  roles: AppRole[];
}

interface PlatformSetting {
  id: string;
  key: string;
  value: any;
  updated_at: string;
}

const LIFECYCLE_STATUSES = [
  { value: "new", label: "New", description: "Freshly imported or created contact" },
  { value: "researching", label: "Researching", description: "Being investigated for fit" },
  { value: "qualified", label: "Qualified", description: "Meets ICP and targeting criteria" },
  { value: "nurturing", label: "Nurturing", description: "In warm-up or drip sequence" },
  { value: "engaged", label: "Engaged", description: "Actively interacting with outreach" },
  { value: "converted", label: "Converted", description: "Became a customer or lead" },
  { value: "churned", label: "Churned", description: "Lost or disengaged" },
  { value: "archived", label: "Archived", description: "Removed from active pipeline" },
];

const OUTREACH_STATUSES = [
  { value: "not_contacted", label: "Not Contacted", description: "No outreach sent" },
  { value: "queued", label: "Queued", description: "Scheduled for outreach" },
  { value: "contacted", label: "Contacted", description: "Initial outreach sent" },
  { value: "replied", label: "Replied", description: "Received a response" },
  { value: "bounced", label: "Bounced", description: "Email bounced back" },
  { value: "opted_out", label: "Opted Out", description: "Requested no further contact" },
  { value: "unresponsive", label: "Unresponsive", description: "Multiple attempts with no reply" },
];

const TAG_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316", "#6366f1", "#14b8a6",
];

export default function SettingsPage() {
  const { user, role, isAdmin, canManage } = useAuth();
  const { profiles } = useProfiles();
  const [tags, setTags] = useState<TagRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [settings, setSettings] = useState<PlatformSetting[]>([]);
  const [loading, setLoading] = useState(true);

  // Tag management state
  const [tagDialog, setTagDialog] = useState(false);
  const [editingTag, setEditingTag] = useState<TagRow | null>(null);
  const [tagName, setTagName] = useState("");
  const [tagColor, setTagColor] = useState(TAG_COLORS[0]);
  const [deleteTagId, setDeleteTagId] = useState<string | null>(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [tagsRes, usersRes, rolesRes, settingsRes, ctRes, coRes] = await Promise.all([
      supabase.from("tags").select("*").order("name"),
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("*"),
      supabase.from("platform_settings").select("*").order("key"),
      supabase.from("contact_tags").select("tag_id"),
      supabase.from("company_tags").select("tag_id"),
    ]);

    // Count tag usage
    const ctCounts: Record<string, number> = {};
    const coCounts: Record<string, number> = {};
    (ctRes.data ?? []).forEach((r: any) => { ctCounts[r.tag_id] = (ctCounts[r.tag_id] || 0) + 1; });
    (coRes.data ?? []).forEach((r: any) => { coCounts[r.tag_id] = (coCounts[r.tag_id] || 0) + 1; });

    setTags((tagsRes.data ?? []).map((t: any) => ({
      ...t,
      contactCount: ctCounts[t.id] || 0,
      companyCount: coCounts[t.id] || 0,
    })));

    // Merge roles into users
    const roleMap: Record<string, AppRole[]> = {};
    (rolesRes.data ?? []).forEach((r: any) => {
      if (!roleMap[r.user_id]) roleMap[r.user_id] = [];
      roleMap[r.user_id].push(r.role);
    });
    setUsers((usersRes.data ?? []).map((u: any) => ({
      ...u,
      roles: roleMap[u.id] || [],
    })));

    setSettings((settingsRes.data ?? []) as PlatformSetting[]);
    setLoading(false);
  }

  // Tag CRUD
  function openNewTag() {
    setEditingTag(null); setTagName(""); setTagColor(TAG_COLORS[0]); setTagDialog(true);
  }
  function openEditTag(t: TagRow) {
    setEditingTag(t); setTagName(t.name); setTagColor(t.color || TAG_COLORS[0]); setTagDialog(true);
  }
  async function saveTag() {
    if (!tagName.trim()) return;
    if (editingTag) {
      // @ts-ignore
      const { error } = await supabase.from("tags").update({ name: tagName.trim(), color: tagColor }).eq("id", editingTag.id);
      if (error) toast.error("Failed to update tag");
      else toast.success("Tag updated");
    } else {
      // @ts-ignore
      const { error } = await supabase.from("tags").insert({ name: tagName.trim(), color: tagColor, created_by: user?.id });
      if (error) toast.error("Failed to create tag");
      else toast.success("Tag created");
    }
    setTagDialog(false);
    loadData();
  }
  async function deleteTag() {
    if (!deleteTagId) return;
    await supabase.from("contact_tags").delete().eq("tag_id", deleteTagId);
    await supabase.from("company_tags").delete().eq("tag_id", deleteTagId);
    const { error } = await supabase.from("tags").delete().eq("id", deleteTagId);
    if (error) toast.error("Failed to delete tag");
    else toast.success("Tag deleted");
    setDeleteTagId(null);
    loadData();
  }

  const fmtDate = (d: string) => {
    try { return format(new Date(d), "MMM d, yyyy"); } catch { return "—"; }
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in overflow-auto max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Platform configuration, users, and operational settings</p>
      </div>

      <Tabs defaultValue="account" className="space-y-4">
        <TabsList className="grid grid-cols-5 w-full max-w-2xl">
          <TabsTrigger value="account" className="text-xs gap-1"><User className="h-3 w-3" /> Account</TabsTrigger>
          <TabsTrigger value="tags" className="text-xs gap-1"><Tag className="h-3 w-3" /> Tags</TabsTrigger>
          <TabsTrigger value="users" className="text-xs gap-1"><Shield className="h-3 w-3" /> Users</TabsTrigger>
          <TabsTrigger value="statuses" className="text-xs gap-1"><Activity className="h-3 w-3" /> Statuses</TabsTrigger>
          <TabsTrigger value="platform" className="text-xs gap-1"><Database className="h-3 w-3" /> Platform</TabsTrigger>
        </TabsList>

        {/* Account Tab */}
        <TabsContent value="account" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Your Account</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span className="font-medium">{user?.email ?? "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">User ID</span><span className="font-mono text-xs">{user?.id ?? "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Role</span>
                <Badge variant="outline" className="text-xs capitalize">{role ?? "—"}</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Permissions</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-2">
              {[
                { label: "View data", allowed: true },
                { label: "Edit contacts & companies", allowed: canManage || role === "operator" || role === "admin" },
                { label: "Manage imports", allowed: canManage || role === "operator" || role === "admin" },
                { label: "Manage team", allowed: canManage },
                { label: "Admin settings", allowed: isAdmin },
              ].map((p) => (
                <div key={p.label} className="flex items-center justify-between">
                  <span className="text-muted-foreground">{p.label}</span>
                  <Badge variant={p.allowed ? "default" : "secondary"} className="text-[11px]">{p.allowed ? "Allowed" : "Restricted"}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tags Tab */}
        <TabsContent value="tags" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold">Tag Management</h3>
              <p className="text-sm text-muted-foreground">{tags.length} tags created</p>
            </div>
            {canManage && (
              <Button size="sm" className="gap-1.5 text-xs" onClick={openNewTag}>
                <Plus className="h-3.5 w-3.5" /> New Tag
              </Button>
            )}
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Tag</TableHead>
                    <TableHead className="text-xs">Contacts</TableHead>
                    <TableHead className="text-xs">Companies</TableHead>
                    <TableHead className="text-xs">Created</TableHead>
                    {canManage && <TableHead className="text-xs w-20">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tags.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">No tags yet</TableCell></TableRow>
                  ) : tags.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-3 w-3 rounded-full border" style={{ backgroundColor: t.color || "#888" }} />
                          <span className="text-sm font-medium">{t.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs tabular-nums">{t.contactCount}</TableCell>
                      <TableCell className="text-xs tabular-nums">{t.companyCount}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{fmtDate(t.created_at)}</TableCell>
                      {canManage && (
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEditTag(t)}>
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => setDeleteTagId(t.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <div>
            <h3 className="text-base font-semibold">Users & Roles</h3>
            <p className="text-sm text-muted-foreground">{users.length} users in the platform</p>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">User</TableHead>
                    <TableHead className="text-xs">Email</TableHead>
                    <TableHead className="text-xs">Roles</TableHead>
                    <TableHead className="text-xs">Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">No users found</TableCell></TableRow>
                  ) : users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-3.5 w-3.5 text-primary" />
                          </div>
                          <span className="text-sm font-medium">{u.full_name || "—"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{u.email ?? "—"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {u.roles.length === 0 ? (
                            <Badge variant="secondary" className="text-[11px]">No role</Badge>
                          ) : u.roles.map((r) => (
                            <Badge key={r} variant="outline" className="text-[11px] capitalize">{r}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{fmtDate(u.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm font-medium">Role Definitions</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {[
                { role: "admin", desc: "Full control over settings, users, roles, imports, and all data" },
                { role: "manager", desc: "Can view team data, manage imports, and assign owners" },
                { role: "operator", desc: "Can manage contacts, companies, lists, and run imports" },
                { role: "viewer", desc: "Read-only access to contacts, companies, and dashboards" },
              ].map((r) => (
                <div key={r.role} className="flex items-start gap-3">
                  <Badge variant="outline" className="text-[11px] capitalize mt-0.5">{r.role}</Badge>
                  <p className="text-sm text-muted-foreground">{r.desc}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Statuses Tab */}
        <TabsContent value="statuses" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Lifecycle Statuses</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {LIFECYCLE_STATUSES.map((s) => (
                  <div key={s.value} className="flex items-center gap-3">
                    <Badge variant="outline" className="text-[11px] w-24 justify-center">{s.label}</Badge>
                    <p className="text-sm text-muted-foreground">{s.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Outreach Statuses</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {OUTREACH_STATUSES.map((s) => (
                  <div key={s.value} className="flex items-center gap-3">
                    <Badge variant="outline" className="text-[11px] w-28 justify-center">{s.label}</Badge>
                    <p className="text-sm text-muted-foreground">{s.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Platform Tab */}
        <TabsContent value="platform" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Import Defaults</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-2 text-muted-foreground">
              <div className="flex justify-between"><span>Default duplicate strategy</span><Badge variant="outline" className="text-[11px]">Flag for review</Badge></div>
              <div className="flex justify-between"><span>Auto-normalize on import</span><Badge variant="outline" className="text-[11px]">Enabled</Badge></div>
              <div className="flex justify-between"><span>Default page size</span><Badge variant="outline" className="text-[11px]">25</Badge></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Data Quality Scoring</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-2 text-muted-foreground">
              <p>Quality scores are calculated based on field completeness:</p>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {[
                  { field: "Email", weight: "20 pts" },
                  { field: "Name", weight: "10 pts" },
                  { field: "Job Title", weight: "10 pts" },
                  { field: "Company", weight: "10 pts" },
                  { field: "LinkedIn", weight: "15 pts" },
                  { field: "Phone", weight: "10 pts" },
                  { field: "Country", weight: "10 pts" },
                  { field: "Department", weight: "5 pts" },
                  { field: "Seniority", weight: "5 pts" },
                  { field: "Source", weight: "5 pts" },
                ].map((f) => (
                  <div key={f.field} className="flex justify-between">
                    <span>{f.field}</span><span className="font-medium text-foreground">{f.weight}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {settings.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Platform Settings</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {settings.map((s) => (
                    <div key={s.id} className="flex justify-between text-sm">
                      <span className="text-muted-foreground font-mono text-xs">{s.key}</span>
                      <span className="text-xs">{typeof s.value === "string" ? s.value : JSON.stringify(s.value)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Tag create/edit dialog */}
      <Dialog open={tagDialog} onOpenChange={setTagDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingTag ? "Edit Tag" : "New Tag"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Tag name" value={tagName} onChange={(e) => setTagName(e.target.value)} />
            <div>
              <p className="text-xs text-muted-foreground mb-2">Color</p>
              <div className="flex gap-2 flex-wrap">
                {TAG_COLORS.map((c) => (
                  <button key={c} onClick={() => setTagColor(c)}
                    className={`h-7 w-7 rounded-full border-2 transition-all ${tagColor === c ? "border-foreground scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTagDialog(false)}>Cancel</Button>
            <Button disabled={!tagName.trim()} onClick={saveTag}>{editingTag ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete tag confirmation */}
      <Dialog open={!!deleteTagId} onOpenChange={(o) => !o && setDeleteTagId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Tag</DialogTitle>
            <DialogDescription>This will remove the tag from all contacts and companies. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTagId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={deleteTag}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
