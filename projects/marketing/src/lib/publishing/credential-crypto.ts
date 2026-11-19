import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

const version = "v1";
const algorithm = "aes-256-gcm";
const salt = Buffer.from("valiantum-provider-credentials-v1", "utf8");

export function encryptProviderCredential(value: unknown, rootSecret: string, context: string): string {
  const key = deriveKey(rootSecret);
  const iv = randomBytes(12);
  const cipher = createCipheriv(algorithm, key, iv);
  cipher.setAAD(Buffer.from(context, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [version, iv.toString("base64url"), ciphertext.toString("base64url"), tag.toString("base64url")].join(".");
}

export function decryptProviderCredential<T>(encrypted: string, rootSecret: string, context: string): T {
  const [storedVersion, ivValue, ciphertextValue, tagValue, ...extra] = encrypted.split(".");
  if (storedVersion !== version || !ivValue || !ciphertextValue || !tagValue || extra.length) throw new Error("Unsupported provider credential.");
  const decipher = createDecipheriv(algorithm, deriveKey(rootSecret), Buffer.from(ivValue, "base64url"));
  decipher.setAAD(Buffer.from(context, "utf8"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextValue, "base64url")), decipher.final()]);
  return JSON.parse(plaintext.toString("utf8")) as T;
}

function deriveKey(rootSecret: string): Buffer {
  if (rootSecret.length < 20) throw new Error("Provider credential root secret is too short.");
  return Buffer.from(hkdfSync("sha256", Buffer.from(rootSecret, "utf8"), salt, Buffer.from("meta-publishing", "utf8"), 32));
}
