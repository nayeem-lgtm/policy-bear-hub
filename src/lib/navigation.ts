import {
  Activity,
  AlarmClock,
  AlertTriangle,
  Banknote,
  BarChart3,
  BellRing,
  Building2,
  CalendarClock,
  CalendarDays,
  Contact,
  Database,
  Gauge,
  Headphones,
  Home,
  LayoutDashboard,
  MessagesSquare,
  PhoneCall,
  PhoneForwarded,
  Plug,
  ReceiptText,
  Repeat,
  ScrollText,
  ShieldCheck,
  ShieldOff,
  SlidersHorizontal,
  Sparkles,
  UserCog,
  UserPlus,
  Video,
  Wallet,
} from "lucide-react";

export interface NavItem {
  title: string;
  url: string;
  icon: typeof Home;
  description?: string;
}

export interface NavSubGroup {
  label: string;
  items: NavItem[];
}

export interface NavSection {
  id: "operation" | "agent" | "publisher" | "finance" | "other";
  label: string;
  tagline: string;
  icon: typeof Home;
  home: string;
  groups: NavSubGroup[];
}

export const navSections: NavSection[] = [
  {
    id: "operation",
    label: "Admin",
    tagline: "Company-wide admin overview",
    icon: Activity,
    home: "/operations",
    groups: [
      {
        label: "Command center",
        items: [
          {
            title: "Admin Overview",
            url: "/operations",
            icon: LayoutDashboard,
            description: "Everything in one place — calls, sales, QA, money, people and approvals",
          },
        ],
      },
    ],
  },

  {
    id: "agent",
    label: "Agent",
    tagline: "Shift, attendance and the calling desk",
    icon: Headphones,
    home: "/dashboard",
    groups: [
      {
        label: "Daily work",
        items: [
          { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, description: "Your day at a glance" },
          { title: "Agent Desk", url: "/agent-desk", icon: Headphones, description: "Take and handle calls" },
          { title: "Customers & Sales", url: "/customers", icon: Contact, description: "Customer records, policies, payments and commission" },
          { title: "Quotes", url: "/quotes", icon: Sparkles, description: "Pull and compare quotes" },
          { title: "Callbacks", url: "/callbacks", icon: PhoneForwarded, description: "Callback queue and calendar in one book" },
          { title: "Chat", url: "/messages", icon: MessagesSquare, description: "One company room for the whole floor" },
          { title: "Meetings", url: "/meetings", icon: Video, description: "Schedule meetings, invite the team, join the video room" },
          { title: "My Onboarding", url: "/onboarding", icon: UserPlus, description: "Complete your agent onboarding: licensing, banking, documents" },

          { title: "DNC & Compliance", url: "/dnc", icon: ShieldOff, description: "Do-Not-Call list, add numbers and audit log" },
        ],
      },
      {
        label: "Attendance",
        items: [
          { title: "My Shift", url: "/my-shift", icon: AlarmClock, description: "Clock in, breaks, shift status" },
          { title: "Break Alarm", url: "/break-alarm", icon: BellRing, description: "Break timers and alerts" },
          { title: "Attendance", url: "/attendance", icon: CalendarClock, description: "Attendance records" },
          { title: "Leave", url: "/leave", icon: CalendarDays, description: "Time off requests" },
        ],
      },
    ],
  },
  {
    id: "publisher",
    label: "Publisher",
    tagline: "Traffic, calls delivered, conversion and QA",
    icon: Building2,
    home: "/publishers",
    groups: [
      {
        label: "Traffic",
        items: [
          { title: "Dashboard", url: "/publishers", icon: Building2, description: "Publisher overview" },
          { title: "Reporting", url: "/reporting", icon: BarChart3, description: "Full call and revenue report" },
          { title: "Calls", url: "/calls", icon: PhoneCall, description: "All calls received" },

        ],
      },
      {
        label: "Quality & recordings",
        items: [
          { title: "QA Reviews", url: "/qa", icon: ShieldCheck, description: "Score call recordings" },
          { title: "Reporting", url: "/qa/reporting", icon: BarChart3, description: "Publisher sales reporting" },
          { title: "Escalations", url: "/qa/escalations", icon: AlertTriangle, description: "Disputes and quality tickets" },
        ],
      },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    tagline: "Money in, money out",
    icon: Wallet,
    home: "/revenue",
    groups: [
      {
        label: "Money",
        items: [
          { title: "Overview", url: "/revenue", icon: BarChart3, description: "Company finance overview" },
          { title: "Payroll", url: "/payroll", icon: Wallet, description: "Staff pay runs" },
          { title: "Commissions", url: "/commissions", icon: Banknote, description: "Agent commissions" },
          { title: "Expenses", url: "/expenses", icon: ReceiptText, description: "Company spending" },
        ],
      },
    ],
  },
  {
    id: "other",
    label: "Settings",
    tagline: "Access control, telephony and system configuration",
    icon: SlidersHorizontal,
    home: "/admin/users",
    groups: [
      {
        label: "Access control",
        items: [
          {
            title: "Users & Roles",
            url: "/admin/users",
            icon: UserCog,
            description: "Accounts, roles and permissions",
          },
          {
            title: "Agent Onboarding",
            url: "/admin/onboarding",
            icon: UserPlus,
            description: "Hiring, onboarding form, offer letter, carrier approval and access",
          },
          {
            title: "Business Rules",
            url: "/admin/rules",
            icon: SlidersHorizontal,
            description: "Commission, QA and shift rules",
          },
          {
            title: "Audit Logs",
            url: "/admin/audit",
            icon: ScrollText,
            description: "Every change, who and when",
          },
        ],
      },
      {
        label: "Telephony",
        items: [
          {
            title: "Phone System",
            url: "/admin/phone-system",
            icon: PhoneCall,
            description: "Numbers, routing and voicemail",
          },
          {
            title: "Telephony Sync",
            url: "/admin/telephony",
            icon: Repeat,
            description: "Call and recording sync jobs",
          },
          {
            title: "CallTools Control",
            url: "/admin/calltools",
            icon: Headphones,
            description: "Dialer connection and agents",
          },
        ],
      },
      {
        label: "Platform",
        items: [
          {
            title: "Integrations",
            url: "/admin/integrations",
            icon: Plug,
            description: "Carriers, Ringba and webhooks",
          },
          {
            title: "Data & Import Center",
            url: "/admin/imports",
            icon: Database,
            description: "Import, export, sync connectors and data quality checks",
          },
          {
            title: "System Health",
            url: "/admin/health",
            icon: Gauge,
            description: "Uptime, queues and errors",
          },
        ],
      },
    ],
  },
];

export function findSectionForPath(pathname: string): NavSection["id"] {
  let best: { id: NavSection["id"]; len: number } | null = null;
  for (const section of navSections) {
    for (const group of section.groups) {
      for (const item of group.items) {
        if (pathname === item.url || pathname.startsWith(item.url + "/")) {
          if (!best || item.url.length > best.len) best = { id: section.id, len: item.url.length };
        }
      }
    }
  }
  return best?.id ?? "agent";
}
