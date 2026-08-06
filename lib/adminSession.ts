// Uses the Web Crypto API (globalThis.crypto.subtle), not node:crypto --
// this module is imported from middleware.ts, which Next.js 14 always runs
// in the Edge runtime (no Node.js builtins available there). Web Crypto
// works the same way in both the Edge runtime and the Node.js runtime used
// by Route Handlers/Server Components, so one implementation covers both.

export const ADMIN_SESSION_COOKIE = "bv_admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24; // 24h

const encoder = new TextEncoder();

function secret(): string {
  const value = process.env.ADMIN_TRIGGER_SECRET;
  if (!value) {
    throw new Error("ADMIN_TRIGGER_SECRET is not configured.");
  }
  return value;
}

async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array | null {
  if (hex.length === 0 || hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) {
    return null;
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/** Issues a new signed session cookie value, valid for 24h. */
export async function signAdminSession(): Promise<string> {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const key = await hmacKey();
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(String(expiresAt)));
  return `${expiresAt}.${toHex(signature)}`;
}

/** Verifies a cookie value produced by signAdminSession(). Never throws. */
export async function verifyAdminSession(cookieValue: string | undefined | null): Promise<boolean> {
  if (!cookieValue) return false;

  const separatorIndex = cookieValue.indexOf(".");
  if (separatorIndex === -1) return false;

  const expiresAtText = cookieValue.slice(0, separatorIndex);
  const expiresAt = Number(expiresAtText);
  if (!Number.isFinite(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) {
    return false;
  }

  const signatureBytes = fromHex(cookieValue.slice(separatorIndex + 1));
  if (!signatureBytes) return false;

  try {
    const key = await hmacKey();
    return await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes as BufferSource,
      encoder.encode(expiresAtText),
    );
  } catch {
    return false;
  }
}
