import crypto from "node:crypto";

function normalizeKey(key: string): Buffer {
  const raw = Buffer.from(key ?? "", "utf8");
  if (raw.length === 32) return raw;
  return crypto.createHash("sha256").update(raw).digest();
}

export function encrypt(text: string, key: string): string {
  const iv = crypto.randomBytes(16);
  const k = normalizeKey(key);
  const cipher = crypto.createCipheriv("aes-256-gcm", k, iv);
  const ciphertext = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

export function decrypt(encrypted: string, key: string): string {
  const data = Buffer.from(encrypted, "base64");
  if (data.length < 16 + 16 + 1) {
    throw new Error("Invalid encrypted payload");
  }
  const iv = data.subarray(0, 16);
  const authTag = data.subarray(16, 32);
  const ciphertext = data.subarray(32);
  const k = normalizeKey(key);
  const decipher = crypto.createDecipheriv("aes-256-gcm", k, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}

