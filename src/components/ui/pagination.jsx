import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./button";
export function Pagination({ meta, onPage }) {
    if (!meta || meta.totalPages <= 1)
        return null;
    const from = (meta.page - 1) * meta.pageSize + 1;
    const to = Math.min(meta.page * meta.pageSize, meta.total);
    return (<nav aria-label="Pagination" className="flex items-center justify-between gap-3 pt-2">
      <p className="text-sm text-muted-foreground tabular">
        {from}–{to} of {meta.total}
      </p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>
          <ChevronLeft className="h-4 w-4"/> Previous
        </Button>
        <Button variant="outline" size="sm" disabled={meta.page >= meta.totalPages} onClick={() => onPage(meta.page + 1)}>
          Next <ChevronRight className="h-4 w-4"/>
        </Button>
      </div>
    </nav>);
}
