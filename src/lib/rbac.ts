/**
 * Front-end role-based access control for the Policy Bear Operations CRM.
 *
 * This is a demo/UI layer only: it decides what a signed-in user can SEE and
 * navigate to. When the real API is connected, replace `DEMO_ACCOUNTS` with the
 * authenticated session payload and keep `ROUTE_ACCESS` / `canAccess` as the
 * single source of truth for client-side gating (the server must re-check too).
 */

import type { Role } from "@/lib/mock-data";

export type Department =
  | "Executive"
  | "Sales Floor"
  | "Quality Control"
  | "Human Resources"
  | "Accounting"
  | "Operations"
  | "IT / Administration";

export interface DemoAccount {
  id: string;
  name: string;
  email: string;
  /** Demo-only credential. Never ship real passwords in frontend code. */
  password: string;
  role: Role;
  department: Department;
  title: string;
  team: string;
  avatarInitials: string;
  landing: string;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    id: "usr-ceo",
    name: "Owen Klein",
    email: "ceo@policybear.com",
    password: "Bear#CEO2026",
    role: "CEO",
    department: "Executive",
    title: "Chief Executive Officer",
    team: "Executive",
    avatarInitials: "OK",
    landing: "/dashboard",
  },
  {
    id: "usr-admin",
    name: "Priya Raman",
    email: "admin@policybear.com",
    password: "Bear#Admin2026",
    role: "Administrator",
    department: "IT / Administration",
    title: "System Administrator",
    team: "IT",
    avatarInitials: "PR",
    landing: "/admin/users",
  },
  {
    id: "usr-ops",
    name: "Marcus Hale",
    email: "operations@policybear.com",
    password: "Bear#Ops2026",
    role: "Operations",
    department: "Operations",
    title: "Operations Manager",
    team: "Floor Control",
    avatarInitials: "MH",
    landing: "/dashboard",
  },
  {
    id: "usr-hr",
    name: "Dana Reyes",
    email: "hr@policybear.com",
    password: "Bear#HR2026",
    role: "HR",
    department: "Human Resources",
    title: "HR Business Partner",
    team: "People Ops",
    avatarInitials: "DR",
    landing: "/dashboard",
  },
  {
    id: "usr-qc",
    name: "Leo Whitaker",
    email: "qc@policybear.com",
    password: "Bear#QC2026",
    role: "QC",
    department: "Quality Control",
    title: "Quality Control Lead",
    team: "QC Pod A",
    avatarInitials: "LW",
    landing: "/dashboard",
  },
  {
    id: "usr-accounting",
    name: "Nadia Bloom",
    email: "accounting@policybear.com",
    password: "Bear#Acct2026",
    role: "Accounting",
    department: "Accounting",
    title: "Payroll & Commissions Analyst",
    team: "Finance",
    avatarInitials: "NB",
    landing: "/dashboard",
  },
  {
    id: "usr-agent",
    name: "Amelia Carter",
    email: "agent@policybear.com",
    password: "Bear#Agent2026",
    role: "Agent",
    department: "Sales Floor",
    title: "Licensed Sales Agent",
    team: "Team Falcon",
    avatarInitials: "AC",
    landing: "/dashboard",
  },
];

const ALL: Role[] = [
  "Agent",
  "QC",
  "HR",
  "Accounting",
  "Operations",
  "CEO",
  "Administrator",
];

/** Roles that see everything regardless of the rules below. */
export const SUPER_ROLES: Role[] = ["CEO", "Administrator"];

/**
 * Longest-prefix-wins access rules. Anything not listed defaults to
 * leadership-only so new screens are never accidentally public.
 */
