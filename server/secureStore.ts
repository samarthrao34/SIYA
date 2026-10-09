/*
 * Encryption at rest for SIYA's personal data (memories, feelings, goals,
 * health readings, session state).
 *
 * AES-256-GCM with a per-install key. electron/main.cjs creates the key once,
 * keeps it in the OS keyring via Electron safeStorage, and hands it to this
 * backend process as SIYA_DATA_KEY. Without a key (e.g. a headless dev run)
 * data is read and written as plain text, exactly as before.
 *
 * Reads accept both formats, so existing plain files keep working and are
 * encrypted the next time they are saved.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const PREFIX = "SIYAENC1:";

function loadKey(): Buffer | null {
  const raw = process.env.SIYA_DATA_KEY;
  if (!raw) return null;
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    console.error("[SecureStore] SIYA_DATA_KEY is not a 32-byte base64 key; data stays unencrypted.");
    return null;
  }
  return key;
}

const KEY = loadKey();

export function isEncryptionEnabled(): boolean {
  return KEY !== null;
}

export function encryptText(plain: string): string {
  if (!KEY) return plain;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64");
}

export function decryptText(stored: string): string {
  if (!stored.startsWith(PREFIX)) return stored; // legacy plain text
  if (!KEY) {
    // Callers must not treat this as a corrupt file (and reset or overwrite it).
    throw Object.assign(new Error("This data is encrypted but no SIYA_DATA_KEY is available."), {
      code: "SIYA_NO_DATA_KEY",
    });
  }
  const packed = Buffer.from(stored.slice(PREFIX.length), "base64");
  const decipher = createDecipheriv("aes-256-gcm", KEY, packed.subarray(0, 12));
  decipher.setAuthTag(packed.subarray(12, 28));
  return Buffer.concat([decipher.update(packed.subarray(28)), decipher.final()]).toString("utf8");
}
