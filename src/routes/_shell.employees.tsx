import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Users,
  UserPlus,
  BadgeCheck,
  Building2,
  GraduationCap,
} from "lucide-react";

import { PageHeader } from "@/components/crm/PageHeader";
import { StatCard } from "@/components/crm/StatCard";
import { FilterBar } from "@/components/crm/FilterBar";
import { DataTable, type Column } from "@/components/crm/DataTable";
import { StatusBadge } from "@/components/crm/StatusBadge";
import { useFilters, unique } from "@/lib/use-filters";
import { employees, documents, payrollRows, type Employee } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_shell/employees")({
  head: () => ({
    meta: [
      { title: "Employee Directory — Policy Bear CRM" },
      {
        name: "description",
        content: "HR employee directory with profiles, training progress and documents.",
      },
      { property: "og:title", content: "Employee Directory — Policy Bear CRM" },
      {
        property: "og:description",
        content: "HR employee directory with profiles, training progress and documents.",
      },
    ],
  }),
  component: EmployeesPage,
});

function EmployeesPage() {
  const [selected, setSelected] = useState<Employee | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const departmentOptions = useMemo(() => unique(employees, (e) => e.department), []);
  const teamOptions = useMemo(() => unique(employees, (e) => e.team), []);
  const roleOptions = useMemo(() => unique(employees, (e) => e.role), []);
  const statusOptions = useMemo(() => unique(employees, (e) => e.status), []);

  const { search, setSearch, values, setValue, reset, filtered } = useFilters(employees, {
    searchFields: (e) => [e.name, e.email, e.title],
    filters: {
      department: (e) => e.department,
      team: (e) => e.team,
      role: (e) => e.role,
      status: (e) => e.status,
    },
  });

  const inTrainingCount = employees.filter((e) => e.trainingProgress < 100).length;

  const columns: Column<Employee>[] = [
    {
      key: "name",
      header: "Employee",
      cell: (e) => (
        <div className="flex items-center gap-2.5">
          <Avatar className="size-8">
            <AvatarFallback className="text-xs">{e.avatarInitials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{e.name}</p>
            <p className="truncate text-xs text-muted-foreground">{e.title}</p>
          </div>
        </div>
      ),
    },
    { key: "department", header: "Department", cell: (e) => e.department },
    { key: "team", header: "Team", cell: (e) => e.team },
    { key: "role", header: "Role", cell: (e) => <Badge variant="secondary">{e.role}</Badge> },
    { key: "status", header: "Status", cell: (e) => <StatusBadge status={e.status} /> },
    {
      key: "training",
      header: "Training",
      cell: (e) => (
        <div className="flex w-28 items-center gap-2">
          <Progress value={e.trainingProgress} className="h-1.5" />
          <span className="tabular text-xs text-muted-foreground">{e.trainingProgress}%</span>
        </div>
      ),
    },
    { key: "hire", header: "Hire Date", cell: (e) => e.hireDate },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="People"
        title="Employee Directory"
        description="Every employee record, training progress and access to profile, documents, attendance, payroll and coaching."
        actions={
          <Button onClick={() => setAddOpen(true)}>
            <UserPlus className="size-4" /> Add employee
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Employees" value={employees.length} icon={<Users className="size-4" />} />
        <StatCard
          label="Departments"
          value={departmentOptions.length}
          icon={<Building2 className="size-4" />}
        />
        <StatCard
          label="Training In Progress"
          value={inTrainingCount}
          tone="warning"
          icon={<GraduationCap className="size-4" />}
        />
        <StatCard
          label="Training Complete"
          value={employees.length - inTrainingCount}
          tone="success"
          icon={<BadgeCheck className="size-4" />}
        />
      </div>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name, email or title…"
        filters={[
          { key: "department", label: "Department", options: departmentOptions },
          { key: "team", label: "Team", options: teamOptions },
          { key: "role", label: "Role", options: roleOptions },
          { key: "status", label: "Status", options: statusOptions },
        ]}
        values={values}
        onChange={setValue}
        onReset={reset}
      />

      <DataTable
        columns={columns}
        rows={filtered}
        onRowClick={(row) => setSelected(row)}
        footer={<span>{filtered.length} of {employees.length} employees</span>}
      />

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Avatar className="size-9">
                    <AvatarFallback>{selected.avatarInitials}</AvatarFallback>
                  </Avatar>
                  {selected.name}
                </SheetTitle>
                <SheetDescription>
                  {selected.title} · {selected.department} · {selected.team}
                </SheetDescription>
              </SheetHeader>
              <div className="px-4 pb-6">
                <Tabs defaultValue="profile">
                  <TabsList className="w-full">
                    <TabsTrigger value="profile">Profile</TabsTrigger>
                    <TabsTrigger value="documents">Documents</TabsTrigger>
                    <TabsTrigger value="attendance">Attendance</TabsTrigger>
                    <TabsTrigger value="payroll">Payroll</TabsTrigger>
                    <TabsTrigger value="coaching">Coaching</TabsTrigger>
                  </TabsList>

                  <TabsContent value="profile" className="space-y-3 pt-4 text-sm">
                    <div className="space-y-2 rounded-md border border-border p-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase">
                        Training Progress
                      </p>
                      <Progress value={selected.trainingProgress} />
                      <p className="text-xs text-muted-foreground">
                        {selected.trainingProgress}% complete
                      </p>
                    </div>
                    <dl className="grid grid-cols-2 gap-y-2">
                      <dt className="text-muted-foreground">Email</dt>
                      <dd className="text-right">{selected.email}</dd>
                      <dt className="text-muted-foreground">Phone</dt>
                      <dd className="text-right">{selected.phone}</dd>
                      <dt className="text-muted-foreground">Manager</dt>
                      <dd className="text-right">{selected.manager}</dd>
                      <dt className="text-muted-foreground">Hire Date</dt>
                      <dd className="text-right">{selected.hireDate}</dd>
                      <dt className="text-muted-foreground">Time Zone</dt>
                      <dd className="text-right">{selected.timeZone}</dd>
                      <dt className="text-muted-foreground">Shift</dt>
                      <dd className="text-right">{selected.shiftTemplate}</dd>
                    </dl>
                  </TabsContent>

                  <TabsContent value="documents" className="space-y-2 pt-4">
                    {documents.slice(0, 5).map((d) => (
                      <div
                        key={d.id}
                        className="flex items-center justify-between rounded-md border border-border p-2.5 text-sm"
                      >
                        <div>
                          <p className="font-medium text-foreground">{d.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {d.category} · {d.size} · {d.version}
                          </p>
                        </div>
                        <Badge variant="secondary">{d.access}</Badge>
                      </div>
                    ))}
                  </TabsContent>

                  <TabsContent value="attendance" className="space-y-2 pt-4 text-sm">
                    <dl className="grid grid-cols-2 gap-y-2">
                      <dt className="text-muted-foreground">Scheduled</dt>
                      <dd className="text-right">
                        {selected.scheduledStart} – {selected.scheduledEnd}
                      </dd>
                      <dt className="text-muted-foreground">Signed In At</dt>
                      <dd className="text-right">{selected.signedInAt ?? "—"}</dd>
                      <dt className="text-muted-foreground">Calls Today</dt>
                      <dd className="text-right">{selected.callsToday}</dd>
                      <dt className="text-muted-foreground">Status</dt>
                      <dd className="text-right"><StatusBadge status={selected.status} /></dd>
                    </dl>
                  </TabsContent>

                  <TabsContent value="payroll" className="space-y-2 pt-4">
                    {payrollRows
                      .filter((p) => p.employee === selected.name)
                      .map((p) => (
                        <div key={p.id} className="rounded-md border border-border p-2.5 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{p.period}</span>
                            <StatusBadge status={p.status} />
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Net pay ${p.net.toLocaleString()}
                          </p>
                        </div>
                      ))}
                    {payrollRows.filter((p) => p.employee === selected.name).length === 0 && (
                      <p className="text-sm text-muted-foreground">No payroll records found.</p>
                    )}
                  </TabsContent>

                  <TabsContent value="coaching" className="space-y-2 pt-4 text-sm text-muted-foreground">
                    <p>Next coaching session scheduled based on QA trends and training progress.</p>
                    <div className="rounded-md border border-border p-2.5">
                      <p className="font-medium text-foreground">Focus: Objection handling</p>
                      <p className="text-xs">Coach: {selected.manager} · Follow-up in 7 days</p>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add employee</DialogTitle>
            <DialogDescription>Create a new employee record and assign training.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Full name</Label>
              <Input placeholder="Jordan Ellis" />
            </div>
            <div className="grid gap-1.5">
              <Label>Email</Label>
              <Input placeholder="jordan.ellis@policybear.com" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Department</Label>
                <Select>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {departmentOptions.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Role</Label>
                <Select>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={() => setAddOpen(false)}>Create employee</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
