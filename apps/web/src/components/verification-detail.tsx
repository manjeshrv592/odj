"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, ExternalLink, FileText, X } from "lucide-react";
import { toast } from "sonner";
import type {
  VerificationDetail as Detail,
  VerificationAnswer,
  ProfileKind,
  OrgType,
} from "@odj/shared";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
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
import { VERIFICATIONS_COUNT_KEY } from "@/components/app-sidebar";

const ORG_TYPE_LABELS: Record<OrgType, string> = {
  pvt_ltd: "Private Limited",
  llp: "LLP",
  partnership: "Partnership",
  proprietorship: "Proprietorship",
  other: "Other",
};

const IMAGE_RE = /\.(png|jpe?g|gif|webp|heic)(\?|$)/i;

function fullName(d: Detail): string {
  return `${d.firstName ?? ""} ${d.lastName ?? ""}`.trim() || "Unnamed";
}

/** A single label/value row in a detail card. */
function Row({
  label,
  value,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5 border-b py-2 last:border-b-0 sm:flex-row sm:justify-between sm:gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium sm:text-right">{value || "—"}</span>
    </div>
  );
}

/** Render one requirement answer: file answers open a document lightbox. */
function AnswerRow({
  answer,
  onView,
}: {
  answer: VerificationAnswer;
  onView: (url: string) => void;
}) {
  const label = answer.label ?? answer.key;
  const value = answer.value;

  if (answer.inputType === "file" && typeof value === "string") {
    return (
      <div className="flex flex-col gap-1 border-b py-2 last:border-b-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">
            {label}
            {!answer.resolved && (
              <Badge variant="outline" className="ml-2 text-xs">
                field removed
              </Badge>
            )}
          </span>
          <Button variant="outline" size="sm" onClick={() => onView(value)}>
            <FileText className="size-4" /> View
          </Button>
        </div>
        {IMAGE_RE.test(value) && (
          <button
            type="button"
            onClick={() => onView(value)}
            className="mt-1 w-fit overflow-hidden rounded-md border"
          >
            <Image
              src={value}
              alt={label}
              width={120}
              height={120}
              unoptimized
              className="size-24 object-cover"
            />
          </button>
        )}
      </div>
    );
  }

  const text = Array.isArray(value) ? value.join(", ") : value;
  return (
    <Row
      label={
        <>
          {label}
          {!answer.resolved && (
            <Badge variant="outline" className="ml-2 text-xs">
              field removed
            </Badge>
          )}
        </>
      }
      value={text}
    />
  );
}

