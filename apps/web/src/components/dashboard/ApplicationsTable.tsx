"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ScoreMeter } from "@/components/shared/ScoreMeter";

export function ApplicationsTable({
  rows,
  onView
}: {
  rows: any[];
  onView: (id: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-white/10 bg-white/5">
      <Table>
        <TableHeader>
          <TableRow className="border-white/10">
            <TableHead className="text-white/70">Company</TableHead>
            <TableHead className="text-white/70">Role</TableHead>
            <TableHead className="text-white/70">Portal</TableHead>
            <TableHead className="text-white/70">Score</TableHead>
            <TableHead className="text-white/70">Status</TableHead>
            <TableHead className="text-white/70">Date</TableHead>
            <TableHead className="text-right text-white/70">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} className="border-white/10">
              <TableCell className="font-medium">{row.job?.company}</TableCell>
              <TableCell>{row.job?.title}</TableCell>
              <TableCell className="text-white/80">{row.job?.portalName}</TableCell>
              <TableCell>
                <ScoreMeter score={row.matchScore ?? 0} />
              </TableCell>
              <TableCell>
                <StatusBadge status={row.status} />
              </TableCell>
              <TableCell className="text-white/70">
                {row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "Not available"}
              </TableCell>
              <TableCell className="text-right">
                <Button size="sm" variant="secondary" onClick={() => onView(row.id)}>
                  <Eye className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {!rows.length ? (
            <TableRow className="border-white/10">
              <TableCell colSpan={7} className="text-white/60">
                No applications yet.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}
