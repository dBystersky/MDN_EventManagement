"use client";

import { useEffect, useState } from "react";
import { CircleAlertIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { apiJson } from "@/lib/api-json";
import { formatDateTime } from "@/lib/datetime";

type AuditEntry = {
  auditId: number;
  createdAt: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId: number;
  summary: string;
  changes: { fields?: string[] } | null;
};

const ALL = "all";
const FILTER_ITEMS = [
  { value: ALL, label: "Everything" },
  { value: "Event", label: "Events" },
  { value: "Task", label: "Tasks" },
  { value: "ResourceAllocation", label: "Allocations" },
  { value: "Resource", label: "Resources" },
  { value: "ResourceType", label: "Resource types" },
  { value: "Location", label: "Locations" },
  { value: "Member", label: "Members & sign-ins" },
];

export default function AuditLogClient() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [entityType, setEntityType] = useState(ALL);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const query = entityType === ALL ? "" : `?entityType=${entityType}`;
    apiJson(`/api/audit-logs${query}`)
      .then((rows) => {
        setEntries(rows);
        setLoaded(true);
      })
      .catch((e) => setError(String(e)));
  }, [entityType]);

  return (
    <section>
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold">Audit log</h1>
        </header>

        {error && (
          <Alert variant="destructive">
            <CircleAlertIcon />
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Recent changes</CardTitle>
            <CardDescription>
              Who changed or deleted anything, plus sign-ins and sign-outs. Shows the latest 100.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="audit-entity">Show</Label>
              <Select
                items={FILTER_ITEMS}
                value={entityType}
                onValueChange={(v) => setEntityType(v ?? ALL)}
              >
                <SelectTrigger id="audit-entity" className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FILTER_ITEMS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {loaded && entries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No changes recorded yet.</p>
            ) : (
              <div className="min-w-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Who</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>What</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry) => (
                      <TableRow key={entry.auditId}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDateTime(entry.createdAt)}
                        </TableCell>
                        <TableCell>{entry.actorName}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              entry.action === "delete" || entry.action === "login_failed"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {entry.action.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{entry.summary}</div>
                          {entry.changes?.fields?.length ? (
                            <div className="text-xs text-muted-foreground">
                              Changed: {entry.changes.fields.join(", ")}
                            </div>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
