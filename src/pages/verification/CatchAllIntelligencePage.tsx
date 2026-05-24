import { PageContainer, SectionHeader, EmptyState, KpiCard, RiskTierBadge } from "@/components/verification/kit";
import { useCatchAllDomains } from "@/hooks/use-verification-platform";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BadgeAlert } from "lucide-react";

export default function CatchAllIntelligencePage() {
  const { data = [], isLoading } = useCatchAllDomains();
  const avgConfidence = data.length
    ? (data.reduce((s: number, d: any) => s + Number(d.catch_all_confidence || 0), 0) / data.length).toFixed(1)
    : "—";
  const avgDelivery = data.length
    ? (data.reduce((s: number, d: any) => s + Number(d.catch_all_delivery_success_rate || 0), 0) / data.length).toFixed(1)
    : "—";

  return (
    <PageContainer>
      <SectionHeader title="Catch-All Intelligence" subtitle="Domains that accept every recipient. We score delivery success to separate true catch-all from soft-accept." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Catch-all domains" value={data.length} icon={BadgeAlert} accent="amber" />
        <KpiCard label="Avg confidence" value={`${avgConfidence}${avgConfidence === "—" ? "" : "%"}`} accent="sky" />
        <KpiCard label="Avg delivery success" value={`${avgDelivery}${avgDelivery === "—" ? "" : "%"}`} accent="emerald" />
        <KpiCard label="High-risk catch-alls" value={data.filter((d: any) => d.risk_tier === "high" || d.risk_tier === "critical").length} accent="rose" />
      </div>

      <Card>
        {isLoading ? <div className="p-8 text-sm text-muted-foreground">Loading…</div> : data.length === 0 ? (
          <EmptyState icon={BadgeAlert} title="No catch-all domains" description="Catch-all detection runs automatically during SMTP verification." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Domain</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead className="text-right">Confidence</TableHead>
                <TableHead className="text-right">Delivery success</TableHead>
                <TableHead className="text-right">Verifications</TableHead>
                <TableHead>Risk</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((d: any) => (
                <TableRow key={d.id}>
                  <TableCell className="font-mono text-xs">{d.domain}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{d.provider_type ?? d.mx_provider ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{d.catch_all_confidence ? `${Number(d.catch_all_confidence).toFixed(0)}%` : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{d.catch_all_delivery_success_rate ? `${Number(d.catch_all_delivery_success_rate).toFixed(0)}%` : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{(d.total_verifications ?? 0).toLocaleString()}</TableCell>
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
