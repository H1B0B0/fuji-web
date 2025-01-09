import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI, type Part } from "@google/generative-ai";
import OpenAI from "openai";
import { useAppState } from "../state/store";
import { enumValues } from "./utils";
import { HfInference } from "@huggingface/inference";
import { extractJsonFromMarkdown } from "./dom-agent/parseResponse";

// Ajouter les actions autorisées en constante
const VALID_ACTIONS = [
  "click",
  "setValue",
  "setValueAndEnter",
  "navigate",
  "scroll",
  "wait",
  "finish",
  "fail",
] as const;

type ValidActionType = (typeof VALID_ACTIONS)[number];

export enum AgentMode {
  // Vision = "vision",
  VisionEnhanced = "vision-enhanced",
  Text = "text",
}

export enum SupportedModels {
  O1Preview = "o1-preview",
  O1Mini = "o1-mini",
  Gpt35Turbo16k = "gpt-3.5-turbo-16k",
  Gpt4 = "gpt-4",
  Gpt4TurboPreview = "gpt-4-turbo-preview",
  Gpt4VisionPreview = "gpt-4-vision-preview",
  Gpt4Turbo = "gpt-4-turbo",
  Gpt4O = "gpt-4o",
  Gpt4OMini = "gpt-4o-mini",
  Claude3Sonnet = "claude-3-sonnet-20240229",
  Claude3Opus = "claude-3-opus-20240229",
  Claude35Sonnet = "claude-3.5-sonnet-20240620",
  Gemini15Pro = "gemini-1.5-pro",
  HuggingFaceLlama32 = "Qwen/Qwen2-VL-2B-Instruct",
}

function isSupportedModel(value: string): value is SupportedModels {
  return enumValues(SupportedModels).includes(value as SupportedModels);
}

export const DEFAULT_MODEL = SupportedModels.Gpt4Turbo;

export const DisplayName = {
  [SupportedModels.O1Preview]: "O1 Preview",
  [SupportedModels.O1Mini]: "O1 Mini",
  [SupportedModels.Gpt35Turbo16k]: "GPT-3.5 Turbo (16k)",
  [SupportedModels.Gpt4]: "GPT-4",
  [SupportedModels.Gpt4TurboPreview]: "GPT-4 Turbo (Preview)",
  [SupportedModels.Gpt4VisionPreview]: "GPT-4 Vision (Preview)",
  [SupportedModels.Gpt4Turbo]: "GPT-4 Turbo",
  [SupportedModels.Gpt4O]: "GPT-4o",
  [SupportedModels.Gpt4OMini]: "GPT-4o Mini",
  [SupportedModels.Claude3Sonnet]: "Claude 3 Sonnet",
  [SupportedModels.Claude3Opus]: "Claude 3 Opus",
  [SupportedModels.Claude35Sonnet]: "Claude 3.5 Sonnet",
  [SupportedModels.Gemini15Pro]: "Gemini 1.5 Pro",
  [SupportedModels.HuggingFaceLlama32]:
    "Qwen/Qwen2-VL-2B-Instruct (Hugging Face)",
};

export function hasVisionSupport(model: SupportedModels) {
  return (
    model === SupportedModels.Gpt4VisionPreview ||
    model === SupportedModels.Gpt4Turbo ||
    model === SupportedModels.Gpt4O ||
    model === SupportedModels.Gpt4OMini ||
    model === SupportedModels.Claude3Sonnet ||
    model === SupportedModels.Claude3Opus ||
    model === SupportedModels.Claude35Sonnet ||
    model === SupportedModels.Gemini15Pro ||
    model === SupportedModels.HuggingFaceLlama32 ||
    downloadedModelsCache.has(model as string)
  );
}

export type SDKChoice =
  | "OpenAI"
  | "Anthropic"
  | "Google"
  | "Ollama"
  | "HuggingFace";

