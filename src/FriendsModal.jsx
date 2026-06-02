import { useState, useEffect } from "react";
import { UsersThree, X, Trash, PaperPlaneTilt } from "@phosphor-icons/react";
import {
  getMyFriends, removeFriend,
  getPendingRecs, getUnseenAcks, ackMyRec, dismissRec,
} from "./friends.js";
import { getUserName, setUserName } from "./supabase.js";

const overlayStyle = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 100,
  display: "flex", alignItems: "flex-end", justifyContent: "center",
};
const sheetStyle = {
  width: "100%", maxWidth: 460, maxHeight: "92vh",
  background: "var(--bg)", borderTopLeftRadius: 20, borderTopRightRadius: 20,
  overflow: "hidden", display: "flex", flexDirection: "column",
  paddingBottom: "env(safe-area-inset-bottom)",
};

export function FriendsModal({ onClose }) {
  const [tab, setTab] = useState("friends"); // friends / recs / acks
  const [friends, setFriends] = useState([]);
  const [pendingRecs, setPendingRecs] = useState([]);
  const [acks, setAcks] = useState([]);
  const [name, setName] = useState(getUserName());
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [f, r, a] = await Promise.all([
        getMyFriends(), getPendingRecs(), getUnseenAcks(),
      ]);
      setFriends(f); setPendingRecs(r); setAcks(a);
    } catch (e) {
      // 連不上 Supabase 不擋 UI，顯示空狀態
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSaveName = () => {
    setUserName(name);
  };

  const handleRemoveFriend = async (friendshipId, friendName) => {
    if (!confirm(`刪除朋友「${friendName}」？\n他推薦給你的店之後不會再進池子，但已收到的不會消失。`)) return;
    try {
      await removeFriend(friendshipId);
      await load();
    } catch (e) { alert("刪除失敗"); }
  };

  const handleAckAll = async () => {
    try {
      await Promise.all(acks.map(a => ackMyRec(a.id)));
      setAcks([]);
    } catch (e) { /* silent */ }
  };

  const handleDismissRec = async (recId) => {
    try {
      await dismissRec(recId);
      setPendingRecs(prev => prev.filter(r => r.id !== recId));
    } catch (e) { /* silent */ }
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={sheetStyle} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: "16px 16px 8px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ margin: 0, fontFamily: "var(--fd)", fontSize: 17, fontWeight: 700 }}>朋友圈</h3>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--dim)", padding: 6 }}>
            <X size={20} weight="bold" />
          </button>
        </div>

        {/* 自己的名字 */}
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
          <label style={{ fontSize: 11, color: "var(--dim)", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 }}>
            朋友會看到的名字
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value.slice(0, 20))}
              placeholder="輸入暱稱"
              style={{
                flex: 1, padding: "8px 12px", fontSize: 14,
                background: "var(--sf)", border: "1px solid var(--border)",
                borderRadius: 10, color: "var(--tx)", fontFamily: "var(--fb)",
              }}
            />
            <button
              onClick={handleSaveName}
              style={{
                padding: "8px 14px", borderRadius: 10, border: "none",
                background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}
            >儲存</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", padding: "8px 12px 0", gap: 4, borderBottom: "1px solid var(--border)" }}>
          {[
            { id: "friends", label: `朋友 (${friends.length})` },
            { id: "recs",    label: `收到 (${pendingRecs.length})` },
            { id: "acks",    label: `通知 (${acks.length})`, highlight: acks.length > 0 },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: "8px 14px", border: "none", background: "transparent",
                color: tab === t.id ? "var(--accent)" : (t.highlight ? "#9b6cf5" : "var(--dim)"),
                fontSize: 13, fontWeight: tab === t.id ? 700 : 500,
                borderBottom: tab === t.id ? "2px solid var(--accent)" : "2px solid transparent",
                cursor: "pointer",
              }}
            >{t.label}</button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px 24px" }}>
          {loading && <div style={{ textAlign: "center", color: "var(--dim)", padding: 20 }}>載入中...</div>}

          {!loading && tab === "friends" && (
            <>
              {friends.length === 0 && (
                <div style={{ padding: 24, textAlign: "center", color: "var(--dim)", fontSize: 13, lineHeight: 1.6 }}>
                  還沒有朋友<br />
                  <span style={{ fontSize: 11, opacity: .7 }}>
                    跟朋友開過群組房間後，結算頁會提示加為常用朋友
                  </span>
                </div>
              )}
              {friends.map(f => (
                <div key={f.friendshipId} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 12px", borderRadius: 12, background: "var(--sf)",
                  marginBottom: 8,
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%",
                    background: "linear-gradient(135deg,var(--accent),var(--accent2))",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#fff", fontWeight: 700, fontSize: 14,
                  }}>{f.name?.[0] || "?"}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "var(--tx)" }}>{f.name}</div>
                    <div style={{ fontSize: 10, color: "var(--dim)" }}>device · {f.deviceId.slice(0, 10)}…</div>
                  </div>
                  <button
                    onClick={() => handleRemoveFriend(f.friendshipId, f.name)}
                    title="刪除朋友"
                    style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--dim)", padding: 6 }}
                  ><Trash size={16} weight="duotone" /></button>
                </div>
              ))}
            </>
          )}

          {!loading && tab === "recs" && (
            <>
              {pendingRecs.length === 0 && (
                <div style={{ padding: 24, textAlign: "center", color: "var(--dim)", fontSize: 13, lineHeight: 1.6 }}>
                  目前沒有朋友的推薦<br />
                  <span style={{ fontSize: 11, opacity: .7 }}>
                    朋友推薦的店會混進你下次抽店的池子
                  </span>
                </div>
              )}
              {pendingRecs.map(r => (
                <div key={r.id} style={{
                  padding: "12px 14px", borderRadius: 12,
                  background: "rgba(192,132,252,.1)", border: "1px solid rgba(192,132,252,.3)",
                  marginBottom: 8,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <PaperPlaneTilt size={14} weight="duotone" color="#9b6cf5" />
                    <span style={{ fontSize: 11, color: "#9b6cf5", fontWeight: 600 }}>朋友推薦給你</span>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--tx)" }}>{r.place_name}</div>
                  {r.place_addr && <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 2 }}>{r.place_addr}</div>}
                  {r.message && (
                    <div style={{ fontSize: 12, color: "var(--tx)", marginTop: 6, padding: "6px 10px", background: "var(--sf)", borderRadius: 8, fontStyle: "italic" }}>
                      「{r.message}」
                    </div>
                  )}
                  <button
                    onClick={() => handleDismissRec(r.id)}
                    style={{
                      marginTop: 8, padding: "4px 10px", borderRadius: 8,
                      background: "transparent", border: "1px solid var(--sf2)",
                      color: "var(--dim)", fontSize: 11, cursor: "pointer",
                    }}
                  >略過這則</button>
                </div>
              ))}
            </>
          )}

          {!loading && tab === "acks" && (
            <>
              {acks.length === 0 && (
                <div style={{ padding: 24, textAlign: "center", color: "var(--dim)", fontSize: 13, lineHeight: 1.6 }}>
                  還沒收到通知<br />
                  <span style={{ fontSize: 11, opacity: .7 }}>
                    朋友去吃了你推薦的店會通知你
                  </span>
                </div>
              )}
              {acks.map(a => (
                <div key={a.id} style={{
                  padding: "12px 14px", borderRadius: 12,
                  background: "rgba(232,97,44,.08)", border: "1px solid rgba(232,97,44,.25)",
                  marginBottom: 8,
                }}>
                  <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600 }}>💌 朋友吃了你推薦的</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--tx)", marginTop: 4 }}>{a.place_name}</div>
                  <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 4 }}>{new Date(a.acted_at).toLocaleDateString("zh-TW")}</div>
                </div>
              ))}
              {acks.length > 0 && (
                <button
                  onClick={handleAckAll}
                  style={{
                    width: "100%", marginTop: 8, padding: "10px",
                    background: "var(--sf)", border: "1px solid var(--border)", borderRadius: 12,
                    color: "var(--dim)", fontSize: 13, fontWeight: 600, cursor: "pointer",
                  }}
                >全部標為已讀</button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
