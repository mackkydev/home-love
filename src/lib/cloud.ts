import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const cloudEnabled = Boolean(url && key);
export const cloud = url && key ? createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
}) : null;

export async function isAppAdmin(): Promise<boolean> {
  if (!cloud) return false;
  const { data, error } = await cloud.rpc("is_app_admin");
  if (error) throw error;
  return data === true;
}

export async function getSignupOpen(): Promise<boolean> {
  if (!cloud) return true;
  const { data, error } = await cloud.rpc("get_signup_open");
  if (error) throw error;
  return data === true;
}

export async function setSignupOpen(open: boolean): Promise<boolean> {
  if (!cloud) throw new Error("Supabase is not configured");
  const { data, error } = await cloud.rpc("set_signup_open", { new_value: open });
  if (error) throw error;
  return data === true;
}

export type CloudCategory = { name: string; icon: string; color: string };
export type Household = { id: string; name: string; role: "owner" | "admin" | "member" };
export type CloudEntry = {
  id: string;
  photos?: string[];
  photo?: string;
  attachments?: { name: string; data: string; type: string }[];
};

export type CloudSnapshot<T extends CloudEntry> = {
  entries: T[];
  categories: CloudCategory[];
  entryVersions: Map<string, string>;
  categoryVersions: Map<string, string>;
};

const assetPaths = new Map<string, string>();
const bucket = "household-files";

function entryAssetPaths(entry: CloudEntry, householdId: string): string[] {
  const values = [...(entry.photos ?? []), entry.photo, ...(entry.attachments ?? []).map((file) => file.data)];
  return values.flatMap((value) => value?.startsWith("storage:") && value.slice(8).startsWith(`${householdId}/`) ? [value.slice(8)] : []);
}

async function backupAsset(value: string): Promise<string> {
  if (value.startsWith("data:")) return value;
  const path = value.startsWith("storage:") ? value.slice(8) : assetPaths.get(value);
  let file: Blob;
  if (path) {
    const { data, error } = await cloud!.storage.from(bucket).download(path);
    if (error || !data) throw error ?? new Error("Cannot download backup attachment");
    file = data;
  } else {
    const response = await fetch(value);
    if (!response.ok) throw new Error(`Cannot download backup attachment (${response.status})`);
    file = await response.blob();
  }
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function createPortableBackup<T extends CloudEntry>(entries: T[], categories: CloudCategory[], householdName: string) {
  const portableEntries = await Promise.all(entries.map(async (entry) => {
    const photos = await Promise.all((entry.photos ?? (entry.photo ? [entry.photo] : [])).map(backupAsset));
    const attachments = await Promise.all((entry.attachments ?? []).map(async (file) => ({ ...file, data: await backupAsset(file.data) })));
    return { ...entry, photos, photo: photos[0], attachments };
  }));
  return { format: "home-love-backup-v1", exportedAt: new Date().toISOString(), householdName, categories, entries: portableEntries };
}

async function visibleAsset(path: string) {
  if (!cloud) throw new Error("Supabase is not configured");
  const { data, error } = await cloud.storage.from(bucket).createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) throw error ?? new Error("Cannot open attachment");
  assetPaths.set(data.signedUrl, path);
  return data.signedUrl;
}