function chooseSDK(model: SupportedModels): SDKChoice {
  if (downloadedModelsCache.has(model as string)) {
    return "Ollama";
  }
  if (
    model === SupportedModels.HuggingFaceLlama32 ||
    model.startsWith("meta-llama")
  ) {
    return "HuggingFace";
  }
  if (model.startsWith("claude")) {
    return "Anthropic";
  }
  if (model.startsWith("gemini")) {
    return "Google";
  }
  return "OpenAI";
}

export function isOpenAIModel(model: SupportedModels) {
  return chooseSDK(model) === "OpenAI";
}
export function isAnthropicModel(model: SupportedModels) {
  return chooseSDK(model) === "Anthropic";
}
export function isGoogleModel(model: SupportedModels) {
  return chooseSDK(model) === "Google";
}

export const isLocalModel = (model: string): boolean => {
  if (downloadedModelsCache.has(model)) {
    return true;
  }
  return false;
};

export function isHuggingFaceModel(model: SupportedModels): boolean {
  return chooseSDK(model) === "HuggingFace";
}

export function isValidModelSettings(
  selectedModel: string,
  agentMode: AgentMode,
  openAIKey?: string,
  anthropicKey?: string,
  geminiKey?: string,
  huggingFaceKey?: string,
): boolean {
  // Vérifier d'abord si Ollama est disponible
  if (downloadedModelsCache.size > 0) {
    return true;
  }

  // Vérifier si c'est un modèle local
  if (
    selectedModel.startsWith("mistral") ||
    downloadedModelsCache.has(selectedModel)
  ) {
    return true;
  }

  // Vérifier si c'est un modèle supporté
  if (!enumValues(SupportedModels).includes(selectedModel as SupportedModels)) {
    return false;
  }

  // Vérification du mode vision
  if (
    agentMode === AgentMode.VisionEnhanced &&
    !hasVisionSupport(selectedModel)
  ) {
    return false;
  }

  // Vérification des clés API
  if (isOpenAIModel(selectedModel) && !openAIKey) return false;
  if (isAnthropicModel(selectedModel) && !anthropicKey) return false;
  if (isGoogleModel(selectedModel) && !geminiKey) return false;
  if (isHuggingFaceModel(selectedModel) && !huggingFaceKey) return false;

  return true;
}

export function findBestMatchingModel(
  selectedModel: string,
  agentMode: AgentMode,
  openAIKey: string | undefined,
  anthropicKey: string | undefined,
  geminiKey: string | undefined,
  huggingFaceKey: string | undefined,
): SupportedModels {
  // Vérifier d'abord les modèles locaux
  if (downloadedModelsCache.has(selectedModel)) {
    return selectedModel as SupportedModels;
  }

  // Si le modèle actuel est valide, le conserver
  if (
    isValidModelSettings(
      selectedModel,
      agentMode,
      openAIKey,
      anthropicKey,
      geminiKey,
      huggingFaceKey,
    )
  ) {
    return selectedModel as SupportedModels;
  }

  // Sélectionner le premier modèle local disponible
  const localModels = Array.from(downloadedModelsCache);
  if (localModels.length > 0) {
    return localModels[0] as SupportedModels;
  }

  // Sinon, sélectionner un modèle basé sur les clés API disponibles
  if (openAIKey) return SupportedModels.Gpt4Turbo;
  if (anthropicKey) return SupportedModels.Claude35Sonnet;
  if (geminiKey) return SupportedModels.Gemini15Pro;
  if (huggingFaceKey) return SupportedModels.HuggingFaceLlama32;

  return DEFAULT_MODEL;
}

export type CommonMessageCreateParams = {
  prompt: string;
  imageData?: string;
  systemMessage?: string;
  jsonMode?: boolean;
};

export type Response = {
  usage: OpenAI.CompletionUsage | undefined;
  rawResponse: string;
};

export type OllamaModelInfo = {
  name: string;
  size: string;
  digest: string;
  modified_at: string;
  status: "downloaded" | "downloading" | "not_downloaded";
};

