import {
  Inbox, Mail, User, Clock, Archive, Star,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useInboxThreads } from "@/hooks/use-outbound-config";
import { format } from "date-fns";

const statusColor: Record<string, string> = {
  open: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  snoozed: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  closed: "bg-muted text-muted-foreground",
  archived: "bg-muted text-muted-foreground",
};

export default function InboxPage() {
  const { data: threads, isLoading } = useInboxThreads();

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
          <Inbox className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reply Inbox</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track and manage incoming replies from campaigns and sequences.
          </p>
        </div>
      </div>

      <Tabs defaultValue="open" className="space-y-4">
        <TabsList className="h-8">
          <TabsTrigger value="open" className="text-xs h-7">Open</TabsTrigger>
          <TabsTrigger value="snoozed" className="text-xs h-7">Snoozed</TabsTrigger>
          <TabsTrigger value="closed" className="text-xs h-7">Closed</TabsTrigger>
        </TabsList>

        {["open", "snoozed", "closed"].map((tab) => (
          <TabsContent key={tab} value={tab}>
            {isLoading ? (
              <div className="space-y-2">{[1,2,3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
            ) : !threads?.filter((t: any) => t.status === tab).length ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <Inbox className="h-8 w-8 text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground">No {tab} threads</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-1">
                {threads?.filter((t: any) => t.status === tab).map((thread: any) => (
                  <Card key={thread.id} className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                        <User className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">
                            {thread.contacts?.first_name} {thread.contacts?.last_name}
                          </p>
                          <Badge className={`${statusColor[thread.status]} text-[10px]`}>{thread.status}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{thread.subject || "No subject"}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[10px] text-muted-foreground">{thread.last_message_at ? format(new Date(thread.last_message_at), "MMM d, h:mm a") : "—"}</p>
                        <p className="text-[10px] text-muted-foreground">{thread.message_count} messages</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
