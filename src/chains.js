// ─── 連鎖店白名單 ───
// 純粹靠 name substring match，台灣 / 全球常見連鎖
// 涵蓋率 ~80%，未來可以擴充

const CHAIN_PATTERNS = [
  // 西式速食
  "麥當勞", "McDonald", "mcdonald", "摩斯", "MOS Burger", "mos burger",
  "肯德基", "KFC", "漢堡王", "Burger King", "burger king",
  "Subway", "subway",
  // 披薩
  "必勝客", "Pizza Hut", "pizza hut", "達美樂", "Domino", "domino",
  // 咖啡連鎖
  "星巴克", "Starbucks", "starbucks",
  "路易莎", "Louisa", "louisa", "cama", "CAMA",
  "85度C", "85度c", "85°C", "85 度C",
  "Mister Donut", "mister donut",
  // 超商
  "7-ELEVEN", "7-Eleven", "7-11", "統一超商", "seven eleven",
  "全家", "FamilyMart", "Family Mart", "family mart",
  "萊爾富", "Hi-Life", "OK 超商", "OKmart",
  // 餐飲集團
  "王品", "西堤", "陶板屋", "藝奇", "原燒", "夏慕尼", "聚北海道", "TASTY", "石二鍋",
  // 火鍋 / 鍋物連鎖
  "海底撈", "築間", "老四川", "老乾杯", "錢都", "鍋大爺",
  // 拉麵 / 日式連鎖
  "一風堂", "屯京", "麵屋武藏", "丸龜製麵", "吉野家", "Sukiya", "壽司郎",
  "藏壽司", "Hama Sushi", "爭鮮", "定食 8",
  // 中式 / 台式連鎖
  "鼎泰豐", "八方雲集", "三商巧福", "永和豆漿",
  "王道牛肉麵", "阿宗麵線", "鬍鬚張", "胡椒餅",
  // 飲料連鎖
  "50嵐", "五十嵐", "清心福全", "可不可", "KOI", "Comebuy", "comebuy",
  "春水堂", "迷克夏", "麻古茶坊", "茶湯會", "鶴茶樓", "一沐日",
  "CoCo 都可", "CoCo", "日出茶太", "Mr.Wish", "大苑子", "得正",
  "龜記", "迷客夏", "Tea Top", "丸作", "鹿角巷",
  // 早餐連鎖
  "美而美", "弘爺", "Q Burger", "麥味登", "Lai Lai", "拉亞漢堡", "豐盛號",
];

// 預先 lowercase 以加速比對
const LOWER_PATTERNS = CHAIN_PATTERNS.map(p => p.toLowerCase());

export function isChain(name) {
  if (!name) return false;
  const lower = name.toLowerCase();
  return LOWER_PATTERNS.some(p => lower.includes(p));
}
