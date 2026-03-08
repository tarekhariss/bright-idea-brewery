import { useRef, ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

interface VirtualizedTableBodyProps<T> {
  items: T[];
  estimateSize?: number;
  overscan?: number;
  renderRow: (item: T, index: number) => ReactNode;
}

/**
 * Virtualized table body — only renders visible rows in DOM.
 * Wrap inside a <tbody> or replace <TableBody>.
 */
export function VirtualizedTableBody<T>({
  items,
  estimateSize = 40,
  overscan = 10,
  renderRow,
}: VirtualizedTableBodyProps<T>) {
  const parentRef = useRef<HTMLTableSectionElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current?.closest(".overflow-auto") as HTMLElement | null,
    estimateSize: () => estimateSize,
    overscan,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  return (
    <tbody ref={parentRef}>
      {totalSize > 0 && (
        <tr style={{ height: virtualItems[0]?.start ?? 0 }}>
          <td colSpan={100} style={{ padding: 0, border: 0 }} />
        </tr>
      )}
      {virtualItems.map((vi) => renderRow(items[vi.index], vi.index))}
      {totalSize > 0 && (
        <tr style={{ height: totalSize - (virtualItems[virtualItems.length - 1]?.end ?? 0) }}>
          <td colSpan={100} style={{ padding: 0, border: 0 }} />
        </tr>
      )}
    </tbody>
  );
}
