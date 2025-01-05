import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI, type Part } from "@google/generative-ai";
import OpenAI from "openai";
import { useAppState } from "../state/store";
import { enumValues } from "./utils";
import { HfInference } from "@huggingface/inference";
import { Stream } from "stream";

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
  OllamaCodeLlama = "codellama",
  OllamaMistral = "mistral",
  OllamaLlama32 = "llama3.2",
  Ollamaqwq = "qwq",
  OllamahfMinistral = "hf.co/bartowski/Ministral-8B-Instruct-2410-GGUF",
  Ollamagemma2 = "gemma2",
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
  [SupportedModels.OllamaCodeLlama]: "CodeLlama (Local)",
  [SupportedModels.OllamaMistral]: "Mistral 7b (Local)",
  [SupportedModels.OllamaLlama32]: "Llama 3.2 3b (Local)",
  [SupportedModels.Ollamaqwq]: "qwq 32b (Local)",
  [SupportedModels.OllamahfMinistral]:
    "Hugging Face Ministral 8B Instruct 2410 GGUF (Local)",
  [SupportedModels.Ollamagemma2]: "Gemma 2 (Local)",
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
    model === SupportedModels.HuggingFaceLlama32
  );
}

export type SDKChoice =
  | "OpenAI"
  | "Anthropic"
  | "Google"
  | "Ollama"
  | "HuggingFace";

function chooseSDK(model: SupportedModels): SDKChoice {
  if (
    model === SupportedModels.OllamaCodeLlama ||
    model === SupportedModels.OllamaMistral ||
    model === SupportedModels.OllamaLlama32 ||
    model === SupportedModels.Ollamaqwq ||
    model === SupportedModels.OllamahfMinistral ||
    model === SupportedModels.Ollamagemma2
  ) {
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
  return (
    model === SupportedModels.OllamaCodeLlama ||
    model === SupportedModels.OllamaMistral ||
    model === SupportedModels.OllamaLlama32 ||
    model === SupportedModels.Ollamaqwq ||
    model === SupportedModels.OllamahfMinistral ||
    model === SupportedModels.Ollamagemma2
  );
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
  if (!isSupportedModel(selectedModel)) {
    return false;
  }

  // Allow local models without API check
  if (isLocalModel(selectedModel)) {
    return true;
  }
  // Allow local models without API keys
  if (
    selectedModel === SupportedModels.OllamaCodeLlama ||
    selectedModel === SupportedModels.OllamaMistral ||
    selectedModel === SupportedModels.OllamaLlama32 ||
    selectedModel === SupportedModels.Ollamaqwq ||
    selectedModel === SupportedModels.OllamahfMinistral ||
    selectedModel === SupportedModels.Ollamagemma2
  ) {
    return true;
  }
  if (
    agentMode === AgentMode.VisionEnhanced &&
    !hasVisionSupport(selectedModel)
  ) {
    return false;
  }
  if (isOpenAIModel(selectedModel) && !openAIKey) {
    return false;
  }
  if (isAnthropicModel(selectedModel) && !anthropicKey) {
    return false;
  }
  if (isGoogleModel(selectedModel) && !geminiKey) {
    return false;
  }
  if (isHuggingFaceModel(selectedModel) && !huggingFaceKey) {
    return false;
  }

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
  // If no API keys are present, default to local model
  if (!openAIKey && !anthropicKey && !geminiKey) {
    return SupportedModels.OllamaMistral;
  }
  if (openAIKey) {
    return SupportedModels.Gpt4Turbo;
  }
  if (anthropicKey) {
    return SupportedModels.Claude35Sonnet;
  }
  if (geminiKey) {
    return SupportedModels.Gemini15Pro;
  }
  if (huggingFaceKey) {
    return SupportedModels.HuggingFaceLlama32;
  }
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
    return data.models || [];
  } catch (error) {
    console.error("Error listing Ollama models:", error);
    return [];
  }
}

export const addNewOllamaModel = (modelName: string) => {
  // Vérifier si le modèle n'existe pas déjà
  if (!(modelName in SupportedModels)) {
    // Ajouter dynamiquement le nouveau modèle à l'enum et au DisplayName
    (SupportedModels as any)[modelName] = modelName;
    (DisplayName as any)[modelName] = `${modelName} (Local)`;
  }
};

