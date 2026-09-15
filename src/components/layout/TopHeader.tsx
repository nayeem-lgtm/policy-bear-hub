import { useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { findSectionForPath, navSections } from "@/lib/navigation";
import {
  Bell,
  ChevronDown,
  CircleUser,
  Clock,
  LogOut,
  Plus,
  Search,
  Settings,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChatIndicator } from "@/components/messaging/ChatIndicator";
import { PresenceControl } from "@/components/layout/PresenceControl";
import { notifications } from "@/lib/mock-data";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

const quickCreate = [
  { label: "Add Customer", to: "/customers/new" },
  { label: "Schedule Callback", to: "/callbacks" },
  { label: "Add Sale", to: "/sales/new" },
  { label: "Pull Quotes", to: "/quotes" },
  { label: "Start QA Review", to: "/qa" },
  { label: "Report Incident", to: "/incidents" },
  { label: "Create Announcement", to: "/announcements" },
  { label: "Add Expense", to: "/expenses" },
  { label: "Import Data", to: "/admin/imports" },
];

export function TopHeader() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const sectionId = findSectionForPath(pathname);
  const section = navSections.find((s) => s.id === sectionId) ?? navSections[0]!;
  const current = section.groups
    .flatMap((g) => g.items)
    .filter((i) => pathname === i.url || pathname.startsWith(i.url + "/"))
    .sort((a, b) => b.url.length - a.url.length)[0];

  const unread = notifications.filter((n) => !n.read).length;
  const [q, setQ] = useState("");
  const { user, signOut, can } = useAuth();
  const navigate = useNavigate();

  const allowedQuickCreate = quickCreate.filter((item) => can(item.to));

  const handleSignOut = () => {
    signOut();
    void navigate({ to: "/", replace: true });
  };

  if (!user) return null;

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-border/70 bg-card/80 px-3 backdrop-blur-xl md:px-6">
      <SidebarTrigger className="shrink-0" />

      <div className="hidden shrink-0 items-center gap-1.5 text-sm lg:flex">
        <span className="text-muted-foreground">{section.label}</span>
        {current && (
          <>
            <span className="text-muted-foreground/50">/</span>
            <span className="font-medium text-foreground">{current.title}</span>
          </>
        )}
      </div>

      <form
        className="relative hidden min-w-0 flex-1 md:block"
        onSubmit={(e) => e.preventDefault()}
      >
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search customers, calls, policies, employees…"
          className="h-9 max-w-lg rounded-full bg-muted/60 pl-9"
        />
      </form>

      <div className="ml-auto flex items-center gap-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="size-4" />
              <span className="hidden sm:inline">Create</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Quick create</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {allowedQuickCreate.map((item) => (
              <DropdownMenuItem key={item.label} asChild>
                <Link to={item.to}>{item.label}</Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <PresenceControl />

        <Separator orientation="vertical" className="mx-1 hidden h-6 lg:block" />

        <ChatIndicator />

        <Button asChild variant="ghost" size="icon" className="relative">
          <Link to="/notifications" aria-label="Notifications">
            <Bell className="size-4" />
            {unread > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-0.5 -right-0.5 size-4 justify-center rounded-full p-0 text-[0.6rem]"
              >
                {unread}
              </Badge>
            )}
          </Link>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 gap-2 px-1.5">
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-full bg-brand text-[0.7rem] font-semibold text-brand-foreground",
                )}
              >
                {user.avatarInitials}
              </span>
              <span className="hidden text-left leading-tight lg:block">
                <span className="block text-xs font-medium">{user.name}</span>
                <span className="block text-[0.65rem] text-muted-foreground">
                  {user.role} · {user.department}
                </span>
              </span>
              <ChevronDown className="hidden size-3.5 text-muted-foreground lg:block" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <span className="block text-sm font-medium">{user.name}</span>
              <span className="block text-xs text-muted-foreground">{user.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/employees">
                <CircleUser className="size-4" /> My profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/my-shift">
                <Clock className="size-4" /> My shift
              </Link>
            </DropdownMenuItem>
            {can("/admin/rules") && (
            <DropdownMenuItem asChild>
              <Link to="/admin/rules">
                <Settings className="size-4" /> Preferences
              </Link>
            </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={handleSignOut}>
              <LogOut className="size-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
