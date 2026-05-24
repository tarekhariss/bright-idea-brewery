import { PageContainer, SectionHeader, EmptyState, KpiCard } from "@/components/verification/kit";
import { useDomainReputation } from "@/hooks/use-verification-platform";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Boxes } from "lucide-react";
import { useMemo } from "react";

export default function ProviderIntelligencePage() {
  const { data = [], isLoading } = useDomainReputation(1000);

  const grouped = useMemo(() => {
    const m = new Map<string, any>();
    data.forEach((d: any) => {
      const key = d.provider_type || d.mx_provider || "Unknown";
      const g = m.get(key) || { provider: key, domains: 0, verifications: 0, invalid: 0, bounces: 0, catchAll: 0, riskSum: 0, riskN: 0 };
      g.domains++;
      g.verifications += d.total_verifications || 0;
      g.invalid += d.total_invalid || 0;
      g.bounces += d.total_bounces || 0;
      if (d.is_catch_all) g.catchAll++;
      if (d.risk_score != null) { g.riskSum += Number(d.risk_score); g.riskN++; }
      m.set(key, g);
    });
    return Array.from(m.values()).sort((a, b) => b.verifications - a.verifications);
  }, [data]);

  return (
    <PageContainer>
      <SectionHeader title="Provider Intelligence" subtitle="Aggregated SMTP behavior by mailbox provider (Google, Microsoft, Zoho, custom)." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Providers tracked" value={grouped.length} icon={Boxes} />
        <KpiCard label="Top provider" value={grouped[0]?.provider ?? "—"} hint={`${grouped[0]?.verifications?.toLocaleString() ?? 0} verifications`} accent="sky" />
        <KpiCard label="Catch-all domains" value={grouped.reduce((s, g) => s + g.catchAll, 0)} accent="amber" />
        <KpiCard label="Total bounces" value={grouped.reduce((s, g) => s + g.bounces, 0).toLocaleString()} accent="rose" />
      </div>

      <Card>
        {isLoading ? <div className="p-8 text-sm text-muted-foreground">Loading…</div> : grouped.length === 0 ? (
          <EmptyState icon={Boxes} title="No provider data" description="Stats will populate as verifications complete." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead className="text-right">Domains</TableHead>
                <TableHead className="text-right">Verifications</TableHead>
                <TableHead className="text-right">Invalid</TableHead>
                <TableHead className="text-right">Bounces</TableHead>
                <TableHead className="text-right">Catch-all</TableHead>
                <TableHead className="text-right">Avg risk</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grouped.map((g) => (
                <TableRow key={g.provider}>
                  <TableCell className="font-medium">{g.provider}</TableCell>
                  <TableCell className="text-right tabular-nums">{g.domains}</TableCell>
                  <TableCell className="text-right tabular-nums">{g.verifications.toLocaleString()}</TableCell>
                  <TableCell className="text-right tabular-nums">{g.invalid.toLocaleString()}</TableCell>
                  <TableCell className="text-right tabular-nums">{g.bounces.toLocaleString()}</TableCell>
                  <TableCell className="text-right tabular-nums">{g.catchAll}</TableCell>
                  <TableCell className="text-right tabular-nums">{g.riskN ? (g.riskSum / g.riskN).toFixed(1) : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </PageContainer>
  );
}
