import Link from "next/link";
import { Home, Users2, List, History } from "lucide-react";
import Image from "next/image";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { logout } from "@/components/actions/logout-action";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex min-h-screen">
        <aside className="fixed inset-y-0 left-0 z-10 w-16 flex flex-col border-r bg-background p-4">
          <div className="flex flex-col items-center gap-8">
            <Link
              href="/"
              className="flex items-center justify-center rounded-full"
            >
              <Image
                src="/images/vinta.png"
                alt="Vinta"
                width={64}
                height={64}
                className="object-cover transition-transform duration-200 hover:scale-105"
              />
            </Link>
            <Link
              href="/dashboard"
              aria-label="Dashboard"
              className="flex items-center justify-center min-h-[44px] min-w-[44px] rounded-md text-muted-foreground hover:text-foreground hover:bg-white/5"
            >
              <List className="h-5 w-5" />
            </Link>
            <Link
              href="/customers"
              aria-label="Customers"
              className="flex items-center justify-center min-h-[44px] min-w-[44px] rounded-md text-muted-foreground hover:text-foreground hover:bg-white/5"
            >
              <Users2 className="h-5 w-5" />
            </Link>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/dashboard/debates"
                  className="flex items-center justify-center min-h-[44px] min-w-[44px] rounded-md text-muted-foreground hover:text-foreground hover:bg-white/5"
                  aria-label="Debate History"
                >
                  <History className="h-5 w-5" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">Debate History</TooltipContent>
            </Tooltip>
          </div>
        </aside>
        <main className="ml-16 w-full p-8 bg-muted/40">
          <header className="flex justify-between items-center mb-6">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link href="/" className="flex items-center gap-2">
                      <Home className="h-4 w-4" />
                      <span>Home</span>
                    </Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator>/</BreadcrumbSeparator>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link href="/dashboard" className="flex items-center gap-2">
                      <List className="h-4 w-4" />
                      <span>Dashboard</span>
                    </Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <div className="relative">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center justify-center w-10 h-10 rounded-full bg-muted hover:bg-muted/80" aria-label="User menu">
                    <Avatar>
                      <AvatarFallback>U</AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="bottom">
                  <DropdownMenuItem>
                    <Link
                      href="/support"
                      className="block px-4 py-2 text-sm text-muted-foreground hover:bg-muted rounded"
                    >
                      Support
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <button
                      onClick={logout}
                      className="block px-4 py-2 text-sm text-muted-foreground hover:bg-muted rounded"
                    >
                      Logout
                    </button>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <section className="grid gap-6">
            {children}
          </section>
        </main>
      </div>
    </TooltipProvider>
  );
}
