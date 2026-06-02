// ─── 吃飯任務卡庫 ───
// 加上「來點挑戰」toggle 時，每次抽店會順便抽一張任務
// 任務不影響餐廳選擇，純粹是增加吃飯這件事本身的趣味

export const TASK_CATEGORIES = {
  order:    { label: "點餐冒險", emoji: "🍽" },
  social:   { label: "社交挑戰", emoji: "💬" },
  record:   { label: "紀錄挑戰", emoji: "📸" },
  explore:  { label: "探索挑戰", emoji: "🌍" },
  pace:     { label: "速度挑戰", emoji: "⏱" },
  taste:    { label: "味覺挑戰", emoji: "🧂" },
};

export const TASKS = [
  // 點餐冒險（8）
  { id: "o1", cat: "order",   text: "點菜單上看不懂的一道菜" },
  { id: "o2", cat: "order",   text: "跟老闆要推薦菜，不要自己選" },
  { id: "o3", cat: "order",   text: "點兩個甜點當主餐吃" },
  { id: "o4", cat: "order",   text: "只點今日特餐 / 招牌菜" },
  { id: "o5", cat: "order",   text: "點一個你以為自己不會喜歡的菜" },
  { id: "o6", cat: "order",   text: "把預算壓在 200 元以內" },
  { id: "o7", cat: "order",   text: "點菜單第一頁第一道" },
  { id: "o8", cat: "order",   text: "讓同行的人幫你決定" },

  // 社交挑戰（6）
  { id: "s1", cat: "social",  text: "跟隔壁桌的人問一句話" },
  { id: "s2", cat: "social",  text: "跟服務生聊超過 30 秒" },
  { id: "s3", cat: "social",  text: "離開前當面跟老闆說「下次還會來」" },
  { id: "s4", cat: "social",  text: "問問店裡常客都點什麼" },
  { id: "s5", cat: "social",  text: "稱讚一道菜的具體細節（不只說好吃）" },
  { id: "s6", cat: "social",  text: "請老闆推薦一個附近的店家" },

  // 紀錄挑戰（6）
  { id: "r1", cat: "record",  text: "全程不能用手機拍菜" },
  { id: "r2", cat: "record",  text: "用文字寫下三種味道（酸甜苦辣鹹...）" },
  { id: "r3", cat: "record",  text: "拍一張只有店裡角落、不入菜的照片" },
  { id: "r4", cat: "record",  text: "錄一段 5 秒影片紀念" },
  { id: "r5", cat: "record",  text: "在餐巾紙上畫一張這家店的 logo" },
  { id: "r6", cat: "record",  text: "幫這家店想一句廣告詞" },

  // 探索挑戰（8）
  { id: "e1", cat: "explore", text: "找一道你從沒吃過的料理類型" },
  { id: "e2", cat: "explore", text: "找菜單上最便宜的那道" },
  { id: "e3", cat: "explore", text: "找標榜「招牌」「人氣」「主廚推薦」的菜" },
  { id: "e4", cat: "explore", text: "點一個店名／菜名裡有顏色的菜" },
  { id: "e5", cat: "explore", text: "問廚房今天最新鮮的食材" },
  { id: "e6", cat: "explore", text: "點一個含三種以上配料的菜" },
  { id: "e7", cat: "explore", text: "找菜單上有用「秘製」「獨家」字眼的" },
  { id: "e8", cat: "explore", text: "點一個你猜不出來內容物的菜" },

  // 速度挑戰（4）
  { id: "p1", cat: "pace",    text: "20 分鐘內吃完離開" },
  { id: "p2", cat: "pace",    text: "慢慢吃，故意待超過 1 小時" },
  { id: "p3", cat: "pace",    text: "每口咀嚼 20 下再吞" },
  { id: "p4", cat: "pace",    text: "全程不滑手機，專心吃" },

  // 味覺挑戰（8）
  { id: "t1", cat: "taste",   text: "點最辣的選項" },
  { id: "t2", cat: "taste",   text: "完全不加醬料、原味吃完" },
  { id: "t3", cat: "taste",   text: "把所有醬料都加一點試試" },
  { id: "t4", cat: "taste",   text: "點主廚最得意的那道" },
  { id: "t5", cat: "taste",   text: "選一個店裡看起來最特別的飲料" },
  { id: "t6", cat: "taste",   text: "點一個熱的 + 一個冰的搭配" },
  { id: "t7", cat: "taste",   text: "閉眼睛吃一口，光靠味道猜食材" },
  { id: "t8", cat: "taste",   text: "點同類型菜中價位最高的那道" },
];

// 隨機抽一張任務（可指定排除某幾個 id，避免連續抽到同一張）
export function pickRandomTask(excludeIds = []) {
  const pool = TASKS.filter(t => !excludeIds.includes(t.id));
  if (pool.length === 0) return TASKS[Math.floor(Math.random() * TASKS.length)];
  return pool[Math.floor(Math.random() * pool.length)];
}

export function getTask(id) {
  return TASKS.find(t => t.id === id) || null;
}
