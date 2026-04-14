import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DoubleArrowLeftIcon,
  DoubleArrowRightIcon,
} from "@radix-ui/react-icons";

interface PagePaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  basePath?: string;
  extraParams?: Record<string, string>;
}

export function PagePagination({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  basePath = "/dashboard",
  extraParams = {},
}: PagePaginationProps) {
  const hasNextPage = currentPage < totalPages;
  const hasPreviousPage = currentPage > 1;

  const buildUrl = (page: number) => {
    const params = new URLSearchParams({
      page: String(page),
      size: String(pageSize),
    });
    Object.entries(extraParams).forEach(([key, val]) => {
      if (val) params.set(key, val);
    });
    return `${basePath}?${params.toString()}`;
  };

  return (
    <div className="flex items-center justify-between my-4">
      <div className="text-sm text-gray-600">
        {totalItems === 0 ? (
          <>Showing 0 of 0 results</>
        ) : (
          <>
            Showing {(currentPage - 1) * pageSize + 1} to{" "}
            {Math.min(currentPage * pageSize, totalItems)} of {totalItems}{" "}
            results
          </>
        )}
      </div>

      <div className="flex items-center space-x-2">
        <Link
          href={buildUrl(1)}
          className={!hasPreviousPage ? "pointer-events-none opacity-50" : ""}
        >
          <Button variant="outline" size="sm" disabled={!hasPreviousPage}>
            <DoubleArrowLeftIcon className="h-4 w-4" />
          </Button>
        </Link>

        <Link
          href={buildUrl(currentPage - 1)}
          className={!hasPreviousPage ? "pointer-events-none opacity-50" : ""}
        >
          <Button variant="outline" size="sm" disabled={!hasPreviousPage}>
            <ChevronLeftIcon className="h-4 w-4" />
          </Button>
        </Link>

        {totalPages > 0 && (
          <span className="text-sm font-medium">
            Page {currentPage} of {totalPages}
          </span>
        )}

        <Link
          href={buildUrl(currentPage + 1)}
          className={hasNextPage ? "" : "pointer-events-none opacity-50"}
        >
          <Button variant="outline" size="sm" disabled={!hasNextPage}>
            <ChevronRightIcon className="h-4 w-4" />
          </Button>
        </Link>

        <Link
          href={buildUrl(totalPages)}
          className={hasNextPage ? "" : "pointer-events-none opacity-50"}
        >
          <Button variant="outline" size="sm" disabled={!hasNextPage}>
            <DoubleArrowRightIcon className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
