export interface Pet {
  id: string;
  name: string;
  photo: string;
  birthday?: string;
}
export interface Todo {
  id: string;
  text: string;
  done: boolean;
}
export interface FamilyData {
  pets: Pet[];
  checkins: Record<string, Record<string, string>>;
  todos: Todo[];
  photos: { id: string; trashedAt?: string }[];
  notes: { id: string; title?: string; trashedAt?: string }[];
  [key: string]: unknown;
}
export interface ProductPageProps {
  state: FamilyData;
  setState: React.Dispatch<React.SetStateAction<FamilyData>>;
  go(page: string, pet?: string): void;
  openAI(): void;
  storageError?: string;
}
export const careItems = [
  { id: "hay", name: "喂草", detail: "确认已经补充新鲜牧草" },
  { id: "water", name: "换水", detail: "确认已经换上干净饮水" },
  { id: "clean", name: "铲屎", detail: "确认已经清理生活区域" },
  { id: "play", name: "陪玩", detail: "确认已经陪伴与活动" },
] as const;
export const localDay = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
