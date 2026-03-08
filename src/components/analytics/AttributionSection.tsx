import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DollarSign, Target, Calendar, TrendingUp } from "lucide-react";
import { format } from "date-fns";

interface Attribution {
  id: string;
  campaign_id: string;
  attribution_type: string;
  attributed_revenue: number | null;
  deal_id: string | null;
  meeting_id: string | null;
  created_at: string;
  campaigns?: { name: string } | null;
}

interface Props {
  attributions: Attribution[];
  title?: string;
}

const typeBadge = (t: string) => {
  const map: Record<string, string> = {
    first_touch: "bg-primary/10 text-primary border-primary/20",
    last_touch: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    multi_touch: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  };
  return <Badge variant="outline" className={`${map[t] || ""} text-[10px] capitalize`}>{t.replace("_", " ")}</Badge>;
};

export function AttributionSection({ attributions, title = "Attribution" }: Props) {
  const totalRevenue = attributions.reduce((s, a) => s + (Number(a.attributed_revenue) || 0), 0);
  const meetings = attributions.filter(a => a.meeting_id).length;
  const deals = attributions.filter(a => a.deal_id).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <DollarSign className="h-3.5 w-3.5" /> Attributed Revenue
            </div>
            <p className="text-lg font-bold">${totalRevenue.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Calendar className="h-3.5 w-3.5" /> Meetings
            </div>
            <p className="text-lg font-bold">{meetings}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Target className="h-3.5 w-3.5" /> Deals
            </div>
            <p className="text-lg font-bold">{deals}</p>
          </CardContent>
        </Card>
      </div>

      {attributions.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{title} History</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Campaign</TableHead>
                  <TableHead className="text-xs">Type</TableHead>
                  <TableHead className="text-xs">Revenue</TableHead>
                  <TableHead className="text-xs">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attributions.map(a => (
                  <TableRow key={a.id}>
                    <TableCell className="text-xs">{(a.campaigns as any)?.name || "—"}</TableCell>
                    <TableCell>{typeBadge(a.attribution_type)}</TableCell>
                    <TableCell className="text-xs tabular-nums">${Number(a.attributed_revenue || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {a.created_at ? format(new Date(a.created_at), "MMM d, yyyy") : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            <TrendingUp className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
            No attribution data yet
          </CardContent>
        </Card>
      )}
    </div>
  );
}
