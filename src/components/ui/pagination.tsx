"use client";

import { Button } from "./button";

interface PaginationProps {
  page: number; // zero-based
  totalPages: number;
  totalElements: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, totalElements, onPageChange }: PaginationProps) {
  return (
    <div className="flex items-center justify-between text-sm text-gray-600">
      <span>
        {totalElements} résultat{totalElements > 1 ? "s" : ""}
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={page <= 0}
          onClick={() => onPageChange(page - 1)}
        >
          Précédent
        </Button>
        <span className="px-1">
          Page {totalPages === 0 ? 0 : page + 1} / {totalPages}
        </span>
        <Button
          variant="secondary"
          size="sm"
          disabled={page >= totalPages - 1}
          onClick={() => onPageChange(page + 1)}
        >
          Suivant
        </Button>
      </div>
    </div>
  );
}
