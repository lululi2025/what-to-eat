import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);

// ─── 匿名 device ID（每瀏覽器一個，當作這個 anon app 的 user 識別）───
const DEVICE_KEY = "wte_device_id";
export function getDeviceId() {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = "d_" + Math.random().toString(36).slice(2, 12) + Date.now().toString(36).slice(-4);
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

// ─── 使用者顯示名稱 ───
const NAME_KEY = "wte_user_name";
export function getUserName() { return localStorage.getItem(NAME_KEY) || ""; }
export function setUserName(n) {
  if (n) localStorage.setItem(NAME_KEY, n.slice(0, 20));
}