export async function listOllamaModels(): Promise<OllamaModelInfo[]> {
  try {
    const response = await fetch("http://localhost:11434/api/tags");
    if (!response.ok) {
      throw new Error("Failed to fetch Ollama models");
    }
    const data = await response.json();
    // S'assurer que les modèles sont correctement formatés
    return (data.models || []).map((model: any) => ({
      ...model,
      name: model.name || model.model, // Certains modèles utilisent 'model' au lieu de 'name'
      status: "downloaded", // Si le modèle est listé, il est considéré comme téléchargé
    }));
  } catch (error) {
    console.error("Error listing Ollama models:", error);
    return [];
  }
}

// Fonction utilitaire pour normaliser les noms de modèles
function normalizeModelName(modelName: string): string {
  if (!modelName) return "";

  // Remove only version tags like :latest but keep model variants like :20b
  const parts = modelName.split(":");
  if (parts.length <= 1) return modelName;

  // Keep the first part and any part that contains numbers (model variants)
  const modelBase = parts[0];
  const variant = parts.slice(1).find((part) => /\d/.test(part));

  return variant ? `${modelBase}:${variant}` : modelBase;
}

export const addNewOllamaModel = (modelName: string) => {
  const cleanModelName = normalizeModelName(modelName).replace(
    /[^a-zA-Z0-9-._:]/g,
    "",
  );

  // Vérifier si le modèle existe déjà
  if (downloadedModelsCache.has(cleanModelName)) {
    return; // Ne pas ajouter de doublon
  }

  downloadedModelsCache.add(cleanModelName);
  saveDownloadedModels();
  console.log(`Added model ${cleanModelName} to cache`);
};

// Ajouter un cache pour les modèles téléchargés
export const downloadedModelsCache = new Set<string>();

// 1. Ajouter la persistance des modèles
const STORAGE_KEY = "ollama-downloaded-models";

// Charger les modèles depuis le storage au démarrage
const loadDownloadedModels = () => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    const models = JSON.parse(stored);
    models.forEach((model: string) => {
      downloadedModelsCache.add(model);
      addNewOllamaModel(model);
    });
  }
};

// Sauvegarder les modèles dans le storage
const saveDownloadedModels = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...downloadedModelsCache]));
};

