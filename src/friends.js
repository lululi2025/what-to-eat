// ─── 朋友圈 + 秘密推薦 CRUD ───
import { supabase, getDeviceId, getUserName } from "./supabase.js";

// schema 約束：device_a < device_b（兩個 device_id 字串排序後小的當 a）
function orderPair(myId, otherId) {
  return myId < otherId ? [myId, otherId, "a", "b"] : [otherId, myId, "b", "a"];
}

// ─── 朋友關係 ───────────────────────────────────────────────────

// 加朋友（雙向）— 已存在則 update name
export async function addFriend(otherId, myName, otherName) {
  const myId = getDeviceId();
  if (myId === otherId) throw new Error("不能加自己");
  const [a, b, mySlot, otherSlot] = orderPair(myId, otherId);
  const row = { device_a: a, device_b: b };
  if (mySlot === "a") { row.name_a = myName; row.name_b = otherName; }
  else                { row.name_b = myName; row.name_a = otherName; }

  // upsert（不存在 insert，存在的話更新名字）
  const { data, error } = await supabase
    .from("friendships")
    .upsert(row, { onConflict: "device_a,device_b" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// 我的朋友列表 — 回傳 [{deviceId, name, friendshipId, createdAt}, ...]
export async function getMyFriends() {
  const myId = getDeviceId();
  const { data, error } = await supabase
    .from("friendships")
    .select("*")
    .or(`device_a.eq.${myId},device_b.eq.${myId}`);
  if (error) throw error;
  return (data || []).map(row => {
    const isA = row.device_a === myId;
    return {
      friendshipId: row.id,
      deviceId: isA ? row.device_b : row.device_a,
      name: isA ? (row.name_b || "朋友") : (row.name_a || "朋友"),
      myNameToThem: isA ? row.name_a : row.name_b,
      createdAt: row.created_at,
    };
  });
}

// 移除朋友
export async function removeFriend(friendshipId) {
  const { error } = await supabase.from("friendships").delete().eq("id", friendshipId);
  if (error) throw error;
}

// ─── 推薦 ──────────────────────────────────────────────────────

// 推一家店給朋友（可一次推給多個朋友）
export async function recommendPlace(toDeviceIds, place, message = "") {
  if (!toDeviceIds?.length) return [];
  const myId = getDeviceId();
  const rows = toDeviceIds.map(toId => ({
    from_device: myId,
    to_device: toId,
    place_id: place.id,
    place_name: place.name,
    place_lat: place.lat,
    place_lng: place.lng,
    place_addr: place.addr || null,
    message: message || null,
    status: "pending",
  }));
  const { data, error } = await supabase.from("recommendations").insert(rows).select();
  if (error) throw error;
  return data;
}

// 拉「給我、還沒揭曉」的推薦（會混進抽店池子）
// 同時 join friendships 取得推薦者的暱稱
export async function getPendingRecs() {
  const myId = getDeviceId();
  const { data, error } = await supabase
    .from("recommendations")
    .select("*")
    .eq("to_device", myId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (!data || data.length === 0) return [];

  // 拉 friendships 取對方暱稱
  const { data: fs } = await supabase
    .from("friendships")
    .select("*")
    .or(`device_a.eq.${myId},device_b.eq.${myId}`);
  const nameMap = {};
  (fs || []).forEach(f => {
    if (f.device_a === myId) nameMap[f.device_b] = f.name_b || "朋友";
    else if (f.device_b === myId) nameMap[f.device_a] = f.name_a || "朋友";
  });
  return data.map(r => ({ ...r, from_name: nameMap[r.from_device] || "朋友" }));
}

// 標記一筆推薦「已揭曉」（spin 抽到時呼叫，避免下次重複出現）
export async function markRecShown(recId) {
  const { error } = await supabase
    .from("recommendations")
    .update({ status: "shown" })
    .eq("id", recId);
  if (error) throw error;
}

// 標記「我去吃了」（按下「我去吃了」時若這筆是 rec → 標 acted，並通知推薦者）
export async function markRecActed(recId) {
  const { error } = await supabase
    .from("recommendations")
    .update({ status: "acted", acted_at: new Date().toISOString() })
    .eq("id", recId);
  if (error) throw error;
}

// 標記「我跳過 / 不要」這筆推薦
export async function dismissRec(recId) {
  const { error } = await supabase
    .from("recommendations")
    .update({ status: "dismissed" })
    .eq("id", recId);
  if (error) throw error;
}

// 拉「我推薦的、對方去吃了但我還沒看到通知」的列表
// 進 app 時呼叫一次，顯示「💌 小明去吃了你推薦的 XX」toast，再呼叫 ackMyRec
export async function getUnseenAcks() {
  const myId = getDeviceId();
  const { data, error } = await supabase
    .from("recommendations")
    .select("*")
    .eq("from_device", myId)
    .eq("status", "acted")
    .eq("ack_seen", false)
    .order("acted_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function ackMyRec(recId) {
  const { error } = await supabase
    .from("recommendations")
    .update({ ack_seen: true })
    .eq("id", recId);
  if (error) throw error;
}

// ─── 本月推薦額度（同一對 from→to 每月最多 5 家）─────────────────
export async function countMyRecsToFriendThisMonth(toDeviceId) {
  const myId = getDeviceId();
  const monthStart = new Date();
  monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const { count, error } = await supabase
    .from("recommendations")
    .select("id", { count: "exact", head: true })
    .eq("from_device", myId)
    .eq("to_device", toDeviceId)
    .gte("created_at", monthStart.toISOString());
  if (error) return 0;
  return count || 0;
}

export const MONTHLY_REC_LIMIT = 5;
