// Storage helpers — V11.13 (Manus-leválasztás után).
//
// Cloudflare R2 (S3-kompatibilis) direkt hívás @aws-sdk/client-s3-mal.
// Backward-compat: ha az új R2_* env-ek nincsenek beállítva DE a legacy
// BUILT_IN_FORGE_* be vannak állítva, a Manus storage-proxyt használja.
//
// Új deploy-okhoz szükséges env változók (lásd .env.example):
//   R2_ACCOUNT_ID         — Cloudflare account ID (R2 endpoint URL alapja)
//   R2_ACCESS_KEY_ID      — R2 access key
//   R2_SECRET_ACCESS_KEY  — R2 secret
//   R2_BUCKET             — bucket név
//   R2_PUBLIC_BASE_URL    — opcionális, custom domain a presigned URL helyett

import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ENV } from "./_core/env";

// ── Provider selection ────────────────────────────────────────────────────────

type StorageProvider = "r2" | "forge" | null;

function pickProvider(): StorageProvider {
  if (process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET) {
    return "r2";
  }
  if (ENV.forgeApiUrl && ENV.forgeApiKey) {
    return "forge";
  }
  return null;
}

// ── R2 (S3-compatible) ────────────────────────────────────────────────────────

let _r2Client: S3Client | null = null;

function getR2Client(): { client: S3Client; bucket: string; publicBaseUrl: string | null } {
  const accountId = process.env.R2_ACCOUNT_ID ?? "";
  const accessKeyId = process.env.R2_ACCESS_KEY_ID ?? "";
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY ?? "";
  const bucket = process.env.R2_BUCKET ?? "";
  const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL?.trim() || null;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error(
      "R2 storage missing config. Required env: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET."
    );
  }

  if (!_r2Client) {
    _r2Client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  return { client: _r2Client, bucket, publicBaseUrl };
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

async function r2Put(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType: string
): Promise<{ key: string; url: string }> {
  const { client, bucket, publicBaseUrl } = getR2Client();
  const key = normalizeKey(relKey);
  const body = typeof data === "string" ? Buffer.from(data, "utf8") : data;

  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
  }));

  const url = publicBaseUrl
    ? `${publicBaseUrl.replace(/\/+$/, "")}/${key}`
    : await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 24 * 60 * 60 });

  return { key, url };
}

async function r2Get(relKey: string): Promise<{ key: string; url: string }> {
  const { client, bucket, publicBaseUrl } = getR2Client();
  const key = normalizeKey(relKey);
  const url = publicBaseUrl
    ? `${publicBaseUrl.replace(/\/+$/, "")}/${key}`
    : await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 24 * 60 * 60 });
  return { key, url };
}

// ── Legacy Manus forge fallback ───────────────────────────────────────────────

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function buildAuthHeaders(apiKey: string): HeadersInit {
  return { Authorization: `Bearer ${apiKey}` };
}

function toFormData(data: Buffer | Uint8Array | string, contentType: string, fileName: string): FormData {
  const blob = typeof data === "string"
    ? new Blob([data], { type: contentType })
    : new Blob([data as BlobPart], { type: contentType });
  const form = new FormData();
  form.append("file", blob, fileName || "file");
  return form;
}

async function forgePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType: string
): Promise<{ key: string; url: string }> {
  const baseUrl = ENV.forgeApiUrl.replace(/\/+$/, "");
  const apiKey = ENV.forgeApiKey;
  const key = normalizeKey(relKey);
  const uploadUrl = new URL("v1/storage/upload", ensureTrailingSlash(baseUrl));
  uploadUrl.searchParams.set("path", key);
  const formData = toFormData(data, contentType, key.split("/").pop() ?? key);
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: buildAuthHeaders(apiKey),
    body: formData,
  });
  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(`Storage upload failed (${response.status} ${response.statusText}): ${message}`);
  }
  const url = (await response.json()).url;
  return { key, url };
}

async function forgeGet(relKey: string): Promise<{ key: string; url: string }> {
  const baseUrl = ENV.forgeApiUrl.replace(/\/+$/, "");
  const apiKey = ENV.forgeApiKey;
  const key = normalizeKey(relKey);
  const downloadApiUrl = new URL("v1/storage/downloadUrl", ensureTrailingSlash(baseUrl));
  downloadApiUrl.searchParams.set("path", key);
  const response = await fetch(downloadApiUrl, {
    method: "GET",
    headers: buildAuthHeaders(apiKey),
  });
  const url = (await response.json()).url;
  return { key, url };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const provider = pickProvider();
  if (provider === "r2") return r2Put(relKey, data, contentType);
  if (provider === "forge") return forgePut(relKey, data, contentType);
  throw new Error(
    "Storage nincs konfigurálva. Új deploy: R2_ACCOUNT_ID + R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY + R2_BUCKET. Legacy: BUILT_IN_FORGE_API_URL + BUILT_IN_FORGE_API_KEY."
  );
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const provider = pickProvider();
  if (provider === "r2") return r2Get(relKey);
  if (provider === "forge") return forgeGet(relKey);
  throw new Error("Storage nincs konfigurálva.");
}
