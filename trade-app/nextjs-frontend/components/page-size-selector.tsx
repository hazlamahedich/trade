"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRouter } from "next/navigation";

interface PageSizeSelectorProps {
  currentSize: number;
  basePath?: string;
  extraParams?: Record<string, string>;
}

export function PageSizeSelector({
  currentSize,
  basePath = "/dashboard",
  extraParams = {},
}: PageSizeSelectorProps) {
  const router = useRouter();
  const pageSizeOptions = [5, 10, 20, 50, 100];

  const handleSizeChange = (newSize: string) => {
    const params = new URLSearchParams({ page: "1", size: newSize });
    Object.entries(extraParams).forEach(([key, val]) => {
      if (val) params.set(key, val);
    });
    router.push(`${basePath}?${params.toString()}`);
  };

  return (
    <div className="flex items-center space-x-2">
      <span className="text-sm text-slate-400">Items per page:</span>
      <Select value={currentSize.toString()} onValueChange={handleSizeChange}>
        <SelectTrigger className="w-20">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {pageSizeOptions.map((option) => (
            <SelectItem key={option} value={option.toString()}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
