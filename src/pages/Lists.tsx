import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { List } from "lucide-react";

export default function ListsPage() {
  return (
    <div className="p-6 space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold">Lists</h1>
        <p className="text-sm text-muted-foreground">Create and manage contact lists for segmentation</p>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <List className="h-10 w-10 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">No lists yet</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Lists allow you to segment contacts into groups for targeted outreach. Create your first list to get started.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
