import { useState, useEffect, useMemo, useRef } from "react";
import {
  createRoom, joinRoom, leaveRoom,
  vetoPlace, unvetoPlace, markDone,
  drawAndPick, vetoFinalAndRedraw, finishRoom,
  resetAllVetoes,
  getRoomState, subscribeToRoom, _config,
} from "./group.js";
import { getDeviceId, getUserName, setUserName } from "./supabase.js";
import { addFriend, getMyFriends } from "./friends.js";
import { getRarity, RARITY_META } from "./rarity.js";
import { RarityBadge } from "./Modals.jsx";
import { SwipeDeck } from "./SwipeDeck.jsx";
import {
  X, ArrowsClockwise, Sparkle, Hourglass, Eye,
  DiceFive, ArrowLeft, ShareNetwork, Copy as CopyIcon,
  UsersThree, SignIn, LockSimpleOpen, MapTrifold,
} from "@phosphor-icons/react";

// Google Maps 搜尋連結（沿用 App.jsx 同樣 helper）
function gmapUrl(name, lat, lng) {
  const q = encodeURIComponent(name);
  return lat && lng
    ? `https://www.google.com/maps/search/?api=1&query=${q}&center=${lat},${lng}`
    : `https://www.google.com/maps/search/?api=1&query=${q}`;
}

// ─── 共用樣式 ───
const overlayStyle = {
  position: "fixed", inset: 0, zIndex: 60,
  background: "rgba(0,0,0,.7)", backdropFilter: "blur(6px)",
  display: "flex", alignItems: "flex-end", justifyContent: "center",
  animation: "fadeIn .2s ease",
};
const sheetStyle = {
  width: "100%", maxWidth: 480, height: "92vh",
  background: "var(--bg)", color: "var(--tx)",
  borderRadius: "20px 20px 0 0",
  border: "1px solid var(--sf2)",
  display: "flex", flexDirection: "column",
  animation: "slideUp .25s cubic-bezier(.17,.67,.21,1.1)",
};
const primaryBtn = {
  width: "100%", padding: "14px", borderRadius: 14, border: "none",
  background: "linear-gradient(135deg,var(--accent),var(--accent2))",
  color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer",
  fontFamily: "var(--fd)",
};
const secondaryBtn = {
  ...primaryBtn,
  background: "var(--sf)", color: "var(--tx)",
  border: "1px solid var(--sf2)",
};
const inputStyle = {
  width: "100%", padding: "12px 14px", borderRadius: 12,
  background: "var(--sf)", border: "1px solid var(--sf2)",
  color: "var(--tx)", fontSize: 15, fontFamily: "var(--fb)",
  boxSizing: "border-box",
};

