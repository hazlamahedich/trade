import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableHeader,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { fetchItems } from "@/components/actions/items-action";
import { DeleteButton } from "./deleteButton";
import { ReadItemResponse } from "@/app/openapi-client";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { PageSizeSelector } from "@/components/page-size-selector";
import { PagePagination } from "@/components/page-pagination";

interface DashboardPageProps {
  searchParams: Promise<{
    page?: string;
    size?: string;
  }>;
}

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const size = Number(params.size) || 10;

  const items = (await fetchItems(page, size)) as ReadItemResponse;
  const totalPages = Math.ceil((items.total || 0) / size);

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-2 text-slate-100">Welcome to your Dashboard</h2>
      <p className="text-lg mb-6 text-slate-400">
        Here, you can see the overview of your items and manage them.
      </p>

      <div className="mb-6">
        <Link href="/dashboard/add-item">
          <Button variant="outline" className="text-lg px-4 py-2 border-white/15 text-slate-200 hover:bg-white/10">
            Add New Item
          </Button>
        </Link>
      </div>

      <section className="p-6 bg-slate-900 rounded-lg border border-white/15 mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-slate-100">Items</h2>
          <PageSizeSelector currentSize={size} />
        </div>

        <Table className="min-w-full text-sm">
          <TableHeader>
            <TableRow className="border-white/15 hover:bg-transparent">
              <TableHead className="w-[120px] text-slate-300">Name</TableHead>
              <TableHead className="text-slate-300">Description</TableHead>
              <TableHead className="text-center text-slate-300">Quantity</TableHead>
              <TableHead className="text-center text-slate-300">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!items.items?.length ? (
              <TableRow className="border-white/15">
                <TableCell colSpan={4} className="text-center text-slate-400">
                  No results.
                </TableCell>
              </TableRow>
            ) : (
              items.items.map((item, index) => (
                <TableRow key={index} className="border-white/15 hover:bg-white/5">
                  <TableCell className="text-slate-200">{item.name}</TableCell>
                  <TableCell className="text-slate-300">{item.description}</TableCell>
                  <TableCell className="text-center text-slate-300">{item.quantity}</TableCell>
                  <TableCell className="text-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger className="cursor-pointer p-1 text-slate-400 hover:text-slate-200">
                        <span className="text-lg font-semibold">...</span>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="p-2 bg-slate-900 border-white/15">
                        <DropdownMenuItem disabled={true} className="text-slate-400">
                          Edit
                        </DropdownMenuItem>
                        <DeleteButton itemId={item.id} />
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination Controls */}
        <PagePagination
          currentPage={page}
          totalPages={totalPages}
          pageSize={size}
          totalItems={items.total || 0}
          basePath="/dashboard"
        />
      </section>
    </div>
  );
}
