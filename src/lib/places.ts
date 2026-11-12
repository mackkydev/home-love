export const placesCategory = "สถานที่ติดดาว";
export const placePhotoMaxBytes = 500_000;

export const placeGroups = [
  { id: "food", th: "กินอร่อย", en: "Good food" },
  { id: "sightseeing", th: "เที่ยวเพลิน", en: "Sightseeing" },
  { id: "deals", th: "ขายถูก", en: "Good deals" },
  { id: "favorites", th: "ถูกใจใช่เลย", en: "Loved it" },
  { id: "relax", th: "นั่งชิล", en: "Relaxing spots" },
  { id: "dance", th: "แดนซ์กระจาย", en: "Dancing" },
  { id: "work", th: "นั่งทำงาน", en: "Work spots" },
  { id: "care", th: "รักษาดี", en: "Good care" },
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