// Ajouter un cache pour les modèles téléchargés
const downloadedModelsCache = new Set<string>();

export async function downloadOllamaModel(modelName: string): Promise<boolean> {
  try {
    const response = await fetch("http://localhost:11434/api/pull", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: modelName }),
    });

    if (!response.ok) {
      throw new Error(`Failed to download model ${modelName}`);
    }

    // La réponse est un stream d'événements
    const reader = response.body?.getReader();
    if (!reader) return false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // Vous pouvez traiter les événements de progression ici
      console.log("Download progress:", new TextDecoder().decode(value));
    }

    // Ajouter le nouveau modèle à la liste des modèles supportés
    addNewOllamaModel(modelName);
    // Ajouter au cache si le téléchargement réussit
    downloadedModelsCache.add(modelName);
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
    // Vider le cache
    downloadedModelsCache.clear();
    // Ajouter tous les modèles téléchargés au cache
    models.forEach((model) => {
      if (model.status === "downloaded") {
        downloadedModelsCache.add(model.name);
      }
    });
  } catch (error) {
    console.error("Error refreshing Ollama models cache:", error);
  }
};

export async function fetchResponseFromModelOllama(
  model: SupportedModels,
  params: CommonMessageCreateParams,
): Promise<Response> {
  console.log("fetchResponseFromModelOllama with params:", params);

  // Vérifier d'abord le cache
  if (!downloadedModelsCache.has(model)) {
    // Vérifier le statut du modèle seulement si pas dans le cache
    const models = await listOllamaModels();
    const modelInfo = models.find((m) => m.name === model);

    if (!modelInfo || modelInfo.status === "not_downloaded") {
      console.log(`Model ${model} not found, attempting to download...`);
      const downloaded = await downloadOllamaModel(model);
      if (!downloaded) {
        throw new Error(`Failed to download model ${model}`);
      }
    }
    // Ajouter au cache une fois téléchargé
    downloadedModelsCache.add(model);
  }

  const url = "http://localhost:11434/api/chat";
  const payload = {
    model: model,
    messages: [
      {
        role: "system",
        content: params.systemMessage,
      },
      {
        role: "user",
        content: params.prompt,
      },
    ],
    stream: false,
  };

  try {
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

    return {
      usage: {
        total_tokens: data.eval_count || 0,
        prompt_tokens: data.prompt_eval_count || 0,
        completion_tokens: 0,
      },
      rawResponse: data.message?.content || "",
    };
  } catch (error) {
    console.error("Ollama fetch error:", error);
    if (error instanceof Error) {
      throw new Error(`Failed to fetch from Ollama: ${error.message}`);
    } else {
      throw new Error("Failed to fetch from Ollama: Unknown error");
    }
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
  if (params.jsonMode && !rawResponse.startsWith("{")) {
    rawResponse = "{" + rawResponse;
  }
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
  return {
    usage: {
      completion_tokens:
        result.response.usageMetadata?.candidatesTokenCount ?? 0,
      prompt_tokens: result.response.usageMetadata?.promptTokenCount ?? 0,
      total_tokens: result.response.usageMetadata?.totalTokenCount ?? 0,
    },
    rawResponse: result.response.text(),
  };
}

export async function fetchResponseFromModel(
  model: SupportedModels,
  params: CommonMessageCreateParams,
): Promise<Response> {
  console.log("fetchResponseFromModel with model:", model);
  const sdk = chooseSDK(model);
  console.log("fetchResponseFromModel with sdk:", sdk);
  if (sdk === "OpenAI") {
    return await fetchResponseFromModelOpenAI(model, params);
  } else if (sdk === "Anthropic") {
    return await fetchResponseFromModelAnthropic(model, params);
  } else if (sdk === "Google") {
    return await fetchResponseFromModelGoogle(model, params);
  } else if (sdk === "Ollama") {
    return await fetchResponseFromModelOllama(model, params);
  } else if (sdk === "HuggingFace") {
    return await fetchResponseFromModelHuggingFace(model, params);
  } else {
    throw new Error("Unsupported model");
  }
}