// 2. Modifier downloadOllamaModel pour persister
export async function downloadOllamaModel(
  modelName: string,
  onProgress?: (progress: number) => void,
): Promise<boolean> {
  try {
    const response = await fetch("http://localhost:11434/api/pull", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // NOTE the parameter name should match Ollama’s API spec:
        model: modelName,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to download model ${modelName}`);
    }

    const reader = response.body?.getReader();
    if (!reader) return false;

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        buffer += decoder.decode(value, { stream: true });
        let newlineIndex;
        // Parse line by line
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);
          if (!line) continue;
          try {
            const statusObj = JSON.parse(line);
            // If the API returns total & completed, update progress
            if (statusObj.total && statusObj.completed && onProgress) {
              onProgress((statusObj.completed / statusObj.total) * 100);
            }
          } catch (e) {
            console.error("JSON parse error:", e);
          }
        }
      }
    }

    addNewOllamaModel(modelName);
    downloadedModelsCache.add(modelName);
    saveDownloadedModels();
    await refreshOllamaModelsCache();
    return true;
  } catch (error) {
    console.error(`Error downloading Ollama model ${modelName}:`, error);
    return false;
  }
}

export async function createCustomOllamaModel(
  modelFile: string,
): Promise<boolean> {
  try {
    const response = await fetch("http://localhost:11434/api/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "custom-model",
        modelfile: modelFile,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to create custom model");
    }

    return true;
  } catch (error) {
    console.error("Error creating custom Ollama model:", error);
    return false;
  }
}

// Modifier l'export pour rendre la fonction accessible
export const refreshOllamaModelsCache = async (): Promise<void> => {
  try {
    const models = await listOllamaModels();

    downloadedModelsCache.clear();

    // Filtrer et traiter les modèles
    models.forEach((model) => {
      // Vérifier si le modèle est un modèle valide
      if (model.name) {
        const normalizedName = normalizeModelName(model.name);
        console.log(
          `Processing model: ${normalizedName}, status: ${model.status}`,
        );
        if (normalizedName) {
          downloadedModelsCache.add(normalizedName);
          console.log(`Added model to cache: ${normalizedName}`);
        }
      }
    });

    saveDownloadedModels();
    console.log("Final cache contents:", Array.from(downloadedModelsCache));
  } catch (error) {
    console.error("Error refreshing Ollama models cache:", error);
  }
};

// 4. Initialiser au démarrage
loadDownloadedModels();
refreshOllamaModelsCache();

async function validateAndResizeImage(
  base64Data: string,
  format: string,
): Promise<string> {
  const MAX_SIZE = 1120;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // Check if resize needed
      if (img.width <= MAX_SIZE && img.height <= MAX_SIZE) {
        // Always convert to PNG format
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        // Convert to PNG without specifying format
        resolve(canvas.toDataURL().split(",")[1]);
        return;
      }

      // Resize image
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }

      // Calculate new dimensions
      const ratio = Math.min(MAX_SIZE / img.width, MAX_SIZE / img.height);
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;

      // Draw resized image
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Convert to PNG without specifying format
      resolve(canvas.toDataURL().split(",")[1]);
    };

    img.onerror = () => reject(new Error("Failed to load image"));
    // Load original format but will convert to PNG
    img.src = `data:image/${format};base64,${base64Data}`;
  });
}

export async function fetchResponseFromModelOllama(
  model: SupportedModels,
  params: CommonMessageCreateParams,
): Promise<Response> {
  console.log("fetchResponseFromModelOllama with params:", params);

  // Verify cache and download if needed
  if (!downloadedModelsCache.has(model)) {
    const models = await listOllamaModels();
    const modelInfo = models.find((m) => m.name === model);

    if (!modelInfo || modelInfo.status === "not_downloaded") {
      console.log(`Model ${model} not found, attempting to download...`);
      const downloaded = await downloadOllamaModel(model);
      if (!downloaded) {
        throw new Error(`Failed to download model ${model}`);
      }
    }
    downloadedModelsCache.add(model);
  }

  const url = "http://localhost:11434/api/chat";

  // Handle image data
  let imageContent = null;
  if (params.imageData) {
    try {
      const matches = params.imageData.match(
        /^data:image\/(gif|jpe?g|png|webp);base64,(.+)$/,
      );
      if (!matches) {
        throw new Error(
          "Format d'image invalide - Doit être GIF, JPEG, PNG ou WebP",
        );
      }

      const [_, format, base64Data] = matches;
      console.log(`Processing ${format} image...`);

      if (!base64Data?.trim()) {
        throw new Error("Données image vides");
      }

      // Validate size and resize if needed
      imageContent = await validateAndResizeImage(base64Data, format);
      console.log("Image processed successfully");
    } catch (error) {
      console.error("Erreur de traitement image:", error);
      throw error;
    }
  }

  // Handle system message
  const systemPrompt = params.systemMessage || "";

  console.log("Debug Image Content:", imageContent);

  const payload = {
    model: model,
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: params.prompt,
        ...(imageContent ? { images: [imageContent] } : {}),
      },
    ],
    stream: false,
    format: {
      type: "object",
      properties: {
        thought: {
          type: "string",
        },
        action: {
          type: "object",
          properties: {
            name: {
              type: "string",
            },
            args: {
              type: "object",
            },
          },
          required: ["name", "args"],
        },
      },
      required: ["thought", "action"],
    },
    options: {
      temperature: 0,
    },
  };

  // Ajouter une validation plus stricte de la réponse
  const validateResponse = (response: any): boolean => {
    if (!response || typeof response !== "object") return false;
    if (typeof response.thought !== "string") return false;
    if (!response.action || typeof response.action !== "object") return false;
    if (!VALID_ACTIONS.includes(response.action.name)) return false;
    if (!response.action.args || typeof response.action.args !== "object")
      return false;
    return true;
  };

  try {
    console.log("Sending payload to Ollama:", JSON.stringify(payload, null, 2));

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Ollama API error:", errorText);
      throw new Error(`Ollama API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    console.log("Ollama response:", data);

    let formattedResponse = data.message?.content || "";

    // Ensure the response is valid JSON and has correct action
    try {
      const parsed = JSON.parse(formattedResponse);

      if (!validateResponse(parsed)) {
        formattedResponse = JSON.stringify({
          thought: "Invalid action attempted. Using only allowed actions.",
          action: {
            name: "fail",
            args: {
              reason:
                "Attempted to use invalid action. Only specific web automation actions are allowed.",
            },
          },
        });
      }
    } catch (e) {
      formattedResponse = JSON.stringify({
        thought: "Error: Invalid JSON response",
        action: {
          name: "fail",
          args: {
            reason: "Model response was not valid JSON",
          },
        },
      });
    }

    return {
      usage: {
        total_tokens: data.eval_count || 0,
        prompt_tokens: data.prompt_eval_count || 0,
        completion_tokens: 0,
      },
      rawResponse: formattedResponse,
    };
  } catch (error) {
    console.error("Ollama fetch error:", error);
    throw error;
  }
}

export async function fetchResponseFromModelHuggingFace(
  model: SupportedModels,
  params: CommonMessageCreateParams,
): Promise<Response> {
  const key = useAppState.getState().settings.huggingFaceKey;
  if (!key) {
    throw new Error("No Hugging Face key found");
  }

  const client = new HfInference(key);

  try {
    const MAX_CONTEXT_LENGTH = 4096;
    const MAX_NEW_TOKENS = 500;
    const RESERVE_TOKENS = MAX_NEW_TOKENS + 100; // Reserve some tokens for system message and response

    // Calculate available tokens for input
    const MAX_INPUT_TOKENS = MAX_CONTEXT_LENGTH - RESERVE_TOKENS;

    // Prepare messages
    let messages = [
      {
        role: "system",
        content: params.systemMessage || "",
      },
      {
        role: "user",
        content: params.prompt,
      },
    ];

    // Truncate prompt if needed
    if (params.prompt.length > MAX_INPUT_TOKENS) {
      messages[1].content = params.prompt.substring(0, MAX_INPUT_TOKENS);
    }

    // Add image if present
    if (params.imageData) {
      messages[1].content = JSON.stringify([
        {
          type: "text",
          text: messages[1].content,
        },
        {
          type: "image_url",
          image_url: params.imageData,
        },
      ]);
    }

    const chatCompletion = await client.textGenerationStream({
      model: model,
      inputs: JSON.stringify({
        messages,
        max_tokens: MAX_NEW_TOKENS,
        temperature: 0.7,
        response_format: { type: "json_object" },
      }),
      parameters: {
        return_full_text: false,
        max_new_tokens: MAX_NEW_TOKENS,
      },
    });

    console.log("Raw HF response:", chatCompletion);

    let responseContent = chatCompletion.choices[0].message?.content;
    if (!responseContent) {
      throw new Error("Empty response from HuggingFace API");
    }

    // Clean up the response and ensure it's valid JSON
    try {
      // Remove any markdown formatting
      responseContent = responseContent.replace(/```json\s*|\s*```/g, "");

      // Ensure it starts with {
      if (!responseContent.trim().startsWith("{")) {
        responseContent = "{" + responseContent;
      }

      // Parse to validate JSON
      JSON.parse(responseContent);

      return {
        usage: undefined,
        rawResponse: responseContent,
      };
    } catch (e) {
      console.error("Failed to parse HF response as JSON:", e);
      // Attempt to construct a valid JSON response
      const fallbackResponse = {
        thought: "Error formatting response",
        action: {
          name: "fail",
          args: {
            reason: "Invalid JSON response from model",
          },
        },
      };
      return {
        usage: undefined,
        rawResponse: JSON.stringify(fallbackResponse),
      };
    }
  } catch (error) {
    console.error("Hugging Face API error:", error);
    throw error;
  }
}

export async function fetchResponseFromModelOpenAI(
  model: SupportedModels,
  params: CommonMessageCreateParams,
): Promise<Response> {
  const key = useAppState.getState().settings.openAIKey;
  if (!key) {
    throw new Error("No OpenAI key found");
  }
  const baseURL = useAppState.getState().settings.openAIBaseUrl;
  const openai = new OpenAI({
    apiKey: key,
    baseURL: baseURL ? baseURL : undefined, // explicitly set to undefined because empty string would cause an error
    dangerouslyAllowBrowser: true, // user provides the key
  });
  const messages: OpenAI.ChatCompletionMessageParam[] = [];
  if (params.systemMessage != null) {
    // O1 does not support system message
    if (
      model === SupportedModels.O1Preview ||
      model === SupportedModels.O1Mini
    ) {
      messages.push({
        role: "user",
        content: params.systemMessage,
      });
    } else {
      messages.push({
        role: "system",
        content: params.systemMessage,
      });
    }
  }
  const content: OpenAI.ChatCompletionContentPart[] = [
    {
      type: "text",
      text: params.prompt,
    },
  ];
  if (params.imageData != null) {
    content.push({
      type: "image_url",
      image_url: {
        url: params.imageData,
      },
    });
  }
  messages.push({
    role: "user",
    content,
  });
  if (params.jsonMode) {
    messages.push({
      role: "assistant",
      content: "{",
    });
  }
  const completion = await openai.chat.completions.create({
    model: model,
    messages,
    // max_completion_tokens: 1000,
    // temperature: 0,
  });
  let rawResponse = completion.choices[0].message?.content?.trim() ?? "";
  // Valider le JSON
  return {
    usage: completion.usage,
    rawResponse,
  };
}

export async function fetchResponseFromModelAnthropic(
  model: SupportedModels,
  params: CommonMessageCreateParams,
): Promise<Response> {
  const key = useAppState.getState().settings.anthropicKey;
  if (!key) {
    throw new Error("No Anthropic key found");
  }
  const baseURL = useAppState.getState().settings.anthropicBaseUrl;
  const anthropic = new Anthropic({
    apiKey: key,
    baseURL: baseURL ? baseURL : undefined, // explicitly set to undefined because empty string would cause an error
  });
  const content: Anthropic.MessageParam["content"] = [
    {
      type: "text",
      text: params.prompt,
    },
  ];
  if (params.imageData != null) {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/webp",
        // need to remove the prefix
        data: params.imageData.split("base64,")[1],
      },
    });
  }
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content,
    },
  ];
  if (params.jsonMode) {
    messages.push({
      role: "assistant",
      content: [
        {
          type: "text",
          text: "{",
        },
      ],
    });
  }
  const completion = await anthropic.messages.create(
    {
      model,
      system: params.systemMessage,
      messages,
      max_tokens: 1000,
      temperature: 0,
    },
    {
      headers: {
        "anthropic-dangerous-direct-browser-access": "true",
      },
    },
  );
  let rawResponse = completion.content[0].text.trim();
  if (params.jsonMode && !rawResponse.startsWith("{")) {
    rawResponse = "{" + rawResponse;
  }
  // Valider le JSON
  return {
    usage: {
      completion_tokens: completion.usage.output_tokens,
      prompt_tokens: completion.usage.input_tokens,
      total_tokens:
        completion.usage.output_tokens + completion.usage.input_tokens,
    },
    rawResponse,
  };
}

