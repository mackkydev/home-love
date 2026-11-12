export const placesCategory = "สถานที่ติดดาว";
export const placePhotoMaxBytes = 500_000;

export const placeGroups = [
  { id: "food", th: "กินอร่อย", en: "Good food", icon: "utensils" },
  { id: "sightseeing", th: "เที่ยวเพลิน", en: "Sightseeing", icon: "mountain" },
  { id: "deals", th: "ขายถูก", en: "Good deals", icon: "tag" },
  { id: "favorites", th: "ถูกใจใช่เลย", en: "Loved it", icon: "heart" },
  { id: "relax", th: "นั่งชิล", en: "Relaxing spots", icon: "cup" },
  { id: "dance", th: "แดนซ์กระจาย", en: "Dancing", icon: "music" },
  { id: "work", th: "นั่งทำงาน", en: "Work spots", icon: "laptop" },
  { id: "care", th: "รักษาดี", en: "Good care", icon: "plus" },
] as const;

export type PlaceGroup = (typeof placeGroups)[number]["id"];

export type PlaceInfo = {
  group: PlaceGroup;
  details?: string;
  phone?: string;
  locationUrl?: string;
  starred: boolean;
};

export type PlaceRecord = {
  id: string;
  name: string;
  category: typeof placesCategory;
  kind: "place";
  date: string;
  actor: string;
  photo?: string;
  place: PlaceInfo;
};

export function isPlaceRecord<T extends { kind: string; category: string; place?: PlaceInfo }>(
  entry: T,
): entry is T & Pick<PlaceRecord, "kind" | "category" | "place"> {
  return entry.kind === "place" && entry.category === placesCategory && Boolean(entry.place);
}
