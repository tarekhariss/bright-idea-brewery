import { PageContainer, SectionHeader, EmptyState, KpiCard } from "@/components/verification/kit";
import { useBounceFeedback } from "@/hooks/use-verification-platform";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertOctagon } from "lucide-react";
import { useMemo } from "react";
import { formatDistanceToNow } from "date-fns";

const categoryColor: Record<string, string> = {
  hard_bounce: "bg-rose-500/10 text-rose-500 border-rose-500/20",
  soft_bounce: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  mailbox_full: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  spam_block: "bg-rose-500/10 text-rose-500 border-rose-500/20",
  greylisted: "bg-sky-500/10 text-sky-500 border-sky-500/20",
  invalid_recipient: "bg-rose-500/10 text-rose-500 border-rose-500/20",
  policy_block: "bg-violet-500/10 text-violet-500 border-violet-500/20",
  temporary_failure: "bg-sky-500/10 text-sky-500 border-sky-500/20",
};

export default function BounceIntelligencePage() {
  const { data = [], isLoading } = useBounceFeedback();
  const stats = useMemo(() => {
    const byCat: Record<string, number> = {};
    let hard = 0, soft = 0;
    data.forEach((b: any) => {
      const c = b.bounce_category ?? b.bounce_type ?? "unknown";
      byCat[c] = (byCat[c] ?? 0) + 1;
      if (b.bounce_type === "hard") hard++;
      if (b.bounce_type === "soft") soft++;
    });
    return { byCat, hard, soft, total: data.length };
  }, [data]);

  return (
    <PageContainer>
      <SectionHeader title="Bounce Intelligence" subtitle="SMTP bounces ingested from sending infrastructure, classified by RFC reason category." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Total bounces (90d)" value={stats.total} icon={AlertOctagon} />
        <KpiCard label="Hard bounces" value={stats.hard} accent="rose" />
        <KpiCard label="Soft bounces" value={stats.soft} accent="amber" />
        <KpiCard label="Categories" value={Object.keys(stats.byCat).length} accent="sky" />
      </div>

      <Card>
        {isLoading ? <div className="p-8 text-sm text-muted-foreground">Loading…</div> : data.length === 0 ? (
          <EmptyState icon={AlertOctagon} title="No bounces recorded" description="Bounces appear here as sending infrastructure forwards SMTP feedback." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>SMTP</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead className="text-right">Received</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.slice(0, 200).map((b: any) => (
                <TableRow key={b.id}>
                  <TableCell className="font-mono text-xs">{b.email_normalized}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[11px] ${categoryColor[b.bounce_category] ?? ""}`}>
                      {(b.bounce_category ?? b.bounce_type ?? "—").replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{b.smtp_code ?? "—"}</TableCell>
                  <TableCell className="text-xs">{b.provider ?? "—"}</TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {b.received_at ? formatDistanceToNow(new Date(b.received_at), { addSuffix: true }) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </PageContainer>
  );
}