// ═══════════════════════════════════════════════════════════
export function GroupModal({ candidates, meta, onClose, onResult, initialCode }) {
  // 有 initialCode = 從邀請連結進來，直接跳到「被邀請」加入流程
  const [stage, setStage] = useState(initialCode ? "invited" : "entry");
  const [name, setName] = useState(() => getUserName());
  const [roomId, setRoomId] = useState(null);
  const [room, setRoom] = useState(null);
  const [members, setMembers] = useState([]);
  const [vetoes, setVetoes] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const deviceId = getDeviceId();
  const isHost = room && room.host_id === deviceId;
  const myMember = members.find(m => m.device_id === deviceId);
  const myVetoes = useMemo(() => new Set(vetoes.filter(v => v.device_id === deviceId).map(v => v.place_id)), [vetoes, deviceId]);
  const allDone = members.length > 0 && members.every(m => m.is_done);
  const pickedPlace = room?.current_pick
    ? room.candidates?.find(c => c.id === room.current_pick)
    : null;

  // ─── Realtime 訂閱 + Polling 後備（4 秒一次，怕 Realtime 沒 fire）───
  useEffect(() => {
    if (!roomId) return;
    let alive = true;
    const refetch = async () => {
      const s = await getRoomState(roomId);
      if (!alive) return;
      if (s.room) setRoom(s.room); else { setError("房間不見了"); }
      setMembers(s.members);
      setVetoes(s.vetoes);
    };
    refetch();
    const unsub = subscribeToRoom(roomId, refetch);
    const interval = setInterval(refetch, 4000);
    return () => { alive = false; unsub(); clearInterval(interval); };
  }, [roomId]);

  // 偵測 finished status → 自動關閉並回傳結果
  useEffect(() => {
    if (room?.status === "finished" && pickedPlace) {
      onResult?.(pickedPlace);
      handleClose();
    }
  }, [room?.status, pickedPlace]);

  // ─── Actions ───
  const handleClose = async () => {
    if (roomId) {
      try { await leaveRoom(roomId); } catch {}
    }
    onClose();
  };

  const handleCreate = async () => {
    if (!name.trim()) { setError("輸入個名字吧"); return; }
    if (!candidates?.length) { setError("沒有候選店家"); return; }
    setBusy(true); setError("");
    try {
      setUserName(name.trim());
      const r = await createRoom({ candidates, meta, hostName: name.trim() });
      setRoomId(r.id);
      setStage("room");
    } catch (e) {
      setError(e.message || "開房失敗");
    } finally { setBusy(false); }
  };

  const handleJoin = async (code) => {
    if (!name.trim()) { setError("輸入個名字吧"); return; }
    setBusy(true); setError("");
    try {
      setUserName(name.trim());
      const r = await joinRoom({ code, name: name.trim() });
      setRoomId(r.id);
      setStage("room");
    } catch (e) {
      setError(e.message || "進房失敗");
    } finally { setBusy(false); }
  };

  // ─── Render ───
  if (stage === "entry") return (
    <div style={overlayStyle} onClick={handleClose}>
      <div style={sheetStyle} onClick={e => e.stopPropagation()}>
        <Header title="一起決定" onClose={handleClose} />
        <Body>
          <p style={{ color: "var(--dim)", fontSize: 13, marginTop: 0 }}>
            開房或進房，一起滑掉不想吃的店，最後由系統抽。<br />
            <span style={{ opacity: .7 }}>房號 6 位，跟朋友分享就行。資料 6 小時後自動過期。</span>
          </p>
          <div style={{ marginTop: 16 }}>
            <label style={{ fontSize: 12, color: "var(--dim)", marginBottom: 6, display: "block" }}>你的名字（讓朋友看到誰是誰）</label>
            <input
              style={inputStyle}
              value={name}
              maxLength={20}
              placeholder="Lulu"
              onChange={e => setName(e.target.value)}
            />
          </div>
          {error && <ErrorBox>{error}</ErrorBox>}
          <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 10 }}>
            <button
              style={{ ...primaryBtn, opacity: busy ? .6 : 1 }}
              disabled={busy || !candidates?.length}
              onClick={handleCreate}
            >開新房（凍結附近 {Math.min(candidates?.length || 0, _config.MAX_CANDIDATES)} 家店）</button>
            <button
              style={secondaryBtn}
              disabled={busy}
              onClick={() => { setError(""); setStage("joining"); }}
            >我有房號，進房</button>
          </div>
          {!candidates?.length && (
            <p style={{ fontSize: 11, color: "var(--accent2)", marginTop: 10, textAlign: "center" }}>
              附近沒有店家資料，先回上一頁等定位完成
            </p>
          )}
        </Body>
      </div>
    </div>
  );

  if (stage === "joining") return (
    <JoinStage
      name={name} onChangeName={setName}
      busy={busy} error={error}
      onBack={() => { setError(""); setStage("entry"); }}
      onClose={handleClose}
      onJoin={handleJoin}
    />
  );

  // 從邀請連結進來 — 房號已知，只要輸入名字按進房就好
  if (stage === "invited") return (
    <InvitedStage
      code={initialCode}
      name={name} onChangeName={setName}
      busy={busy} error={error}
      onClose={handleClose}
      onJoin={() => handleJoin(initialCode)}
    />
  );

  // stage === "room"
  if (!room) return (
    <div style={overlayStyle}>
      <div style={sheetStyle}>
        <Header title="連線中..." onClose={handleClose} />
        <Body>
          <div style={{ textAlign: "center", padding: 32, color: "var(--dim)" }}>
            <div style={{ animation: "spin 1.2s linear infinite", display: "inline-flex", color: "var(--accent)" }}>
              <ArrowsClockwise size={36} weight="duotone" />
            </div>
            <p>同步房間資料中...</p>
            {error && <ErrorBox>{error}</ErrorBox>}
          </div>
        </Body>
      </div>
    </div>
  );

  return (
    <div style={overlayStyle}>
      <div style={sheetStyle}>
        <Header
          title={`房間 ${room.code}`}
          subtitle={isHost ? "你是房主" : null}
          onClose={handleClose}
        />
        <Body>
          {/* 房號 + 成員（chip 上顯示每人 NO 幾家）*/}
          <RoomInfoBar room={room} members={members} deviceId={deviceId} vetoes={vetoes} />

          {/* 進度顯示（只在 voting 階段且有人在滑卡時）*/}
          {room.status === "voting" && members.length > 0 && (
            <ProgressBar members={members} allDone={allDone} />
          )}

          {/* 根據 status 顯示不同內容 */}
          {room.status === "voting" && (
            <VotingStage
              room={room} myMember={myMember} myVetoes={myVetoes}
              members={members} vetoes={vetoes} allDone={allDone} isHost={isHost}
              onVeto={(pid) => vetoPlace(room.id, pid)}
              onUnveto={(pid) => unvetoPlace(room.id, pid)}
              onMarkDone={(d) => markDone(room.id, d)}
              onDraw={async () => {
                try { await drawAndPick(room.id, room.candidates, vetoes); }
                catch (e) { setError(e.message); }
              }}
              onResetAll={async () => {
                if (!confirm("確定清空所有 NO 名單、大家重新滑卡？")) return;
                try { await resetAllVetoes(room.id); }
                catch (e) { setError(e.message); }
              }}
            />
          )}

          {(room.status === "picked" || room.status === "drawing") && (
            <ResultStage
              room={room} pickedPlace={pickedPlace} vetoes={vetoes} members={members}
              isHost={isHost}
              onVetoFinal={async () => {
                try { await vetoFinalAndRedraw(room.id, room.veto_used); }
                catch (e) { setError(e.message); }
              }}
              onDraw={async () => {
                try { await drawAndPick(room.id, room.candidates, vetoes); }
                catch (e) { setError(e.message); }
              }}
              onAccept={async () => { await finishRoom(room.id); }}
            />
          )}

          {error && <ErrorBox>{error}</ErrorBox>}
        </Body>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// 子元件
// ═══════════════════════════════════════════════════════════

function Header({ title, subtitle, onClose }) {
  return (
    <header style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "16px 20px", borderBottom: "1px solid var(--sf2)", flexShrink: 0,
    }}>
      <div>
        <h3 style={{ margin: 0, fontFamily: "var(--fd)", fontSize: 17, fontWeight: 700 }}>{title}</h3>
        {subtitle && <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--dim)" }}>{subtitle}</p>}
      </div>
      <button onClick={onClose} aria-label="關閉" style={{
        width: 32, height: 32, borderRadius: "50%", border: "none",
        background: "var(--sf2)", color: "var(--tx)", fontSize: 16,
        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
      }}><X size={16} weight="bold" /></button>
    </header>
  );
}