export const ROUTE_ACCESS: { prefix: string; roles: Role[] }[] = [
  // Personal workspace — everyone
  { prefix: "/dashboard", roles: ALL },
  { prefix: "/my-work", roles: ALL },
  { prefix: "/notifications", roles: ALL },
  { prefix: "/search", roles: ALL },
  { prefix: "/messages", roles: ALL },
  { prefix: "/texting", roles: ALL },
  { prefix: "/feed", roles: ALL },
  { prefix: "/announcements", roles: ALL },
  { prefix: "/my-shift", roles: ALL },
  { prefix: "/unauthorized", roles: ALL },
  { prefix: "/onboarding", roles: ALL },

  // Attendance & floor control
  { prefix: "/live-operations", roles: ["Operations", "HR", "QC"] },
  { prefix: "/attendance-exceptions", roles: ["Operations", "HR"] },
  { prefix: "/attendance", roles: ["Operations", "HR"] },
  { prefix: "/break-alarm", roles: ["Operations", "HR"] },

  // Telephony sync, monitoring and attribution
  { prefix: "/dnc", roles: ["Agent", "QC", "Operations", "HR", "Accounting"] },
  { prefix: "/agent-desk", roles: ["Agent", "QC", "Operations"] },
  { prefix: "/telephony-floor", roles: ["Operations", "QC", "HR"] },
  { prefix: "/telephony-monitor", roles: ["Operations", "QC"] },
  { prefix: "/telephony-attribution", roles: ["Operations", "Accounting"] },


  // Pipeline
  { prefix: "/customers", roles: ["Agent", "QC", "Operations"] },
  { prefix: "/calls", roles: ["Agent", "QC", "Operations"] },
  { prefix: "/call-reconciliation", roles: ["Operations", "Accounting"] },
  { prefix: "/call-costs", roles: ["Operations", "Accounting"] },
  { prefix: "/callbacks", roles: ["Agent", "Operations"] },

  // Sales
  { prefix: "/quotes", roles: ["Agent", "Operations"] },
  { prefix: "/sales", roles: ["Agent", "QC", "Operations", "Accounting"] },
  { prefix: "/retention", roles: ["Agent", "QC", "Operations"] },

  // Quality control
  { prefix: "/qa", roles: ["QC", "Operations"] },

  // Traffic
  { prefix: "/publishers", roles: ["Operations", "Accounting"] },
  { prefix: "/campaigns", roles: ["Operations", "Accounting"] },

  // People
  { prefix: "/employees", roles: ["HR", "Operations"] },
  { prefix: "/leave", roles: ["HR", "Operations"] },
  { prefix: "/complaints", roles: ["HR"] },
  { prefix: "/automations", roles: ["HR", "Operations"] },

  // Finance
  { prefix: "/payroll", roles: ["Accounting", "HR"] },
  { prefix: "/commissions", roles: ["Accounting", "Operations"] },
  { prefix: "/expenses", roles: ["Accounting"] },
  { prefix: "/revenue", roles: ["Accounting"] },

  // Control
  { prefix: "/operations", roles: ["Operations"] },
  { prefix: "/reports", roles: ["Operations", "Accounting", "HR", "QC"] },
  { prefix: "/tasks", roles: ["Operations", "HR", "QC", "Accounting"] },
  { prefix: "/incidents", roles: ["Operations", "HR"] },
  { prefix: "/documents", roles: ["Operations", "HR", "QC", "Accounting"] },

  // Agent onboarding workspace — people teams manage it too
  { prefix: "/admin/onboarding", roles: ["HR", "Operations"] },

  // Administration — locked to super roles by default rule
  { prefix: "/admin", roles: [] },
];

export function canAccess(role: Role | undefined, path: string): boolean {
  if (!role) return false;
  if (SUPER_ROLES.includes(role)) return true;

  const match = ROUTE_ACCESS.filter((rule) => path.startsWith(rule.prefix)).sort(
    (a, b) => b.prefix.length - a.prefix.length,
  )[0];

  return match ? match.roles.includes(role) : false;
}

/** Coarse capability flags for showing/hiding actions inside a page. */
export const CAPABILITIES = {
  manageUsers: ["CEO", "Administrator"] as Role[],
  configureAlarms: ["CEO", "Administrator", "Operations", "HR"] as Role[],
  approveExceptions: ["CEO", "Administrator", "Operations", "HR"] as Role[],
  viewFinancials: ["CEO", "Administrator", "Accounting"] as Role[],
  scoreQa: ["CEO", "Administrator", "QC"] as Role[],
  sellPolicies: ["CEO", "Administrator", "Agent"] as Role[],
} as const;

export type Capability = keyof typeof CAPABILITIES;

export function hasCapability(role: Role | undefined, capability: Capability) {
  return !!role && CAPABILITIES[capability].includes(role);
}