export async function fetchResponseFromModelGoogle(
  model: SupportedModels,
  params: CommonMessageCreateParams,
): Promise<Response> {
  const key = useAppState.getState().settings.geminiKey;
  if (!key) {
    throw new Error("No Google Gemini key found");
  }
  const genAI = new GoogleGenerativeAI(key);
  const client = genAI.getGenerativeModel({
    model: model,
    systemInstruction: params.systemMessage,
  });
  const requestInput: Array<string | Part> = [];
  requestInput.push(params.prompt);
  if (params.imageData != null) {
    requestInput.push({
      inlineData: {
        data: params.imageData.split("base64,")[1],
        mimeType: "image/webp",
      },
    });
  }
  const result = await client.generateContent(requestInput);
  const response = result.response;
  let rawResponse = response.text();
  console.log("Google response:", rawResponse);

  // Extract JSON from markdown if needed
  const jsonMatches = extractJsonFromMarkdown(rawResponse);
  if (jsonMatches.length > 0) {
    rawResponse = jsonMatches[0];
  }
  // Valider le JSON
  return {
    usage: {
      completion_tokens:
        result.response.usageMetadata?.candidatesTokenCount ?? 0,
      prompt_tokens: result.response.usageMetadata?.promptTokenCount ?? 0,
      total_tokens: result.response.usageMetadata?.totalTokenCount ?? 0,
    },
    rawResponse,
  };
}