function Body({ children }) {
  return <div style={{ padding: 16, overflowY: "auto", flex: 1 }}>{children}</div>;
}

function ErrorBox({ children }) {
  return (
    <div style={{
      marginTop: 12, padding: "10px 14px", borderRadius: 10,
      background: "rgba(209,76,63,.1)", border: "1px solid rgba(209,76,63,.3)",
      color: "var(--accent2)", fontSize: 13,
    }}><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><X size={14} weight="bold" /> {children}</span></div>
  );
}

function InvitedStage({ code, name, onChangeName, busy, error, onClose, onJoin }) {
  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={sheetStyle} onClick={e => e.stopPropagation()}>
        <Header title="你被邀請進房！" subtitle={`房號 ${code}`} onClose={onClose} />
        <Body>
          <div style={{
            padding: "20px 16px", borderRadius: 14, marginBottom: 18,
            background: "linear-gradient(135deg, rgba(232,97,44,.15), rgba(209,76,63,.1))",
            border: "1px solid rgba(232,97,44,.3)",
            textAlign: "center",
          }}>
            <div style={{ marginBottom: 10, display: "flex", justifyContent: "center", color: "var(--accent)" }}>
              <UsersThree size={42} weight="duotone" />
            </div>
            <p style={{ margin: 0, fontSize: 14, color: "var(--tx)" }}>
              朋友在等你一起決定吃哪家
            </p>
            <p style={{ margin: "6px 0 0", fontSize: 11, color: "var(--dim)" }}>
              進去後一起滑掉不要的店，最後系統會抽
            </p>
          </div>

          <label style={{ fontSize: 12, color: "var(--dim)", marginBottom: 6, display: "block" }}>
            你的名字（讓朋友看到誰是誰）
          </label>
          <input
            style={inputStyle}
            value={name}
            maxLength={20}
            placeholder="Lulu"
            autoFocus
            onChange={e => onChangeName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && name.trim()) onJoin(); }}
          />

          {error && <ErrorBox>{error}</ErrorBox>}

          <button
            style={{ ...primaryBtn, marginTop: 24, opacity: busy || !name.trim() ? .5 : 1 }}
            disabled={busy || !name.trim()}
            onClick={onJoin}
          ><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><SignIn size={18} weight="duotone" /> 進房</span></button>
        </Body>
      </div>
    </div>
  );
}

