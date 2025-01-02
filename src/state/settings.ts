import { type Data } from "../helpers/knowledge/index";
import { MyStateCreator } from "./store";
import {
  SupportedModels,
  findBestMatchingModel,
  AgentMode,
} from "../helpers/aiSdkUtils";

export type SettingsSlice = {
  openAIKey: string | undefined;
  anthropicKey: string | undefined;
  openAIBaseUrl: string | undefined;
  anthropicBaseUrl: string | undefined;
  geminiKey: string | undefined;
  huggingFaceKey: string | undefined; // Vérifier que ceci existe
  selectedModel: SupportedModels;
  agentMode: AgentMode;
  voiceMode: boolean;
  customKnowledgeBase: Data;
  actions: {
    update: (values: Partial<SettingsSlice>) => void;
  };
};
export const createSettingsSlice: MyStateCreator<SettingsSlice> = (set) => ({
  openAIKey: undefined,
  anthropicKey: undefined,
  openAIBaseUrl: undefined,
  anthropicBaseUrl: undefined,
  geminiKey: undefined,
  huggingFaceKey: undefined,
  selectedModel: SupportedModels.Gpt4Turbo,
  agentMode: AgentMode.VisionEnhanced,
  voiceMode: false,
  customKnowledgeBase: {},
  actions: {
    update: (values) => {
      set((state) => {
        const newSettings: SettingsSlice = { ...state.settings, ...values };
        newSettings.selectedModel = findBestMatchingModel(
          newSettings.selectedModel,
          newSettings.agentMode,
          newSettings.openAIKey,
          newSettings.anthropicKey,
          newSettings.geminiKey,
          newSettings.huggingFaceKey, // S'assurer que cette ligne est présente
        );
        state.settings = newSettings;
      });
    },
  },
});
