-- ═════════════════════════════════════════════════════════
-- 群組決定模式 — 方案 C（混合：滑掉 NO + 共抽 + 1 次否決）
-- ═════════════════════════════════════════════════════════

-- ─── 房間 ───
CREATE TABLE rooms (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code          TEXT NOT NULL UNIQUE CHECK (length(code) = 6),
  host_id       TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'voting' CHECK (status IN ('voting', 'drawing', 'picked', 'finished')),
  candidates    JSONB NOT NULL CHECK (jsonb_array_length(candidates) <= 30),
  meta          JSONB,                                       -- {mood, radius, location}
  current_pick  TEXT,                                        -- 抽到的 place_id
  veto_used     INT NOT NULL DEFAULT 0,                      -- 已用否決次數（每房 1 次）
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '6 hours')
);

CREATE INDEX rooms_expires_at_idx ON rooms(expires_at);

-- ─── 成員 ───
CREATE TABLE members (
  room_id    UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  device_id  TEXT NOT NULL,
  name       TEXT NOT NULL CHECK (length(name) <= 20),
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_done    BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (room_id, device_id)
);

CREATE INDEX members_room_idx ON members(room_id);

-- ─── 否決票（方案 C 只記「絕對 NO」）───
CREATE TABLE vetoes (
  room_id    UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  device_id  TEXT NOT NULL,
  place_id   TEXT NOT NULL,
  voted_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, device_id, place_id)
);

CREATE INDEX vetoes_room_idx ON vetoes(room_id);
CREATE INDEX vetoes_room_place_idx ON vetoes(room_id, place_id);

-- ─── RLS（anon app，所有人可讀寫；安全靠 expires_at + check constraint + 應用層）───
ALTER TABLE rooms   ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE vetoes  ENABLE ROW LEVEL SECURITY;

-- rooms：任何人讀寫，但只能讀未過期的
CREATE POLICY "rooms_select"  ON rooms FOR SELECT USING (expires_at > now());
CREATE POLICY "rooms_insert"  ON rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "rooms_update"  ON rooms FOR UPDATE USING (expires_at > now());

-- members：任何人可加入 / 離開 / 更新自己狀態
CREATE POLICY "members_select" ON members FOR SELECT USING (true);
CREATE POLICY "members_insert" ON members FOR INSERT WITH CHECK (true);
CREATE POLICY "members_update" ON members FOR UPDATE USING (true);
CREATE POLICY "members_delete" ON members FOR DELETE USING (true);

-- vetoes：任何人可投否決票 / 取消
CREATE POLICY "vetoes_select" ON vetoes FOR SELECT USING (true);
CREATE POLICY "vetoes_insert" ON vetoes FOR INSERT WITH CHECK (true);
CREATE POLICY "vetoes_delete" ON vetoes FOR DELETE USING (true);

-- ─── Realtime publication ───
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE members;
ALTER PUBLICATION supabase_realtime ADD TABLE vetoes;
