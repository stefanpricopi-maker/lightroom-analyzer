import type { LightroomResult } from "@/app/lib/types";

export type BatchItemStatus = "waiting" | "analyzing" | "done" | "error";

export interface BatchItem {
  id: string;
  file: File;
  thumbnail: string;
  status: BatchItemStatus;
  result?: LightroomResult;
  merged?: LightroomResult;
  error?: string;
}

export type HeroStatus = "idle" | "analyzing" | "done" | "error";

export interface SceneGroup {
  id: string;
  name: string;
  heroImage: string | null;
  heroBase64: string | null;
  heroMime: string | null;
  heroResult: LightroomResult | null;
  heroStatus: HeroStatus;
  items: BatchItem[];
  collapsed: boolean;
}

export interface BatchState {
  groups: SceneGroup[];
}

export type BatchAction =
  // Groups
  | { type: "ADD_GROUP" }
  | { type: "REMOVE_GROUP"; groupId: string }
  | { type: "RENAME_GROUP"; groupId: string; name: string }
  | { type: "TOGGLE_GROUP_COLLAPSED"; groupId: string }
  // Hero per group
  | { type: "SET_HERO"; groupId: string; image: string; base64: string; mime: string }
  | { type: "SET_HERO_STATUS"; groupId: string; status: HeroStatus }
  | { type: "SET_HERO_RESULT"; groupId: string; result: LightroomResult }
  | { type: "CLEAR_HERO"; groupId: string }
  // Items
  | { type: "ADD_ITEMS"; groupId: string; items: BatchItem[] }
  | { type: "REMOVE_ITEM"; groupId: string; itemId: string }
  | { type: "MOVE_ITEM"; itemId: string; fromGroupId: string; toGroupId: string }
  | { type: "CLEAR_GROUP_ITEMS"; groupId: string }
  | { type: "SET_ITEM_STATUS"; groupId: string; itemId: string; status: BatchItemStatus; error?: string }
  | { type: "SET_ITEM_RESULT"; groupId: string; itemId: string; result: LightroomResult; merged: LightroomResult }
  | { type: "APPLY_CLUSTERS"; clusters: Array<{ name: string; items: import("@/app/lib/batchTypes").BatchItem[]; startTime: Date | null; endTime: Date | null }> };