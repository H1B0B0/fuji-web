import { merge } from "lodash";
import { create, StateCreator } from "zustand";
import { immer } from "zustand/middleware/immer";
import { createJSONStorage, devtools, persist } from "zustand/middleware";
import { createCurrentTaskSlice, CurrentTaskSlice } from "./currentTask";
import { createUiSlice, UiSlice } from "./ui";
import { findBestMatchingModel } from "../helpers/aiSdkUtils";

export type SettingsSlice = {
  openAIKey: string;
  anthropicKey: string;
  geminiKey: string;
  huggingFaceKey: string;
  openAIBaseUrl: string;
  anthropicBaseUrl: string;
  agentMode: string;
  selectedModel: string;
  voiceMode: string;
  customKnowledgeBase: string;
  maxActions: number;
  actions: {
    update: (settings: Partial<Omit<SettingsSlice, "actions">>) => void;
  };
};

export type StoreType = {
  currentTask: CurrentTaskSlice;
  ui: UiSlice;
  settings: SettingsSlice;
};

export type MyStateCreator<T> = StateCreator<
  StoreType,
  [["zustand/immer", never]],
  [],
  T
>;

export const createSettingsSlice: MyStateCreator<SettingsSlice> = (set) => ({
  openAIKey: "",
  anthropicKey: "",
  geminiKey: "",
  huggingFaceKey: "",
  openAIBaseUrl: "",
  anthropicBaseUrl: "",
  agentMode: "",
  selectedModel: "",
  voiceMode: "",
  customKnowledgeBase: "",
  maxActions: 50, // valeur par défaut
  actions: {
    update: (settings) =>
      set((state) => {
        Object.assign(state.settings, settings);
        if (settings.maxActions) {
          state.currentTask.maxActions = settings.maxActions;
        }
      }),
  },
});

export const useAppState = create<StoreType>()(
  persist(
    immer(
      devtools((...a) => ({
        currentTask: createCurrentTaskSlice(...a),
        ui: createUiSlice(...a),
        settings: createSettingsSlice(...a),
      })),
    ),
    {
      name: "app-state",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Stuff we want to persist
        ui: {
          instructions: state.ui.instructions,
        },
        settings: {
          openAIKey: state.settings.openAIKey,
          anthropicKey: state.settings.anthropicKey,
          geminiKey: state.settings.geminiKey,
          huggingFaceKey: state.settings.huggingFaceKey, // Ajoutez cette ligne
          openAIBaseUrl: state.settings.openAIBaseUrl,
          anthropicBaseUrl: state.settings.anthropicBaseUrl,
          agentMode: state.settings.agentMode,
          selectedModel: state.settings.selectedModel,
          voiceMode: state.settings.voiceMode,
          customKnowledgeBase: state.settings.customKnowledgeBase,
        },
      }),
      merge: (persistedState, currentState) => {
        const result = merge(currentState, persistedState);
        result.settings.selectedModel = findBestMatchingModel(
          result.settings.selectedModel,
          result.settings.agentMode,
          result.settings.openAIKey,
          result.settings.anthropicKey,
          result.settings.geminiKey,
          result.settings.huggingFaceKey, // Ajoutez cette ligne
        );
        return result;
      },
    },
  ),
);

// @ts-expect-error used for debugging
window.getState = useAppState.getState;