export function VerificationDetail({
  type,
  id,
}: {
  type: ProfileKind;
  id: string;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [docUrl, setDocUrl] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["verification", type, id],
    queryFn: () => apiFetch<Detail>(`/api/portal/verifications/${type}/${id}`),
  });

  function afterDecision(message: string) {
    toast.success(message);
    qc.invalidateQueries({ queryKey: ["verifications"] });
    qc.invalidateQueries({ queryKey: VERIFICATIONS_COUNT_KEY });
    qc.invalidateQueries({ queryKey: ["verification", type, id] });
    router.push("/verifications");
  }

  // On error (e.g. a 409 from a stale tab where the profile was already decided),
  // refetch the detail so the page reflects the current status and hides the
  // decision buttons.
  function onDecisionError(e: Error) {
    toast.error(e.message);
    qc.invalidateQueries({ queryKey: ["verification", type, id] });
    qc.invalidateQueries({ queryKey: VERIFICATIONS_COUNT_KEY });
  }

  const approve = useMutation({
    mutationFn: () =>
      apiFetch(`/api/portal/verifications/${type}/${id}/approve`, {
        method: "POST",
      }),
    onSuccess: () => afterDecision("Profile approved"),
    onError: onDecisionError,
  });

  const reject = useMutation({
    mutationFn: () => {
      const trimmed = reason.trim();
      if (!trimmed) throw new Error("Enter a reason for rejection");
      return apiFetch(`/api/portal/verifications/${type}/${id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason: trimmed }),
      });
    },
    onSuccess: () => {
      setRejectOpen(false);
      afterDecision("Profile rejected");
    },
    onError: onDecisionError,
  });

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const d = data;
  const pending = d.status === "under_review";

  return (
    <div className="flex flex-col gap-4">
      <Button
        variant="ghost"
        size="sm"
        className="w-fit"
        onClick={() => router.push("/verifications")}
      >
        <ArrowLeft className="size-4" /> Back to queue
      </Button>

      {/* Header */}
      <div className="flex flex-wrap items-center gap-4">
        {d.photoUrl ? (
          <Image
            src={d.photoUrl}
            alt={fullName(d)}
            width={64}
            height={64}
            className="size-16 rounded-full object-cover"
          />
        ) : (
          <div className="size-16 rounded-full bg-muted" />
        )}
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">{fullName(d)}</h1>
          <p className="text-sm text-muted-foreground">{d.email}</p>
        </div>
        <Badge variant="outline" className="capitalize">
          {d.type}
        </Badge>
        <Badge
          variant={
            d.status === "approved"
              ? "default"
              : d.status === "rejected"
                ? "destructive"
                : "secondary"
          }
        >
          {d.status === "under_review" ? "Pending" : d.status}
        </Badge>
      </div>

      {/* Decision banner for already-reviewed profiles */}
      {!pending && (d.reviewedByName || d.rejectionReason) && (
        <div className="rounded-md border bg-muted/40 p-3 text-sm">
          {d.reviewedByName && (
            <p className="text-muted-foreground">
              Reviewed by <span className="font-medium">{d.reviewedByName}</span>
              {d.reviewedAt &&
                ` on ${new Date(d.reviewedAt).toLocaleString()}`}
            </p>
          )}
          {d.rejectionReason && (
            <p className="mt-1">
              <span className="font-medium">Reason:</span> {d.rejectionReason}
            </p>
          )}
        </div>
      )}

      {/* Basics */}
      <Card>
        <CardHeader>
          <CardTitle>Basics</CardTitle>
        </CardHeader>
        <CardContent>
          <Row label="Name" value={fullName(d)} />
          <Row label="Email" value={d.email} />
          <Row
            label="Location"
            value={[d.city, d.state].filter(Boolean).join(", ")}
          />
          {d.submittedAt && (
            <Row
              label="Submitted"
              value={new Date(d.submittedAt).toLocaleString()}
            />
          )}
        </CardContent>
      </Card>

      {/* Worker-specific */}
      {d.type === "worker" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Skills & languages</CardTitle>
            </CardHeader>
            <CardContent>
              <Row
                label="Professions"
                value={
                  <span className="flex flex-wrap justify-end gap-1">
                    {(d.professions ?? []).map((p) => (
                      <Badge key={p.id} variant="secondary">
                        {p.name}
                      </Badge>
                    ))}
                  </span>
                }
              />
              <Row
                label="Languages"
                value={(d.languages ?? []).map((l) => l.label).join(", ")}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Requirement answers</CardTitle>
            </CardHeader>
            <CardContent>
              {(d.answers ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No answers.</p>
              ) : (
                (d.answers ?? []).map((a) => (
                  <AnswerRow key={a.key} answer={a} onView={setDocUrl} />
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Hirer-specific */}
      {d.type === "hirer" && (
        <Card>
          <CardHeader>
            <CardTitle>Hirer details</CardTitle>
          </CardHeader>
          <CardContent>
            <Row
              label="Type"
              value={d.hirerType === "business" ? "Business" : "Individual"}
            />
            {d.hirerType === "business" && (
              <>
                <Row label="Organization" value={d.orgName} />
                <Row
                  label="Org type"
                  value={d.orgType ? ORG_TYPE_LABELS[d.orgType] : "—"}
                />
                <Row
                  label="GST registered"
                  value={d.gstRegistered ? "Yes" : "No"}
                />
                {d.gstRegistered && <Row label="GSTIN" value={d.gstin} />}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Decision actions */}
      {pending && (
        <div className="flex gap-2">
          <Button
            onClick={() => approve.mutate()}
            disabled={approve.isPending}
          >
            <Check className="size-4" />
            {approve.isPending ? "Approving…" : "Approve"}
          </Button>
          <Button
            variant="destructive"
            onClick={() => setRejectOpen(true)}
            disabled={approve.isPending}
          >
            <X className="size-4" /> Reject
          </Button>
        </div>
      )}

      {/* Reject dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject this profile</DialogTitle>
            <DialogDescription>
              The applicant sees this reason and can fix their profile and
              re-submit. Be specific.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="e.g. Your ID document is blurry — please re-upload a clear photo."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              onClick={() => setRejectOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => reject.mutate()}
              disabled={reject.isPending || !reason.trim()}
            >
              {reject.isPending ? "Rejecting…" : "Reject profile"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document lightbox */}
      <Dialog open={!!docUrl} onOpenChange={(o) => !o && setDocUrl(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Document</DialogTitle>
          </DialogHeader>
          {docUrl && (
            <>
              <iframe
                src={docUrl}
                title="Document preview"
                className="h-[70vh] w-full rounded-md border"
              />
              <DialogFooter>
                <a
                  href={docUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="size-4" /> Open in new tab
                </a>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
