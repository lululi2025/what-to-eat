import {
  Coffee, Cake, BeerStein, Pizza, Hamburger, ForkKnife, BowlFood, Fish,
} from "@phosphor-icons/react";

// 從 Google Places types 推導出料理類別 key
export function categoryKey(types) {
  const t = (types || []).join(" ");
  if (t.includes("cafe") || t.includes("coffee")) return "cafe";
  if (t.includes("bakery")) return "bakery";
  if (t.includes("bar")) return "bar";
  if (t.includes("sushi")) return "sushi";
  if (t.includes("ramen") || t.includes("noodle")) return "noodle";
  if (t.includes("pizza") || t.includes("italian")) return "pizza";
  if (t.includes("burger") || t.includes("hamburger")) return "burger";
  return "default";
}

// 對應 Phosphor 圖示
export function FoodIcon({ type, size = 24, color }) {
  const props = { size, weight: "duotone", color };
  switch (type) {
    case "cafe":   return <Coffee {...props} />;
    case "bakery": return <Cake {...props} />;
    case "bar":    return <BeerStein {...props} />;
    case "noodle": return <BowlFood {...props} />;
    case "sushi":  return <Fish {...props} />;
    case "pizza":  return <Pizza {...props} />;
    case "burger": return <Hamburger {...props} />;
    default:       return <ForkKnife {...props} />;
  }
}
