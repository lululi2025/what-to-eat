-- ─── 朋友圈 + 秘密推薦 ───
-- 不上 OAuth／帳號系統，靠 device_id (localStorage) 互信
-- 朋友透過群組房間結識後互加，推薦的店會在朋友下次抽店時混進池子

-- 1) 朋友關係（雙向互信，一個 row 代表一條關係）
CREATE TABLE IF NOT EXISTS friendships (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_a   text NOT NULL,
  device_b   text NOT NULL,
  name_a     text,                            -- a 自己取的暱稱（給 b 看的）
  name_b     text,                            -- b 自己取的暱稱（給 a 看的）
  created_at timestamptz NOT NULL DEFAULT now(),
  -- 保證 a, b 順序一致避免重複（小的放 a）
  CONSTRAINT friendships_ordered CHECK (device_a < device_b),
  UNIQUE (device_a, device_b)
);

CREATE INDEX IF NOT EXISTS friendships_a_idx ON friendships(device_a);
CREATE INDEX IF NOT EXISTS friendships_b_idx ON friendships(device_b);

-- 2) 推薦
CREATE TABLE IF NOT EXISTS recommendations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_device  text NOT NULL,
  to_device    text NOT NULL,
  place_id     text NOT NULL,                 -- Google Place ID
  place_name   text NOT NULL,
  place_lat    numeric,
  place_lng    numeric,
  place_addr   text,
  message      text,                          -- 推薦者留言
  status       text NOT NULL DEFAULT 'pending', -- pending / shown / acted / dismissed
  ack_seen     boolean NOT NULL DEFAULT false, -- 推薦者有沒有收到「對方吃了」回饋
  created_at   timestamptz NOT NULL DEFAULT now(),
  acted_at     timestamptz
);

CREATE INDEX IF NOT EXISTS recs_to_pending_idx ON recommendations(to_device, status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS recs_from_ack_idx ON recommendations(from_device, ack_seen) WHERE status = 'acted' AND ack_seen = false;

-- 3) RLS：靠 device_id header 認證（已在 group_mode migration 設定 anon 可寫的模式）
ALTER TABLE friendships     ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;

-- friendships：任何人可讀寫（device_id 在 client 側，靠 unique 防重複，不認證身分）
-- 後續若加 Auth 再改成 auth.uid() 匹配
CREATE POLICY "friendships_all" ON friendships FOR ALL USING (true) WITH CHECK (true);

-- recommendations：同樣 anon 全開
CREATE POLICY "recs_all" ON recommendations FOR ALL USING (true) WITH CHECK (true);

-- 4) Realtime：朋友關係跟推薦都讓使用者即時收到
ALTER PUBLICATION supabase_realtime ADD TABLE friendships;
ALTER PUBLICATION supabase_realtime ADD TABLE recommendations;

-- UPDATE 事件能拿到完整 row
ALTER TABLE friendships     REPLICA IDENTITY FULL;
ALTER TABLE recommendations REPLICA IDENTITY FULL;