async function storedAsset(value: string, pathPrefix: string, fileName: string, mimeType: string) {
  if (!cloud) throw new Error("Supabase is not configured");
  if (value.startsWith("storage:")) return value.slice(8);
  const knownPath = assetPaths.get(value);
  if (knownPath) return knownPath;
  if (!value.startsWith("data:")) throw new Error("Unknown attachment source");
  const blob = await (await fetch(value)).blob();
  if (blob.size > 1024 * 1024) throw new Error("ไฟล์แนบใหญ่เกิน 1 MB");
  const extension = mimeType === "application/pdf" ? "pdf" : "jpg";
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-40) || `file.${extension}`;
  const path = `${pathPrefix}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await cloud.storage.from(bucket).upload(path, blob, { contentType: mimeType, upsert: false });
  if (error) throw error;
  assetPaths.set(value, path);
  return path;
}

async function prepareEntry<T extends CloudEntry>(entry: T, householdId: string): Promise<T> {
  const data = { ...entry };
  const prefix = `${householdId}/${entry.id}`;
  if (entry.photos?.length) {
    data.photos = await Promise.all(entry.photos.map(async (photo, index) => `storage:${await storedAsset(photo, prefix, `photo-${index}.jpg`, "image/jpeg")}`));
    data.photo = data.photos[0];
  } else if (entry.photo) {
    data.photo = `storage:${await storedAsset(entry.photo, prefix, "photo-0.jpg", "image/jpeg")}`;
    data.photos = [data.photo];
  }
  if (entry.attachments?.length) {
    data.attachments = await Promise.all(entry.attachments.map(async (file) => ({
      name: file.name,
      type: file.type,
      data: `storage:${await storedAsset(file.data, prefix, file.name, file.type)}`,
    })));
  }
  return data;
}

async function displayEntry<T extends CloudEntry>(entry: T): Promise<T> {
  const data = { ...entry };
  if (entry.photos?.length) {
    data.photos = await Promise.all(entry.photos.map((photo) => photo.startsWith("storage:") ? visibleAsset(photo.slice(8)) : Promise.resolve(photo)));
    data.photo = data.photos[0];
  } else if (entry.photo?.startsWith("storage:")) {
    data.photo = await visibleAsset(entry.photo.slice(8));
    data.photos = [data.photo];
  }
  if (entry.attachments?.length) {
    data.attachments = await Promise.all(entry.attachments.map(async (file) => ({
      ...file,
      data: file.data.startsWith("storage:") ? await visibleAsset(file.data.slice(8)) : file.data,
    })));
  }
  return data;
}

export async function listHouseholds(): Promise<Household[]> {
  if (!cloud) throw new Error("Supabase is not configured");
  const { data: defaultId, error: defaultError } = await cloud.rpc("ensure_personal_household");
  if (defaultError || !defaultId) throw defaultError ?? new Error("Cannot create household");
  const { data: memberships, error: memberError } = await cloud.from("household_members").select("household_id,role");
  if (memberError) throw memberError;
  if (!memberships?.length) return [];
  const { data: houses, error: houseError } = await cloud.from("households").select("id,name").in("id", memberships.map((item) => item.household_id));
  if (houseError) throw houseError;
  return (houses ?? []).map((house) => ({
    id: house.id,
    name: house.name,
    role: memberships.find((item) => item.household_id === house.id)!.role as Household["role"],
  })).sort((a, b) => Number(b.id === defaultId) - Number(a.id === defaultId));
}

export async function createHouseholdInvite(householdId: string): Promise<string> {
  if (!cloud) throw new Error("Supabase is not configured");
  const { data, error } = await cloud.rpc("create_household_invite", { target_household: householdId });
  if (error || !data) throw error ?? new Error("Cannot create an invitation");
  return data as string;
}

export async function joinHousehold(inviteCode: string): Promise<string> {
  if (!cloud) throw new Error("Supabase is not configured");
  const { data, error } = await cloud.rpc("join_household_by_code", { invite_code: inviteCode.trim() });
  if (error || !data) throw error ?? new Error("Cannot join household");
  return data as string;
}

export async function openHousehold<T extends CloudEntry>(selectedId?: string): Promise<{ householdId: string; snapshot: CloudSnapshot<T> }> {
  if (!cloud) throw new Error("Supabase is not configured");
  const { data: defaultId, error: householdError } = await cloud.rpc("ensure_personal_household");
  if (householdError || !defaultId) throw householdError ?? new Error("Cannot create household");
  let householdId = defaultId as string;
  if (selectedId && selectedId !== defaultId) {
    const { data: membership, error: memberError } = await cloud.from("household_members").select("household_id").eq("household_id", selectedId).maybeSingle();
    if (memberError) throw memberError;
    if (!membership) throw new Error("You are not a member of this household");
    householdId = selectedId;
  }
  const [entriesResult, categoriesResult] = await Promise.all([
    cloud.from("entries").select("id,data").eq("household_id", householdId),
    cloud.from("household_categories").select("name,icon,color").eq("household_id", householdId),
  ]);
  if (entriesResult.error) throw entriesResult.error;
  if (categoriesResult.error) throw categoriesResult.error;
  const rawEntries = (entriesResult.data ?? []).map((row) => row.data as T);
  return {
    householdId,
    snapshot: {
      entries: await Promise.all(rawEntries.map(displayEntry)),
      categories: (categoriesResult.data ?? []) as CloudCategory[],
      entryVersions: new Map(rawEntries.map((entry) => [entry.id, JSON.stringify(entry)])),
      categoryVersions: new Map((categoriesResult.data ?? []).map((item) => [item.name, JSON.stringify({ name: item.name, icon: item.icon, color: item.color })])),
    },
  };
}

export async function saveHousehold<T extends CloudEntry>(householdId: string, entries: T[], categories: CloudCategory[], previous: CloudSnapshot<T>): Promise<CloudSnapshot<T>> {
  if (!cloud) throw new Error("Supabase is not configured");
  const prepared = await Promise.all(entries.map((entry) => prepareEntry(entry, householdId)));
  const nextEntryVersions = new Map(prepared.map((entry) => [entry.id, JSON.stringify(entry)]));
  const nextCategoryVersions = new Map(categories.map((item) => [item.name, JSON.stringify(item)]));
  const changed = prepared.filter((entry) => previous.entryVersions.get(entry.id) !== nextEntryVersions.get(entry.id));
  const deleted = [...previous.entryVersions.keys()].filter((id) => !nextEntryVersions.has(id));
  const changedCategories = categories.filter((item) => previous.categoryVersions.get(item.name) !== nextCategoryVersions.get(item.name));
  const deletedCategories = [...previous.categoryVersions.keys()].filter((name) => !nextCategoryVersions.has(name));

  if (changed.length) {
    const { error } = await cloud.from("entries").upsert(changed.map((data) => ({ id: data.id, household_id: householdId, data, updated_at: new Date().toISOString() })), { onConflict: "id" });
    if (error) throw error;
  }
  if (deleted.length) {
    const { error } = await cloud.from("entries").delete().eq("household_id", householdId).in("id", deleted);
    if (error) throw error;
  }
  if (changedCategories.length) {
    const { error } = await cloud.from("household_categories").upsert(changedCategories.map((item) => ({ ...item, household_id: householdId })), { onConflict: "household_id,name" });
    if (error) throw error;
  }
  if (deletedCategories.length) {
    const { error } = await cloud.from("household_categories").delete().eq("household_id", householdId).in("name", deletedCategories);
    if (error) throw error;
  }
  const oldPaths = new Set([...previous.entryVersions.values()].flatMap((version) => entryAssetPaths(JSON.parse(version) as T, householdId)));
  const retainedPaths = new Set(prepared.flatMap((entry) => entryAssetPaths(entry, householdId)));
  const orphanedPaths = [...oldPaths].filter((path) => !retainedPaths.has(path));
  for (let index = 0; index < orphanedPaths.length; index += 100) {
    const { error } = await cloud.storage.from(bucket).remove(orphanedPaths.slice(index, index + 100));
    if (error) throw error;
  }
  return { entries, categories, entryVersions: nextEntryVersions, categoryVersions: nextCategoryVersions };
}
