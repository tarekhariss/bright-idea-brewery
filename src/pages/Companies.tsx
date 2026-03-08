import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

const PAGE_SIZE = 25;

interface Company {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  country: string | null;
  employee_range: string | null;
  employee_count: number | null;
  data_quality_score: number | null;
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("companies")
      .select("id, name, domain, industry, country, employee_range, employee_count, data_quality_score", { count: "exact" })
      .order("updated_at", { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (search.trim()) {
      query = query.or(`name.ilike.%${search}%,domain.ilike.%${search}%,industry.ilike.%${search}%`);
    }

    const { data, count: total, error } = await query;
    if (!error) {
      setCompanies(data ?? []);
      setCount(total ?? 0);
    }
    setLoading(false);
  }, [page, search]);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const totalPages = Math.ceil(count / PAGE_SIZE);

  const qualityColor = (score: number | null) => {
    if (score === null) return "text-muted-foreground";
    if (score >= 70) return "text-green-600";
    if (score >= 40) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="p-6 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Companies</h1>
          <p className="text-sm text-muted-foreground">{count.toLocaleString()} total companies</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, domain, or industry..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="pl-9"
          />
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Domain</TableHead>
              <TableHead>Industry</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Size</TableHead>
              <TableHead className="text-right">Quality</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : companies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                  No companies found
                </TableCell>
              </TableRow>
            ) : (
              companies.map((c) => (
                <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-muted-foreground">{c.domain ?? "—"}</TableCell>
                  <TableCell>{c.industry ?? "—"}</TableCell>
                  <TableCell>{c.country ?? "—"}</TableCell>
                  <TableCell>
                    {c.employee_range ? (
                      <Badge variant="outline" className="text-xs">{c.employee_range}</Badge>
                    ) : c.employee_count ? (
                      c.employee_count.toLocaleString()
                    ) : "—"}
                  </TableCell>
                  <TableCell className={`text-right font-medium ${qualityColor(c.data_quality_score)}`}>
                    {c.data_quality_score !== null ? `${c.data_quality_score}%` : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Page {page + 1} of {totalPages}
            </p>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
