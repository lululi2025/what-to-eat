import { supabase, getDeviceId } from "./supabase.js";

const MAX_CANDIDATES = 20;
const MAX_MEMBERS = 12;
const MAX_VETOES = 1;            // 共抽結果的共同否決次數上限

// 易讀字符集（去掉 0/O/1/I 容易看錯的）
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function genCode() {
  return Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");
}

// ─── 房間操作 ───
export async function createRoom({ candidates, meta, hostName }) {
  const trimmed = candidates.slice(0, MAX_CANDIDATES);
  for (let i = 0; i < 5; i++) {
    const code = genCode();
    const hostId = getDeviceId();
    const { data, error } = await supabase
      .from("rooms")
      .insert({ code, host_id: hostId, candidates: trimmed, meta })
      .select()
      .single();
    if (error?.code === "23505") continue;  // 房號撞 → retry
    if (error) throw error;
    // 房主自動加入 members
    await supabase.from("members").insert({
      room_id: data.id, device_id: hostId, name: (hostName || "房主").slice(0, 20),
    });
    return data;
  }
  throw new Error("一直撞房號，請再試一次");
}

export async function joinRoom({ code, name }) {
  const normalized = (code || "").toUpperCase().trim();
  if (normalized.length !== 6) throw new Error("房號要 6 位");

  const { data: room, error } = await supabase
    .from("rooms").select("*").eq("code", normalized).maybeSingle();
  if (error) throw error;
  if (!room) throw new Error("找不到這個房號（可能輸錯或房間過期了）");

  const { count } = await supabase
    .from("members").select("*", { count: "exact", head: true })
    .eq("room_id", room.id);
  if ((count || 0) >= MAX_MEMBERS) throw new Error(`房間滿了（最多 ${MAX_MEMBERS} 人）`);

  const deviceId = getDeviceId();
  await supabase.from("members").upsert({
    room_id: room.id, device_id: deviceId, name: (name || "路人").slice(0, 20),
    is_done: false,
  });
  return room;
}

export async function leaveRoom(roomId) {
  await supabase.from("members").delete()
    .match({ room_id: roomId, device_id: getDeviceId() });
}

export async function vetoPlace(roomId, placeId) {
  await supabase.from("vetoes").upsert({
    room_id: roomId, device_id: getDeviceId(), place_id: placeId,
  });
}

export async function unvetoPlace(roomId, placeId) {
  await supabase.from("vetoes").delete()
    .match({ room_id: roomId, device_id: getDeviceId(), place_id: placeId });
}

export async function markDone(roomId, isDone = true) {
  await supabase.from("members").update({ is_done: isDone })
    .match({ room_id: roomId, device_id: getDeviceId() });
}

export async function drawAndPick(roomId, allCandidates, vetoes) {
  // 排掉任何人否決過的店
  const vetoed = new Set(vetoes.map(v => v.place_id));
  const pool = allCandidates.filter(c => !vetoed.has(c.id));
  if (!pool.length) throw new Error("全部被否決完了，沒有可抽的店");
  const pick = pool[Math.floor(Math.random() * pool.length)];
  await supabase.from("rooms").update({
    current_pick: pick.id, status: "picked",
  }).eq("id", roomId);
  return pick;
}

export async function vetoFinalAndRedraw(roomId, currentVetoUsed) {
  if (currentVetoUsed >= MAX_VETOES) throw new Error("否決機會用完了");
  // 房主否決後：回到 voting + 重置全員 is_done，讓大家重新調整 NO 名單
  // 不清空 vetoes — 既有 NO 當預設，使用者可以個別撤銷或新增
  await Promise.all([
    supabase.from("rooms").update({
      veto_used: currentVetoUsed + 1,
      current_pick: null,
      status: "voting",
    }).eq("id", roomId),
    supabase.from("members").update({ is_done: false }).eq("room_id", roomId),
  ]);
}

export async function finishRoom(roomId) {
  await supabase.from("rooms").update({ status: "finished" }).eq("id", roomId);
}

// ─── 全部重選（房主緊急按鈕 — 死路救援）───
// 清空所有 NO 票 + 重置全員 is_done，但保留 veto_used（避免無限重抽迴圈）
export async function resetAllVetoes(roomId) {
  await Promise.all([
    supabase.from("vetoes").delete().eq("room_id", roomId),
    supabase.from("members").update({ is_done: false }).eq("room_id", roomId),
    supabase.from("rooms").update({
      status: "voting",
      current_pick: null,
    }).eq("id", roomId),
  ]);
}

// ─── 撈整個 room state（用於初始化 + 重新同步）───
export async function getRoomState(roomId) {
  const [{ data: room }, { data: members }, { data: vetoes }] = await Promise.all([
    supabase.from("rooms").select("*").eq("id", roomId).maybeSingle(),
    supabase.from("members").select("*").eq("room_id", roomId).order("joined_at"),
    supabase.from("vetoes").select("*").eq("room_id", roomId),
  ]);
  return { room, members: members || [], vetoes: vetoes || [] };
}

// ─── Realtime 訂閱 ───
// callback(): 任何變更都用 refetch 重抓整個 state，最簡單也最不容易 bug
// subscribe 第二個參數印 status 進 console 方便 debug（CHANNEL_ERROR / TIMED_OUT 都會出現）
export function subscribeToRoom(roomId, onChange) {
  const channel = supabase.channel(`room:${roomId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "rooms",   filter: `id=eq.${roomId}` },      onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "members", filter: `room_id=eq.${roomId}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "vetoes",  filter: `room_id=eq.${roomId}` }, onChange)
    .subscribe((status, err) => {
      // 非 SUBSCRIBED 狀態交給 4 秒 polling 後備接管，沉默處理（不污染 production console）
      if (status !== "SUBSCRIBED" && import.meta.env?.DEV) {
        console.warn(`[realtime] room:${roomId} status:`, status, err || "");
      }
    });
  return () => { supabase.removeChannel(channel); };
}

export const _config = { MAX_CANDIDATES, MAX_MEMBERS, MAX_VETOES };
