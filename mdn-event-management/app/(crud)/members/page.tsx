"use client";

import { useEffect, useState } from "react";
import { CircleAlertIcon, Trash2Icon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Member = {
  memberId: number;
  name: string;
  email: string;
  role: string;
};

const ROLE_BADGE: Record<string, string> = {
  Admin: "bg-primary/10 text-primary border-primary/20",
  Manager: "bg-secondary/60 text-secondary-foreground border-secondary",
  Member: "bg-muted text-muted-foreground border-border",
};

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [sessionRole, setSessionRole] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [loadError, setLoadError] = useState("");

  // Create form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("Member");
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [creating, setCreating] = useState(false);

  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = useState<Member | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  async function loadMembers() {
    try {
      const res = await fetch("/api/members");
      if (!res.ok) throw new Error("Failed to load members");
      setMembers(await res.json());
    } catch {
      setLoadError("Could not load members. Check your connection.");
    }
  }

  async function loadSession() {
    try {
      const res = await fetch("/api/auth/me");
      if (!res.ok) return;
      const data = await res.json();
      setSessionRole(data?.user?.role ?? null);
      setSessionId(data?.user?.member_id ?? null);
    } catch {
      /* anonymous */
    }
  }

  useEffect(() => {
    loadSession();
    loadMembers();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");
    setCreating(true);

    try {
      const res = await fetch("/api/admin/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create member");

      setFormSuccess(`Account created for ${data.name} (${data.email})`);
      setName("");
      setEmail("");
      setPassword("");
      setRole("Member");
      await loadMembers();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError("");

    try {
      const res = await fetch(`/api/admin/members/${deleteTarget.memberId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete member");

      setDeleteTarget(null);
      await loadMembers();
    } catch (err: any) {
      setDeleteError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  const isAdmin = sessionRole === "Admin";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Members</h1>
        <p className="text-muted-foreground text-sm mt-1">
          View all members{isAdmin ? " and manage accounts" : ""}.
        </p>
      </div>

      {/* Member list */}
      {loadError ? (
        <Alert variant="destructive">
          <CircleAlertIcon className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All members</CardTitle>
            <CardDescription>{members.length} account{members.length !== 1 ? "s" : ""}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  {isAdmin && <TableHead className="w-16" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 4 : 3} className="text-center text-muted-foreground py-8">
                      No members yet.
                    </TableCell>
                  </TableRow>
                )}
                {members.map((m) => (
                  <TableRow key={m.memberId}>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell>{m.email}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${ROLE_BADGE[m.role] ?? ""}`}
                      >
                        {m.role}
                      </span>
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          disabled={m.memberId === sessionId}
                          title={m.memberId === sessionId ? "You cannot delete your own account" : "Delete member"}
                          onClick={() => {
                            setDeleteError("");
                            setDeleteTarget(m);
                          }}
                        >
                          <Trash2Icon className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Create account form — Admin only */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Create account</CardTitle>
            <CardDescription>Add a new member, manager, or admin account.</CardDescription>
          </CardHeader>

          <CardContent>
            {formError && (
              <Alert variant="destructive" className="mb-6">
                <CircleAlertIcon className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}
            {formSuccess && (
              <Alert className="mb-6 border-green-500/30 bg-green-500/10 text-green-700">
                <AlertTitle>Account created</AlertTitle>
                <AlertDescription>{formSuccess}</AlertDescription>
              </Alert>
            )}

            <form id="create-member-form" onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="member-name">Full name</Label>
                  <Input
                    id="member-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Doe"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="member-email">Email address</Label>
                  <Input
                    id="member-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jane@example.com"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="member-password">Temporary password</Label>
                  <Input
                    id="member-password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="member-role">Role</Label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger id="member-role" className="w-full">
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Member">Member</SelectItem>
                      <SelectItem value="Manager">Manager</SelectItem>
                      <SelectItem value="Admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </form>
          </CardContent>

          <CardFooter>
            <Button type="submit" form="create-member-form" disabled={creating}>
              {creating ? "Creating…" : "Create account"}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete account</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong> ({deleteTarget?.email})?
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {deleteError && (
            <Alert variant="destructive">
              <CircleAlertIcon className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{deleteError}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