function JoinStage({ name, onChangeName, busy, error, onBack, onClose, onJoin }) {
  const [code, setCode] = useState("");
  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={sheetStyle} onClick={e => e.stopPropagation()}>
        <Header title="進房" onClose={onClose} />
        <Body>
          <button onClick={onBack} style={{
            background: "transparent", border: "none", color: "var(--dim)",
            fontSize: 13, cursor: "pointer", marginBottom: 16, padding: 0,
          }}>← 返回</button>

          <label style={{ fontSize: 12, color: "var(--dim)", marginBottom: 6, display: "block" }}>你的名字</label>
          <input
            style={inputStyle}
            value={name}
            maxLength={20}
            placeholder="Lulu"
            onChange={e => onChangeName(e.target.value)}
          />

          <label style={{ fontSize: 12, color: "var(--dim)", marginTop: 16, marginBottom: 6, display: "block" }}>房號（6 位英數）</label>
          <input
            style={{
              ...inputStyle,
              textAlign: "center", fontFamily: "monospace",
              fontSize: 24, letterSpacing: 8, fontWeight: 700,
            }}
            value={code}
            maxLength={6}
            placeholder="ABC123"
            onChange={e => setCode(e.target.value.toUpperCase())}
          />

          {error && <ErrorBox>{error}</ErrorBox>}

          <button
            style={{ ...primaryBtn, marginTop: 24, opacity: busy || code.length !== 6 ? .5 : 1 }}
            disabled={busy || code.length !== 6}
            onClick={() => onJoin(code)}
          >進房</button>
        </Body>
      </div>
    </div>
  );
}

