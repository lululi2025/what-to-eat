// ─── 心情濾鏡 ───
// id → Google Places types 對應
// 有些心情會額外加 nameKeywords 做二次過濾，
// 因為 Google Places 在台灣的 type 標籤很亂（例如居酒屋常被標成 restaurant）

export const MOODS = [
  {
    id: "random",
    label: "隨便",
    icon: "/illustrations/mood-random.webp",
    desc: "什麼都好",
    types: ["restaurant", "cafe", "bakery", "meal_takeaway"],
    nameKeywords: null,
  },
  {
    id: "hungry",
    label: "餓爆了",
    icon: "/illustrations/mood-hungry.webp",
    desc: "吃飽為主",
    types: ["restaurant", "meal_takeaway"],
    nameKeywords: null,
  },
  {
    id: "chill",
    label: "想放鬆",
    icon: "/illustrations/mood-chill.webp",
    desc: "坐下慢慢喝",
    types: ["cafe"],
    nameKeywords: null,
  },
  {
    id: "sweet",
    label: "想吃甜",
    icon: "/illustrations/mood-sweet.webp",
    desc: "甜點、麵包、咖啡",
    types: ["bakery", "cafe"],
    nameKeywords: [
      // 甜食
      "甜", "蛋糕", "cake", "巧克力", "chocolate", "可麗餅", "crepe",
      "鬆餅", "waffle", "pancake", "布丁", "pudding", "塔", "tart",
      "派", "pie", "泡芙", "cream puff", "馬卡龍", "macaron", "餅乾", "cookie",
      // 麵包烘焙
      "麵包", "bakery", "bread", "土司", "吐司", "toast", "可頌", "croissant",
      "貝果", "bagel", "餡餅", "司康", "scone",
      // 甜甜圈
      "donut", "doughnut", "甜甜圈",
      // 冰品
      "冰", "ice", "gelato", "冰淇淋", "聖代", "百匯", "雪花", "刨", "sorbet",
      // 茶咖啡
      "茶", "tea", "咖啡", "coffee", "cafe", "café", "下午茶", "brunch", "早午餐",
      "boba", "珍奶", "奶茶",
      // 中式甜品
      "豆花", "仙草", "愛玉", "紅豆", "綠豆", "湯圓", "麻糬", "mochi",
      "和菓子", "wagashi", "dorayaki", "銅鑼燒", "御飯糰",
    ],
  },
  {
    id: "fast",
    label: "趕時間",
    icon: "/illustrations/mood-fast.webp",
    desc: "外帶外送",
    types: ["meal_takeaway", "meal_delivery"],
    nameKeywords: null,
  },
  {
    id: "drink",
    label: "想喝兩杯",
    icon: "/illustrations/mood-drink.webp",
    desc: "酒吧 / 餐酒館 / 居酒屋",
    types: ["bar", "restaurant"],
    nameKeywords: [
      // 場所類型
      "bar", "BAR", "pub", "PUB", "lounge", "tavern",
      "酒吧", "酒館", "酒場", "酒坊", "酒鋪", "餐酒", "小酒館",
      "居酒屋", "izakaya", "IZAKAYA",
      "speakeasy",
      // 酒類
      "酒", "酒精", "酒類",
      "beer", "BEER", "啤酒", "craft beer", "精釀", "ale", "stout", "ipa", "IPA",
      "wine", "葡萄酒", "紅酒", "白酒", "wine bar",
      "whiskey", "whisky", "威士忌", "scotch", "bourbon",
      "cocktail", "調酒", "mixology", "highball",
      "sake", "清酒", "梅酒", "燒酎",
      "gin", "rum", "tequila", "vodka",
      // 製酒 / 釀酒
      "tap", "tap room", "brewery", "brewing", "brew", "brewpub", "釀",
    ],
  },
];

export function getMood(id) {
  return MOODS.find(m => m.id === id) || MOODS[0];
}

// 二次過濾：店家名字是否符合 mood 的關鍵字白名單
export function matchesMoodKeywords(name, mood) {
  if (!mood?.nameKeywords) return true;       // 沒設關鍵字 = 不過濾
  if (!name) return false;
  const lower = name.toLowerCase();
  return mood.nameKeywords.some(k => lower.includes(k.toLowerCase()));
}
