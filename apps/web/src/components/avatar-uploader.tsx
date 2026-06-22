"use client";

import { FileUploaderRegular } from "@uploadcare/react-uploader/next";
import type { OutputCollectionState } from "@uploadcare/react-uploader";
import "@uploadcare/react-uploader/core.css";

/**
 * Avatar upload via Uploadcare. Public-key client upload (no backend signature
 * for now); the uploaded file's CDN URL is lifted to the caller, which stores it
 * in `user.image`. Single image only. The widget keeps Uploadcare's default
 * styling (the one place we don't use our own primitives — see styling.md).
 */
const PUBKEY = process.env.NEXT_PUBLIC_UPLOADCARE_PUBLIC_KEY ?? "";

export function AvatarUploader({
  onChange,
}: {
  /** Called with the uploaded CDN URL, or null when the file is removed. */
  onChange: (cdnUrl: string | null) => void;
}) {
  if (!PUBKEY) {
    return (
      <p className="text-sm text-destructive">
        Image upload isn&apos;t configured — set{" "}
        <code>NEXT_PUBLIC_UPLOADCARE_PUBLIC_KEY</code> in <code>.env</code>.
      </p>
    );
  }

  return (
    <FileUploaderRegular
      pubkey={PUBKEY}
      multiple={false}
      imgOnly
      sourceList="local, url, camera"
      onChange={(state: OutputCollectionState) => {
        onChange(state.successEntries[0]?.cdnUrl ?? null);
      }}
    />
  );
}
