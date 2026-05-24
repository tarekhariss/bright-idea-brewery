import { PageContainer, SectionHeader, EmptyState, RiskTierBadge, KpiCard } from "@/components/verification/kit";
import { useDomainReputation } from "@/hooks/use-verification-platform";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Globe, Search, ShieldAlert, ShieldCheck, Activity } from "lucide-react";
import { useState, useMemo } from "react";

export default function DomainIntelligencePage() {
  const { data = [], isLoading } = useDomainReputation(500);
  const [q, setQ] = useState("");
  const filtered = useMemo(() => data.filter((d: any) => !q || d.domain?.toLowerCase().includes(q.toLowerCase())), [data, q]);
  const totals = useMemo(() => {
    const t = { domains: data.length, verified: 0, invalid: 0, catchAll: 0, high: 0 };
    data.forEach((d: any) => {
      t.verified += d.total_verified || 0;
      t.invalid += d.total_invalid || 0;
      if (d.is_catch_all) t.catchAll++;
      if (d.risk_tier === "high" || d.risk_tier === "critical") t.high++;
    });
    return t;
  }, [data]);

  return (
    <PageContainer>
      <SectionHeader title="Domain Intelligence" subtitle="MX provider, SMTP behavior, and risk scoring for every domain seen by the platform." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Tracked domains" value={totals.domains.toLocaleString()} icon={Globe} />
        <KpiCard label="Verified emails" value={totals.verified.toLocaleString()} accent="emerald" icon={ShieldCheck} />
        <KpiCard label="Invalid emails" value={totals.invalid.toLocaleString()} accent="rose" icon={ShieldAlert} />
        <KpiCard label="High-risk domains" value={totals.high.toLocaleString()} accent="amber" icon={Activity} />
      </div>

      <div className="relative w-full max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search domain…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
      </div>

      <Card>
        {isLoading ? (
          <div className="p-8 text-sm text-muted-foreground">Loading domains…</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Globe} title="No domains yet" description="Domain reputation is built automatically as verifications complete." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Domain</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead className="text-right">Verifications</TableHead>
                <TableHead className="text-right">Bounce rate</TableHead>
                <TableHead className="text-right">Quality</TableHead>
                <TableHead>Risk</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.slice(0, 200).map((d: any) => (
                <TableRow key={d.id}>
                  <TableCell className="font-mono text-xs">{d.domain}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{d.provider_type ?? d.mx_provider ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{d.total_verifications?.toLocaleString() ?? 0}</TableCell>
                  <TableCell className="text-right tabular-nums">{d.bounce_rate ? `${Number(d.bounce_rate).toFixed(1)}%` : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{d.quality_score ? Number(d.quality_score).toFixed(0) : "—"}</TableCell>
                  <TableCell><RiskTierBadge tier={d.risk_tier} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </PageContainer>
  );
}
