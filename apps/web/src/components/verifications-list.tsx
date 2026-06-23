"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import type { VerificationListItem, ProfileStatus } from "@odj/shared";
import { apiFetch } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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

type TypeFilter = "all" | "worker" | "hirer";
type StatusFilter = ProfileStatus | "all";

const TYPE_LABELS: Record<TypeFilter, string> = {
  all: "All",
  worker: "Workers",
  hirer: "Hirers",
};
const STATUS_LABELS: Record<StatusFilter, string> = {
  under_review: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  all: "All",
  draft: "Draft",
};

const STATUS_BADGE: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  under_review: "secondary",
  approved: "default",
  rejected: "destructive",
  draft: "outline",
};

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Admin Verifications queue: filterable list of submitted worker/hirer profiles. */
export function VerificationsList() {
  const [type, setType] = useState<TypeFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("under_review");

  const { data, isLoading } = useQuery({
    queryKey: ["verifications", type, status],
    queryFn: () =>
      apiFetch<{ verifications: VerificationListItem[] }>(
        `/api/portal/verifications?type=${type}&status=${status}`,
      ).then((r) => r.verifications),
    refetchInterval: 30_000,
  });

  const rows = data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Verifications</h1>
          <p className="text-sm text-muted-foreground">
            Review submitted worker & hirer profiles and approve or reject them.
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={type} onValueChange={(v) => setType(v as TypeFilter)}>
            <SelectTrigger className="w-32">
              <SelectValue>{(v: string) => TYPE_LABELS[v as TypeFilter]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="worker">Workers</SelectItem>
              <SelectItem value="hirer">Hirers</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={status}
            onValueChange={(v) => setStatus(v as StatusFilter)}
          >
            <SelectTrigger className="w-36">
              <SelectValue>
                {(v: string) => STATUS_LABELS[v as StatusFilter]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="under_review">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12" />
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Submitted</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6}>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground"
                >
                  Nothing to review here.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow
                  key={`${r.type}-${r.id}`}
                  className="cursor-pointer"
                  onClick={() => {
                    window.location.href = `/verifications/${r.type}/${r.id}`;
                  }}
                >
                  <TableCell>
                    {r.photoUrl ? (
                      <Image
                        src={r.photoUrl}
                        alt={r.name}
                        width={36}
                        height={36}
                        className="size-9 rounded-full object-cover"
                      />
                    ) : (
                      <div className="size-9 rounded-full bg-muted" />
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link
                      href={`/verifications/${r.type}/${r.id}`}
                      className="hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {r.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {r.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {[r.city, r.state].filter(Boolean).join(", ") || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_BADGE[r.status] ?? "secondary"}>
                      {STATUS_LABELS[r.status as StatusFilter] ?? r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(r.submittedAt)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