function ProgressBar({ members, allDone }) {
  const doneCount = members.filter(m => m.is_done).length;
  const total = members.length;
  const pct = total > 0 ? (doneCount / total) * 100 : 0;
  return (
    <div style={{
      padding: "12px 14px", borderRadius: 14, marginBottom: 14,
      background: allDone
        ? "linear-gradient(135deg, rgba(61,139,94,.2), rgba(45,107,72,.15))"
        : "var(--sf)",
      border: `2px solid ${allDone ? "var(--accent3)" : "var(--sf2)"}`,
      display: "flex", alignItems: "center", gap: 12,
      transition: "all .4s",
      animation: allDone ? "pulse 1.4s ease-in-out infinite" : "none",
    }}>
      <div style={{ flexShrink: 0, display: "flex", color: allDone ? "var(--accent3)" : "var(--accent)" }}>
        {allDone ? <Sparkle size={28} weight="duotone" /> : <Hourglass size={28} weight="duotone" />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "baseline",
          marginBottom: 4,
        }}>
          <span style={{
            fontFamily: "var(--fd)", fontWeight: 700, fontSize: 15,
            color: allDone ? "var(--accent3)" : "var(--tx)",
          }}>
            {allDone ? "全員都好了！" : "等其他人..."}
          </span>
          <span style={{
            fontFamily: "var(--fd)", fontWeight: 700, fontSize: 15,
            color: allDone ? "var(--accent3)" : "var(--accent)",
          }}>{doneCount} / {total}</span>
        </div>
        <div style={{ height: 5, background: "var(--sf2)", borderRadius: 3, overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${pct}%`,
            background: allDone
              ? "linear-gradient(90deg, var(--accent3), #2D6B48)"
              : "linear-gradient(90deg, var(--accent), var(--accent2))",
            transition: "width .4s ease",
          }} />
        </div>
      </div>
    </div>
  );
}

function RoomInfoBar({ room, members, deviceId, vetoes }) {
  // 計算每個成員 NO 了幾家
  const vetoCountByMember = {};
  for (const v of (vetoes || [])) {
    vetoCountByMember[v.device_id] = (vetoCountByMember[v.device_id] || 0) + 1;
  }

  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);

  const shareUrl = `https://what-to-eat-pi-two.vercel.app/?r=${room.code}`;
  // 用 navigator.share 時 url 會獨立顯示，text 只放招呼語避免重複
  const shareTextShort = "今天吃什麼？一起決定吃哪家！";
  // 沒 share API 的環境（桌機）→ 整段複製到剪貼簿，URL 要寫進去
  const shareTextFull = `${shareTextShort}\n${shareUrl}`;

  const copyCode = async () => {
    try { await navigator.clipboard?.writeText(room.code); } catch {}
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "今天吃什麼？",
          text: shareTextShort,
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareTextFull);
        setShared(true); setTimeout(() => setShared(false), 2000);
      }
    } catch (e) {
      // 使用者取消分享 (AbortError) 或其他錯誤 — 不需要處理
    }
  };

  return (
    <div style={{
      padding: 14, borderRadius: 14, background: "var(--sf)", marginBottom: 14,
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 12, gap: 12,
      }}>
        <div onClick={copyCode} style={{ cursor: "pointer", flex: 1 }} title="點一下複製房號">
          <div style={{ fontSize: 10, color: "var(--dim)", textTransform: "uppercase", letterSpacing: 1 }}>
            房號 {copied && <span style={{ color: "var(--accent3)" }}>· 已複製 ✓</span>}
          </div>
          <div style={{
            fontFamily: "monospace", fontSize: 26, fontWeight: 700,
            letterSpacing: 4, color: "var(--accent)",
          }}>{room.code}</div>
        </div>
        <button
          onClick={share}
          style={{
            padding: "12px 18px", borderRadius: 12, border: "none",
            background: shared
              ? "var(--accent3)"
              : "linear-gradient(135deg,var(--accent),var(--accent2))",
            color: shared ? "#0f2a1f" : "#fff",
            fontSize: 13, fontWeight: 700, cursor: "pointer", flexShrink: 0,
            display: "flex", alignItems: "center", gap: 6,
            boxShadow: "0 4px 14px rgba(232,97,44,.3)",
          }}
        >
          {shared ? "✓ 已複製到剪貼簿" : <><ShareNetwork size={18} weight="bold" /> 分享給朋友</>}
        </button>
      </div>
      <div style={{ fontSize: 11, color: "var(--dim)", marginBottom: 6 }}>
        成員 ({members.length})
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {members.map(m => {
          const isMe = m.device_id === deviceId;
          const done = m.is_done;
          const noCount = vetoCountByMember[m.device_id] || 0;
          return (
            <span key={m.device_id} style={{
              padding: "5px 11px", borderRadius: 14,
              background: done
                ? "linear-gradient(135deg, var(--accent3), #2D6B48)"
                : (isMe ? "rgba(232,97,44,.15)" : "var(--sf2)"),
              color: done
                ? "#0f2a1f"
                : (isMe ? "var(--accent)" : "var(--tx)"),
              fontSize: 12, fontWeight: done ? 700 : 500,
              border: done
                ? "1px solid var(--accent3)"
                : (isMe ? "1px solid var(--accent)" : "1px solid transparent"),
              display: "inline-flex", alignItems: "center", gap: 5,
              transition: "all .3s",
            }}>
              {done && <span style={{ fontSize: 13 }}>✓</span>}
              <span>{m.name}{isMe && " (你)"}</span>
              <span style={{
                fontSize: 10, opacity: .75, fontWeight: 600,
                padding: "1px 5px", borderRadius: 8,
                background: done ? "rgba(15,42,31,.18)" : "rgba(0,0,0,.25)",
              }}>NO {noCount}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function VotingStage({ room, myMember, myVetoes, members, vetoes, allDone, isHost, onVeto, onUnveto, onMarkDone, onDraw, onResetAll }) {
  const myDone = myMember?.is_done;
  // 池子大小 = 候選 - 任何人 NO 過的
  const vetoedSet = new Set((vetoes || []).map(v => v.place_id));
  const poolSize = (room.candidates?.length || 0) - vetoedSet.size;
  const poolEmpty = allDone && poolSize === 0;

  return (
    <div>
      {/* 重投輪次提示 */}
      {room.veto_used > 0 && (
        <div style={{
          padding: "10px 14px", borderRadius: 10, marginBottom: 12,
          background: "rgba(209,76,63,.08)",
          border: "1px solid rgba(209,76,63,.3)",
          color: "var(--accent2)", fontSize: 12, textAlign: "center",
        }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <ArrowsClockwise size={14} weight="bold" /> 上一輪結果被房主否決，這是第 {room.veto_used + 1} 輪 — 大家可以調整 NO 名單
          </span>
        </div>
      )}

      {/* 池子空了 — 緊急救援提示 */}
      {poolEmpty && (
        <div style={{
          padding: "12px 14px", borderRadius: 12, marginBottom: 12,
          background: "rgba(209,76,63,.15)",
          border: "1.5px solid var(--accent2)",
          color: "var(--accent2)", fontSize: 13, textAlign: "center",
        }}>
          候選池被全員 NO 光了，沒店可抽<br />
          <span style={{ fontSize: 11, opacity: .8 }}>
            {isHost ? "按下方「全部重選」清空，大家重新來" : "等房主按「全部重選」"}
          </span>
        </div>
      )}

      {/* 滑卡介面（只有自己還沒完成才看得到）*/}
      {!myDone && (
        <SwipeDeck
          key={`round-${room.veto_used}`}
          candidates={room.candidates}
          vetoedIds={myVetoes}
          onVeto={onVeto}
          onUnveto={onUnveto}
          onComplete={() => onMarkDone(true)}
        />
      )}

      {/* 自己滑完了 — 鎖住，無法回頭 */}
      {myDone && (
        <div style={{
          padding: "16px", borderRadius: 12, marginBottom: 10,
          background: "rgba(61,139,94,.08)",
          border: "1px solid rgba(61,139,94,.3)",
          color: "var(--accent3)", textAlign: "center",
        }}>
          <div style={{ fontSize: 28, marginBottom: 6 }}>✓</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>你已完成投票</div>
          <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 4 }}>
            這輪不能再改了 — 等其他人{isHost ? "" : "或房主"}
          </div>
        </div>
      )}

      {/* 還沒滑完 → 提供「不想滑完直接完成」入口 */}
      {!myDone && (
        <button
          onClick={() => {
            if (!confirm(`確定完成投票？\n按下後這輪就不能再改了\n（已 NO ${myVetoes.size} 家）`)) return;
            onMarkDone(true);
          }}
          style={{ ...secondaryBtn, fontSize: 12, padding: "10px", marginTop: 8 }}
        >不想全部滑完，直接送出（已 NO {myVetoes.size} 家）</button>
      )}

      {/* 房主開抽 — 全員完成時超顯眼（但池子空時要先重選）*/}
      {isHost && allDone && !poolEmpty && (
        <button
          onClick={onDraw}
          style={{
            ...primaryBtn, marginTop: 12,
            background: "linear-gradient(135deg,var(--accent3),#2D6B48)",
            color: "#0f2a1f", fontSize: 18, padding: "18px",
            boxShadow: "0 8px 28px rgba(61,139,94,.4)",
            animation: "pulse 1.6s ease-in-out infinite",
          }}
        >開抽！（從 {poolSize} 家裡抽）</button>
      )}
      {!isHost && allDone && !poolEmpty && (
        <div style={{
          marginTop: 12, padding: "14px", borderRadius: 12,
          background: "rgba(61,139,94,.1)", border: "1px solid var(--accent3)",
          color: "var(--accent3)", fontSize: 13, fontWeight: 600, textAlign: "center",
        }}>等房主按開抽</div>
      )}

      {/* 全部重選按鈕（房主限定）— Round 2+ 常駐 OR 池子空時超顯眼 */}
      {isHost && (poolEmpty || room.veto_used > 0) && (
        <button
          onClick={onResetAll}
          style={poolEmpty
            ? {
                ...primaryBtn, marginTop: 12,
                background: "linear-gradient(135deg, var(--accent2), #c84545)",
                color: "#fff", fontSize: 15, padding: "14px",
                boxShadow: "0 6px 22px rgba(209,76,63,.4)",
              }
            : {
                marginTop: 10, padding: "10px",
                width: "100%", borderRadius: 12,
                border: "1px solid var(--sf2)", background: "transparent",
                color: "var(--dim)", fontSize: 12, fontWeight: 500, cursor: "pointer",
              }
          }
        >全部重選（清空所有人的 NO 名單）</button>
      )}
    </div>
  );
}

function ResultStage({ room, pickedPlace, vetoes, members, isHost, onVetoFinal, onDraw, onAccept }) {
  const remainingVetoes = _config.MAX_VETOES - room.veto_used;
  const totalVetoed = new Set(vetoes.map(v => v.place_id)).size;
  const poolSize = (room.candidates?.length || 0) - totalVetoed;

  // drawing 狀態：等房主再抽
  if (room.status === "drawing" || !pickedPlace) {
    return (
      <div style={{ textAlign: "center", padding: 24 }}>
        <div style={{ marginBottom: 12, color: "var(--accent)", animation: "spin 1.5s linear infinite", display: "inline-flex" }}>
          <DiceFive size={36} weight="duotone" />
        </div>
        <p style={{ color: "var(--dim)", fontSize: 14 }}>
          {isHost ? "按下方再抽一次" : "等房主再抽..."}
        </p>
        <p style={{ color: "var(--dim)", fontSize: 11, marginTop: 8 }}>
          池子裡還剩 {poolSize} 家可抽
        </p>
        {isHost && (
          <button onClick={onDraw} style={{ ...primaryBtn, marginTop: 16 }}>再抽</button>
        )}
      </div>
    );
  }

  const rarity = getRarity(pickedPlace);
  const rMeta = RARITY_META[rarity];

  return (
    <div>
      {/* 抽到的店 */}
      <div style={{
        padding: 20, borderRadius: 16,
        background: `linear-gradient(145deg, ${rMeta.color}26, ${rMeta.color}10)`,
        border: `2px solid ${rMeta.color}`,
        boxShadow: rarity === "SSR" ? rMeta.glow : "none",
        textAlign: "center", marginBottom: 16,
        animation: "popIn .4s cubic-bezier(.17,.67,.21,1.25)",
      }}>
        <div style={{ marginBottom: 8 }}>
          <RarityBadge rarity={rarity} size="lg" />
        </div>
        <h2 style={{
          margin: "8px 0 4px", fontFamily: "var(--fd)", fontWeight: 700,
          fontSize: 22, color: rMeta.color,
        }}>{pickedPlace.name}</h2>
        <div style={{ fontSize: 12, color: "var(--dim)", marginTop: 4 }}>
          {pickedPlace.rating > 0 && `★ ${pickedPlace.rating} · `}
          {pickedPlace.dist}m · {pickedPlace.price}
        </div>
        {pickedPlace.addr && (
          <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 6, opacity: .85 }}>
            {pickedPlace.addr}
          </div>
        )}
        {/* Google Maps 連結 — 點開直接導航 */}
        <a
          href={gmapUrl(pickedPlace.name, pickedPlace.lat, pickedPlace.lng)}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            marginTop: 12, padding: "8px 16px", borderRadius: 20,
            background: "rgba(61,139,94,.12)", border: "1px solid var(--accent3)",
            color: "var(--accent3)", fontSize: 13, fontWeight: 600,
            textDecoration: "none",
          }}
        >
          <MapTrifold size={14} weight="duotone" /> Google Maps 導航
        </a>
      </div>

      {/* 動作 — 只有房主能拍板 */}
      {isHost ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            onClick={onAccept}
            style={{ ...primaryBtn, background: "linear-gradient(135deg,var(--accent3),#2D6B48)", color: "#0f2a1f" }}
          >就吃這家！</button>

          {remainingVetoes > 0 ? (
            <button onClick={onVetoFinal} style={secondaryBtn}>
              ✗ 不滿意，再抽一次（還剩 {remainingVetoes} 次）
            </button>
          ) : (
            <div style={{
              padding: 12, borderRadius: 10, background: "var(--sf)",
              color: "var(--dim)", fontSize: 12, textAlign: "center",
            }}>否決機會用完了，按上面決定吧 </div>
          )}
        </div>
      ) : (
        <div style={{
          padding: "16px", borderRadius: 12,
          background: "rgba(232,97,44,.08)", border: "1px solid rgba(232,97,44,.3)",
          color: "var(--accent)", fontSize: 13, textAlign: "center",
        }}>
          <div style={{ marginBottom: 8, display: "flex", justifyContent: "center", color: "var(--accent)" }}>
            <Eye size={28} weight="duotone" />
          </div>
          等房主決定要不要去           {remainingVetoes > 0 && (
            <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 4, opacity: .8 }}>
              （房主還有 {remainingVetoes} 次重抽機會）
            </div>
          )}
        </div>
      )}

      {/* R1: 加為常用朋友 — 群組房結束後雙方可互加，建立朋友圈 */}
      <AddFriendsSection members={members} />
    </div>
  );
}

