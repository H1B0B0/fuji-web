import { sleep } from "../utils";
import type { RPCMethods } from "../../pages/content/domOperations";

// Call these functions to execute code in the content script

function sendMessage<K extends keyof RPCMethods>(
  tabId: number,
  method: K,
  payload: Parameters<RPCMethods[K]>,
): Promise<ReturnType<RPCMethods[K]>> {
  // Send a message to the other world
  // Ensure that the method and arguments are correct according to RpcMethods
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, { method, payload }, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(response);
      }
    });
  });
}

export const callRPC = async <K extends keyof RPCMethods>(
  method: K,
  payload: Parameters<RPCMethods[K]>,
  maxTries = 1,
): Promise<ReturnType<RPCMethods[K]>> => {
  let queryOptions = { active: true, currentWindow: true };
  let activeTab = (await chrome.tabs.query(queryOptions))[0];

  // If the active tab is a chrome-extension:// page, then we need to get some random other tab for testing
  if (activeTab.url?.startsWith("chrome")) {
    queryOptions = { active: false, currentWindow: true };
    activeTab = (await chrome.tabs.query(queryOptions))[0];
  }

  if (!activeTab?.id) throw new Error("No active tab found");
  return callRPCWithTab(activeTab.id, method, payload, maxTries);
};

export const callRPCWithTab = async <K extends keyof RPCMethods>(
  tabId: number,
  method: K,
  payload: Parameters<RPCMethods[K]>,
  maxTries = 3, // Augmenter le nombre d'essais
): Promise<ReturnType<RPCMethods[K]>> => {
  let err: any;
  for (let i = 0; i < maxTries; i++) {
    try {
      console.log(`Attempt ${i + 1}/${maxTries} to call RPC method ${method}`);

      // Vérifier si le content script est injecté
      await ensureContentScriptInjected(tabId);

      const response = await sendMessage(tabId, method, payload);
      return response;
    } catch (e) {
      console.error(`RPC attempt ${i + 1} failed:`, e);
      err = e;
      if (i < maxTries - 1) {
        // Attendre plus longtemps entre chaque essai
        await sleep((i + 1) * 1000);
      }
    }
  }
  throw err;
};

// Fonction pour s'assurer que le content script est injecté
async function ensureContentScriptInjected(tabId: number) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "ping" });
  } catch (e) {
    console.log("Content script not found, injecting...");
    await chrome.runtime.sendMessage({
      action: "injectFunctions",
      tabId,
    });
    // Attendre que le script soit injecté
    await sleep(500);
  }
}
