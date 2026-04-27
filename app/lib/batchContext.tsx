"use client";

import { createContext, useContext, useReducer, type ReactNode } from "react";
import type { BatchState, BatchAction, SceneGroup } from "@/app/lib/batchTypes";

function makeGroup(name: string): SceneGroup {
  return {
    id: `group-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name,
    heroImage: null, heroBase64: null, heroMime: null,
    heroResult: null, heroStatus: "idle",
    items: [],
    collapsed: false,
  };
}

const initialState: BatchState = {
  groups: [makeGroup("Scene 1")],
};

function updateGroup(groups: SceneGroup[], groupId: string, fn: (g: SceneGroup) => SceneGroup): SceneGroup[] {
  return groups.map((g) => g.id === groupId ? fn(g) : g);
}

function batchReducer(state: BatchState, action: BatchAction): BatchState {
  switch (action.type) {
    case "ADD_GROUP":
      return { ...state, groups: [...state.groups, makeGroup(`Scene ${state.groups.length + 1}`)] };

    case "REMOVE_GROUP":
      return { ...state, groups: state.groups.filter((g) => g.id !== action.groupId) };

    case "RENAME_GROUP":
      return { ...state, groups: updateGroup(state.groups, action.groupId, (g) => ({ ...g, name: action.name })) };

    case "TOGGLE_GROUP_COLLAPSED":
      return { ...state, groups: updateGroup(state.groups, action.groupId, (g) => ({ ...g, collapsed: !g.collapsed })) };

    case "SET_HERO":
      return { ...state, groups: updateGroup(state.groups, action.groupId, (g) => ({
        ...g, heroImage: action.image, heroBase64: action.base64, heroMime: action.mime,
        heroResult: null, heroStatus: "idle",
      })) };

    case "SET_HERO_STATUS":
      return { ...state, groups: updateGroup(state.groups, action.groupId, (g) => ({ ...g, heroStatus: action.status })) };

    case "SET_HERO_RESULT":
      return { ...state, groups: updateGroup(state.groups, action.groupId, (g) => ({ ...g, heroResult: action.result, heroStatus: "done" })) };

    case "CLEAR_HERO":
      return { ...state, groups: updateGroup(state.groups, action.groupId, (g) => ({
        ...g, heroImage: null, heroBase64: null, heroMime: null, heroResult: null, heroStatus: "idle",
      })) };

    case "ADD_ITEMS":
      return { ...state, groups: updateGroup(state.groups, action.groupId, (g) => ({ ...g, items: [...g.items, ...action.items] })) };

    case "REMOVE_ITEM":
      return { ...state, groups: updateGroup(state.groups, action.groupId, (g) => ({ ...g, items: g.items.filter((i) => i.id !== action.itemId) })) };

    case "MOVE_ITEM": {
      const item = state.groups.find((g) => g.id === action.fromGroupId)?.items.find((i) => i.id === action.itemId);
      if (!item) return state;
      return {
        ...state,
        groups: state.groups.map((g) => {
          if (g.id === action.fromGroupId) return { ...g, items: g.items.filter((i) => i.id !== action.itemId) };
          if (g.id === action.toGroupId) return { ...g, items: [...g.items, { ...item, status: "waiting" }] };
          return g;
        }),
      };
    }

    case "CLEAR_GROUP_ITEMS":
      return { ...state, groups: updateGroup(state.groups, action.groupId, (g) => ({ ...g, items: [] })) };

    case "SET_ITEM_STATUS":
      return { ...state, groups: updateGroup(state.groups, action.groupId, (g) => ({
        ...g, items: g.items.map((i) => i.id === action.itemId ? { ...i, status: action.status, error: action.error } : i),
      })) };

    case "SET_ITEM_RESULT":
      return { ...state, groups: updateGroup(state.groups, action.groupId, (g) => ({
        ...g, items: g.items.map((i) => i.id === action.itemId ? { ...i, status: "done", result: action.result, merged: action.merged } : i),
      })) };

    case "APPLY_CLUSTERS": {
      const newGroups = action.clusters.map((c) => ({
        ...makeGroup(c.name),
        items: c.items,
      }));
      return { ...state, groups: newGroups.length > 0 ? newGroups : [makeGroup("Scene 1")] };
    }

    default:
      return state;
  }
}

const BatchContext = createContext<{ state: BatchState; dispatch: React.Dispatch<BatchAction> } | null>(null);

export function BatchProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(batchReducer, initialState);
  return <BatchContext.Provider value={{ state, dispatch }}>{children}</BatchContext.Provider>;
}

export function useBatch() {
  const ctx = useContext(BatchContext);
  if (!ctx) throw new Error("useBatch must be used inside BatchProvider");
  return ctx;
}
