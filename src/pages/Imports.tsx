import { Card, CardContent } from "@/components/ui/card";
import { Upload } from "lucide-react";

export default function ImportsPage() {
  return (
    <div className="p-6 space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold">Import Center</h1>
        <p className="text-sm text-muted-foreground">Upload and manage CSV imports</p>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <Upload className="h-10 w-10 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">Import engine coming soon</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            The CSV import pipeline will support file uploads, column mapping, deduplication, and batch processing for large datasets.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