// R1: 結算頁的「加為常用朋友」區塊
function AddFriendsSection({ members }) {
  const myId = getDeviceId();
  const [existingFriendIds, setExistingFriendIds] = useState(new Set());
  const [adding, setAdding] = useState(new Set());
  const [added, setAdded] = useState(new Set());

  useEffect(() => {
    (async () => {
      try {
        const friends = await getMyFriends();
        setExistingFriendIds(new Set(friends.map(f => f.deviceId)));
      } catch (_) { /* silent */ }
    })();
  }, []);

  const others = (members || []).filter(m =>
    m.device_id !== myId && !existingFriendIds.has(m.device_id) && !added.has(m.device_id)
  );

  if (others.length === 0) return null;

  const handleAdd = async (m) => {
    setAdding(prev => new Set(prev).add(m.device_id));
    try {
      await addFriend(m.device_id, getUserName() || "我", m.name || "朋友");
      setAdded(prev => new Set(prev).add(m.device_id));
    } catch (e) {
      alert("加朋友失敗，稍後再試");
    } finally {
      setAdding(prev => { const next = new Set(prev); next.delete(m.device_id); return next; });
    }
  };

  return (
    <div style={{
      marginTop: 16, padding: "12px 14px", borderRadius: 12,
      background: "rgba(192,132,252,.08)", border: "1px solid rgba(192,132,252,.25)",
    }}>
      <div style={{ fontSize: 11, color: "#9b6cf5", fontWeight: 600, marginBottom: 8, letterSpacing: 0.5, textTransform: "uppercase" }}>
        💜 加為常用朋友
      </div>
      <div style={{ fontSize: 11, color: "var(--dim)", marginBottom: 10, lineHeight: 1.5 }}>
        加為朋友後可以互相推薦店家，朋友推的店會混進你下次抽店的池子
      </div>
      {others.map(m => (
        <div key={m.device_id} style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "8px 10px", borderRadius: 10, background: "var(--sf)",
          marginBottom: 6,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            background: "linear-gradient(135deg,var(--accent),var(--accent2))",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontWeight: 700, fontSize: 12, flexShrink: 0,
          }}>{m.name?.[0] || "?"}</div>
          <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--tx)" }}>{m.name || "朋友"}</div>
          <button
            onClick={() => handleAdd(m)}
            disabled={adding.has(m.device_id)}
            style={{
              padding: "5px 12px", borderRadius: 16, border: "1px solid #c084fc",
              background: "rgba(192,132,252,.1)", color: "#9b6cf5",
              fontSize: 11, fontWeight: 700, cursor: "pointer",
            }}
          >{adding.has(m.device_id) ? "..." : "+ 加朋友"}</button>
        </div>
      ))}
    </div>
  );
}
