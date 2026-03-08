import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Bookmark, ChevronDown, Star, Pencil, Trash2, Save, MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { SavedView, ViewState } from "@/hooks/use-saved-views";

interface SavedViewsDropdownProps {
  views: SavedView[];
  activeViewId: string | null;
  onLoad: (view: SavedView) => void;
  onSave: (name: string) => void;
  onUpdate: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onSetDefault: (id: string) => void;
}

export function SavedViewsDropdown({
  views, activeViewId, onLoad, onSave, onUpdate, onRename, onDelete, onSetDefault,
}: SavedViewsDropdownProps) {
  const [saveOpen, setSaveOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [renameName, setRenameName] = useState("");
  const [renameId, setRenameId] = useState("");

  const activeView = views.find((v) => v.id === activeViewId);

  const handleSave = () => {
    if (!saveName.trim()) return;
    onSave(saveName.trim());
    setSaveName("");
    setSaveOpen(false);
  };

  const handleRename = () => {
    if (!renameName.trim()) return;
    onRename(renameId, renameName.trim());
    setRenameOpen(false);
  };

  const startRename = (view: SavedView) => {
    setRenameId(view.id);
    setRenameName(view.name);
    setRenameOpen(true);
  };

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <Bookmark className="h-3.5 w-3.5" />
            {activeView ? activeView.name : "Views"}
            <ChevronDown className="h-3 w-3 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-2" align="start">
          <div className="flex items-center justify-between px-2 py-1.5">
            <p className="text-xs font-medium text-muted-foreground">Saved Views</p>
            <Button variant="ghost" size="sm" className="h-6 text-xs text-primary" onClick={() => setSaveOpen(true)}>
              <Save className="h-3 w-3 mr-1" /> Save Current
            </Button>
          </div>
          <Separator className="my-1" />
          {views.length === 0 ? (
            <p className="text-xs text-muted-foreground px-2 py-3 text-center">No saved views yet</p>
          ) : (
            <div className="max-h-64 overflow-y-auto space-y-0.5">
              {views.map((view) => (
                <div
                  key={view.id}
                  className={`flex items-center justify-between rounded-md px-2 py-1.5 cursor-pointer transition-colors group ${
                    activeViewId === view.id ? "bg-primary/10 text-primary" : "hover:bg-muted/50"
                  }`}
                  onClick={() => onLoad(view)}
                >
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    {view.is_default && <Star className="h-3 w-3 text-warning shrink-0 fill-warning" />}
                    <span className="text-xs font-medium truncate">{view.name}</span>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 shrink-0">
                        <MoreHorizontal className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-36">
                      {activeViewId === view.id && (
                        <DropdownMenuItem onClick={() => onUpdate(view.id)} className="text-xs">
                          <Save className="h-3 w-3 mr-1.5" /> Update View
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => onSetDefault(view.id)} className="text-xs">
                        <Star className="h-3 w-3 mr-1.5" /> Set as Default
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => startRename(view)} className="text-xs">
                        <Pencil className="h-3 w-3 mr-1.5" /> Rename
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => onDelete(view.id)} className="text-xs text-destructive">
                        <Trash2 className="h-3 w-3 mr-1.5" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Save Dialog */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle className="text-base">Save Current View</DialogTitle></DialogHeader>
          <Input
            placeholder="View name..."
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            className="h-9 text-sm"
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setSaveOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={!saveName.trim()}>Save View</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle className="text-base">Rename View</DialogTitle></DialogHeader>
          <Input
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRename()}
            className="h-9 text-sm"
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setRenameOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleRename} disabled={!renameName.trim()}>Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
