import { Card, CardContent } from "@/components/ui/card";
import { Bookmark } from "lucide-react";

export default function SavedViewsPage() {
  return (
    <div className="p-6 space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold">Saved Views</h1>
        <p className="text-sm text-muted-foreground">Manage custom filters and column layouts</p>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <Bookmark className="h-10 w-10 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">No saved views yet</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Save custom filter combinations and column layouts for quick access to your most-used views.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
