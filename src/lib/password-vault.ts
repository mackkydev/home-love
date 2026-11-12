export type VaultRecord = {
  id: string;
  name: string;
  username: string;
  password: string;
  link: string;
};

const format = "home-love-vault-v1";
const iterations = 600_000;
const encoder = new TextEncoder();
const additionalData = encoder.encode(format);
export const maxVaultFileBytes = 1024 * 1024;

function encode(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return btoa(binary);
}

function decode(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

async function deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer>) {
  const secret = encoder.encode(passphrase);
  try {
    const material = await crypto.subtle.importKey("raw", secret, "PBKDF2", false, ["deriveKey"]);
    return await crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  } finally {
    secret.fill(0);
  }
}

export async function createVault(passphrase: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { key: await deriveKey(passphrase, salt), salt: encode(salt) };
}

export async function sealVault(records: VaultRecord[], session: { key: CryptoKey; salt: string }) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const bytes = encoder.encode(JSON.stringify(records));
  try {
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData }, session.key, bytes);
    const file = JSON.stringify({ format, salt: session.salt, iv: encode(iv), ciphertext: encode(new Uint8Array(encrypted)) });
    if (file.length > maxVaultFileBytes) throw new Error("Vault is too large");
    return file;
  } finally {
    bytes.fill(0);
  }
}

export function readVaultFile(file: string) {
  if (file.length > maxVaultFileBytes) throw new Error("Vault file is too large");
  const data = JSON.parse(file);
  if (data?.format !== format || typeof data.salt !== "string" || typeof data.iv !== "string" || typeof data.ciphertext !== "string") {
    throw new Error("Invalid vault format");
  }
  const salt = decode(data.salt);
  const iv = decode(data.iv);
  const ciphertext = decode(data.ciphertext);
  if (salt.length !== 16 || iv.length !== 12 || ciphertext.length < 16) throw new Error("Invalid vault data");
  return { salt, iv, ciphertext };
}

function isVaultRecord(value: unknown): value is VaultRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<VaultRecord>;
  return typeof record.id === "string" && !!record.id && typeof record.name === "string" && !!record.name
    && typeof record.username === "string" && typeof record.password === "string" && typeof record.link === "string";
}

export async function unlockVault(file: string, passphrase: string) {
  const { salt, iv, ciphertext } = readVaultFile(file);
  const key = await deriveKey(passphrase, salt);
  const decrypted = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv, additionalData }, key, ciphertext));
  try {
    const records: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(decrypted));
    if (!Array.isArray(records) || !records.every(isVaultRecord) || new Set(records.map((record) => record.id)).size !== records.length) {
      throw new Error("Invalid vault records");
    }
    return { key, salt: encode(salt), records };
  } finally {
    decrypted.fill(0);
  }
}
