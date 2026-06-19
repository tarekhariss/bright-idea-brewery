import { useState } from "react";
import { Inbox, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLinkedinInboxThreads, useLinkedinInboxMessages, useUpdateLinkedinThread } from "@/hooks/use-linkedin-campaigns";
import { ConfigRequiredBanner } from "@/components/config";
import { PushToCrmButton } from "@/components/crm/PushToCrmButton";

const CATEGORIES = [
  { value: "", label: "All" },
  { value: "interested", label: "Interested" },
  { value: "not_interested", label: "Not Interested" },
  { value: "meeting_booked", label: "Meeting Booked" },
  { value: "neutral", label: "Neutral" },
  { value: "auto_reply", label: "Auto Reply" },
  { value: "needs_review", label: "Needs Review" },
];

export default function LinkedinInboxPage() {
  const [category, setCategory] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: threads, isLoading } = useLinkedinInboxThreads({ category: category || undefined });
  const { data: messages } = useLinkedinInboxMessages(selectedId);
  const updateThread = useUpdateLinkedinThread();

  return (
    <div className="flex flex-col h-screen">
      <header className="border-b bg-card px-6 py-3 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600"><Inbox className="h-4 w-4" /></div>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold">LinkedIn Inbox</h1>
          <p className="text-[11px] text-muted-foreground">Replies from your LinkedIn campaigns.</p>
        </div>
      </header>

      <div className="px-6 pt-3">
        <ConfigRequiredBanner capabilities={["linkedin"]} title="LinkedIn Inbox is empty without a connected account" />
      </div>


      <Tabs value={category || "all"} onValueChange={(v) => setCategory(v === "all" ? "" : v)} className="px-6 pt-3">
        <TabsList>
          {CATEGORIES.map((c) => <TabsTrigger key={c.value || "all"} value={c.value || "all"}>{c.label}</TabsTrigger>)}
        </TabsList>
      </Tabs>

      <div className="flex-1 grid grid-cols-[360px_1fr] overflow-hidden mt-3 mx-6 mb-6 border rounded-lg bg-card">
        <div className="border-r overflow-auto">
          {isLoading ? <div className="p-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div> :
            !threads?.length ? <div className="p-8 text-center text-sm text-muted-foreground">No threads.</div> :
              threads.map((t: any) => (
                <button key={t.id} onClick={() => setSelectedId(t.id)} className={`w-full text-left px-4 py-3 border-b hover:bg-muted/50 ${selectedId === t.id ? "bg-muted" : ""}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium truncate">{t.contacts?.first_name} {t.contacts?.last_name || "Unknown"}</p>
                    <span className="text-[10px] text-muted-foreground shrink-0">{t.last_message_at ? new Date(t.last_message_at).toLocaleDateString() : ""}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{t.subject || t.preview || "(no preview)"}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Badge variant="outline" className="text-[10px] capitalize">{(t.user_category || t.category)?.replace("_", " ")}</Badge>
                    {t.linkedin_campaigns?.name && <span className="text-[10px] text-muted-foreground truncate">· {t.linkedin_campaigns.name}</span>}
                  </div>
                </button>
              ))
          }
        </div>
        <div className="overflow-auto p-6">
          {!selectedId ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Select a thread.</div>
          ) : (
            <div className="space-y-4 max-w-2xl">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground">Override:</span>
                  {CATEGORIES.filter(c => c.value).map((c) => (
                    <Button key={c.value} variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => updateThread.mutate({ id: selectedId, user_category: c.value })}>
                      {c.label}
                    </Button>
                  ))}
                </div>
                {(() => {
                  const t: any = threads?.find((x: any) => x.id === selectedId);
                  if (!t) return null;
                  return (
                    <PushToCrmButton
                      size="sm"
                      variant="default"
                      contactId={t.contact_id ?? t.contacts?.id ?? null}
                      sourceThreadId={t.id}
                      sourceThreadType="linkedin"
                      sourceCampaignId={t.linkedin_campaign_id ?? null}
                      sourceCampaignType={t.linkedin_campaign_id ? "linkedin" : null}
                      sourceChannel="linkedin_reply"
                      defaultTitle={t.subject || t.preview || undefined}
                    />
                  );
                })()}
              </div>
              <div className="space-y-3">
                {messages?.map((m: any) => (
                  <Card key={m.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline" className="text-[10px] capitalize">{m.direction}</Badge>
                        <span className="text-[10px] text-muted-foreground">{new Date(m.sent_at).toLocaleString()}</span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{m.body}</p>
                    </CardContent>
                  </Card>
                )) || <div className="text-sm text-muted-foreground">No messages.</div>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
