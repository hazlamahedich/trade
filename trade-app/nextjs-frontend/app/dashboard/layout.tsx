import Link from "next/link";
import { Home, LayoutDashboard, Swords, History } from "lucide-react";
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

const sidebarLinks = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/dashboard/debates", icon: History, label: "Debate History" },
  { href: "/", icon: Swords, label: "New Debate" },
] as const;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex min-h-screen bg-slate-950">
        <aside className="fixed inset-y-0 left-0 z-10 w-16 flex flex-col border-r border-white/15 bg-slate-900 p-4">
          <div className="flex flex-col items-center gap-4">
            <Link
              href="/"
              className="flex items-center justify-center rounded-full"
            >
              <Image
                src="/images/vinta.png"
                alt="Vinta"
                width={48}
                height={48}
                className="object-cover transition-transform duration-200 hover:scale-105"
              />
            </Link>
            <div className="w-8 border-t border-white/15" />
            {sidebarLinks.map(({ href, icon: Icon, label }) => (
              <Tooltip key={href}>
                <TooltipTrigger asChild>
                  <Link
                    href={href}
                    aria-label={label}
                    className="flex items-center justify-center min-h-[44px] min-w-[44px] rounded-md text-slate-400 hover:text-slate-100 hover:bg-white/10 transition-colors"
                  >
                    <Icon className="h-5 w-5" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">{label}</TooltipContent>
              </Tooltip>
            ))}
          </div>
          <div className="mt-auto flex flex-col items-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-700 transition-colors border border-white/15" aria-label="User menu">
                  <Avatar>
                    <AvatarFallback className="bg-slate-800 text-slate-300">U</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top" className="bg-slate-900 border-white/15">
                <DropdownMenuItem>
                  <Link
                    href="/support"
                    className="block px-4 py-2 text-sm text-slate-300 hover:text-slate-100 hover:bg-white/10 rounded w-full"
                  >
                    Support
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <button
                    onClick={logout}
                    className="block px-4 py-2 text-sm text-slate-300 hover:text-slate-100 hover:bg-white/10 rounded w-full"
                  >
                    Logout
                  </button>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </aside>
        <main className="ml-16 w-full p-8">
          <header className="flex justify-between items-center mb-6">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link href="/" className="flex items-center gap-2 text-slate-400 hover:text-slate-200">
                      <Home className="h-4 w-4" />
                      <span>Home</span>
                    </Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="text-slate-600" />
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link href="/dashboard" className="flex items-center gap-2 text-slate-400 hover:text-slate-200">
                      <LayoutDashboard className="h-4 w-4" />
                      <span>Dashboard</span>
                    </Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </header>
          <section className="grid gap-6">
            {children}
          </section>
        </main>
      </div>
    </TooltipProvider>
  );
}