const MAX_RETRIES = 2;

function getStrictSystemPrompt(baseMessage: string = ""): string {
  return `
${baseMessage}
IMPORTANT: You are a web automation assistant. These are the rules you MUST follow:

1. Only use these actions: click, setValue, setValueAndEnter, navigate, scroll, wait, finish, fail.
2. Output MUST be valid JSON, with "thought" (string) and "action" (object containing "name" and "args").
3. Do NOT invent new actions or add any extra fields.
4. Do NOT provide direct info; only use the allowed actions.
5. If you cannot fulfill the request with these actions, use "fail" with a reason.
6. Absolutely avoid extra text or explanation outside the JSON object, and do NOT produce a second JSON object.
`.trim();
}

export async function fetchResponseFromModel(
  model: SupportedModels,
  params: CommonMessageCreateParams,
): Promise<Response> {
  const sdk = chooseSDK(model);

  // On réessaie jusqu'à MAX_RETRIES si la réponse est invalide
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    // Injecte notre prompt plus strict
    const strictParams = {
      ...params,
      systemMessage: getStrictSystemPrompt(params.systemMessage),
    };

    let response: Response;
    if (sdk === "OpenAI") {
      response = await fetchResponseFromModelOpenAI(model, strictParams);
    } else if (sdk === "Anthropic") {
      response = await fetchResponseFromModelAnthropic(model, strictParams);
    } else if (sdk === "Google") {
      response = await fetchResponseFromModelGoogle(model, strictParams);
    } else if (sdk === "Ollama") {
      response = await fetchResponseFromModelOllama(model, strictParams);
    } else if (sdk === "HuggingFace") {
      response = await fetchResponseFromModelHuggingFace(model, strictParams);
    } else {
      throw new Error("Unsupported model");
    }
    // Vérifie si le modèle a renvoyé un "fail" ou une action valide
    const parsed = JSON.parse(response.rawResponse);
    if (parsed.action.name !== "fail") {
      return response; // OK
    }
    // Sinon, on réessaie
  }

  // Après tous les essais, on force un "fail"
  return {
    usage: undefined,
    rawResponse: JSON.stringify({
      thought: "Too many invalid attempts",
      action: {
        name: "fail",
        args: { reason: "Reached max retries with invalid actions" },
      },
    }),
  };
}

export async function deleteOllamaModel(modelName: string): Promise<boolean> {
  try {
    const response = await fetch("http://localhost:11434/api/delete", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: modelName,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to delete model ${modelName}`);
    }

    // Retirer le modèle du cache
    downloadedModelsCache.delete(modelName);
    saveDownloadedModels();

    return true;
  } catch (error) {
    console.error(`Error deleting Ollama model ${modelName}:`, error);
    return false;
  }
}
// ... add this new function ...

export async function checkOllamaServer(): Promise<boolean> {
  try {
    const response = await fetch("http://localhost:11434/api/version");
    return response.ok;
  } catch (error) {
    console.error("Ollama server check failed:", error);
    return false;
  }
}

// ... existing code ...
