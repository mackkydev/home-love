import { cloud } from "./cloud";
import { usageError, type HouseholdEntitlements } from "./usage-limits";
export type AdminUser = { id: string; email: string; display_name: string; enabled: boolean; max_households: number; reason: string; is_admin: boolean; household_count: number; created_at: string; last_sign_in_at: string | null };
export type AdminHouse = HouseholdEntitlements & { members: { user_id: string; email: string; role: "owner" | "admin" | "member" }[] };
export type Audit = { id: number; actor_email: string; action: string; target_id: string; details: Record<string, unknown>; created_at: string };
export async function adminRpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
 if (!cloud) throw new Error("ยังไม่ได้เชื่อม Supabase");
 const { data, error } = await cloud.rpc(name, args);
 if (error) throw new Error(usageError(error));
 return data as T;
}
export const listAdminUsers = (search: string, page: number) => adminRpc<{ users: AdminUser[]; total: number }>("admin_list_users", { search_text: search, page_number: page });
export const listAdminHouses = (search: string, page: number, userId?: string) => adminRpc<{ houses: AdminHouse[]; total: number }>("admin_list_households", { search_text: search, page_number: page, target_user: userId ?? null });
