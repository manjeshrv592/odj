import { File, UploadType } from "expo-file-system";

/**
 * Uploadcare upload for React Native.
 *
 * The web app uses Uploadcare's `FileUploaderRegular` widget, which isn't RN
 * compatible; the upload-client SDK builds a Blob from an ArrayBuffer (RN's Blob
 * doesn't support that); and this stack's spec-compliant `fetch` rejects RN's
 * `{ uri }` FormData parts. So we use `expo-file-system`'s native multipart
 * upload (`File.upload`), which streams the local `file://` straight to
 * Uploadcare with no JS Blob/FormData involved.
 *
 * Public-key client upload (no backend signature for now), mirroring the web
 * avatar uploader. Configure `EXPO_PUBLIC_UPLOADCARE_PUBLIC_KEY`.
 */
const PUBKEY = process.env.EXPO_PUBLIC_UPLOADCARE_PUBLIC_KEY ?? "";
const UPLOAD_ENDPOINT = "https://upload.uploadcare.com/base/";

/** Whether an Uploadcare public key is configured. */
export function isUploadConfigured(): boolean {
  return PUBKEY.length > 0;
}

/** Minimal shape of an `expo-image-picker` asset we need to upload. */
export interface UploadAsset {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
}

/** Upload a picked asset to Uploadcare; resolves to the file's CDN url. */
export async function uploadToUploadcare(asset: UploadAsset): Promise<string> {
  if (!PUBKEY) {
    throw new Error(
      "Image upload isn't configured — set EXPO_PUBLIC_UPLOADCARE_PUBLIC_KEY.",
    );
  }

  const file = new File(asset.uri);
  const result = await file.upload(UPLOAD_ENDPOINT, {
    httpMethod: "POST",
    uploadType: UploadType.MULTIPART,
    fieldName: "file",
    mimeType: asset.mimeType ?? "application/octet-stream",
    parameters: {
      UPLOADCARE_PUB_KEY: PUBKEY,
      UPLOADCARE_STORE: "auto",
    },
  });

  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Upload failed (${result.status})`);
  }

  const data = JSON.parse(result.body) as { file?: string };
  if (!data.file) {
    throw new Error("Upload failed — no file id returned by Uploadcare.");
  }
  return `https://ucarecdn.com/${data.file}/`;
}
