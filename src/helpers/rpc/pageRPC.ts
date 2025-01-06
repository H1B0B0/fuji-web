import { sleep } from "../utils";
import type { RPCMethods } from "../../pages/content/domOperations";

// Call these functions to execute code in the content script

let contentScriptStatus: { [tabId: number]: boolean } = {};

async function checkContentScriptConnection(tabId: number): Promise<boolean> {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "status_check" });
    return true;
  } catch (e) {
    return false;
  }
}

async function ensureContentScriptInjected(tabId: number): Promise<void> {
  const INJECTION_TIMEOUT = 3000; // Increased timeout
  const MAX_INJECTION_ATTEMPTS = 3;

  for (let attempt = 1; attempt <= MAX_INJECTION_ATTEMPTS; attempt++) {
    try {
      // Check if already connected
      if (contentScriptStatus[tabId]) {
        const isConnected = await checkContentScriptConnection(tabId);
        if (isConnected) return;
      }

      console.log(`Injection attempt ${attempt}/${MAX_INJECTION_ATTEMPTS}`);

      // Remove old script if exists
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          func: () => {
            window.location.reload();
          },
        });
        await sleep(1000); // Wait for reload
      } catch (e) {
        console.log("Clean reload failed, continuing...");
      }

      // Inject new script
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["src/pages/contentInjected/index.js"],
      });

      await sleep(INJECTION_TIMEOUT);

      // Verify injection
      await chrome.tabs.sendMessage(tabId, { type: "ping" });

      contentScriptStatus[tabId] = true;
      return;
    } catch (error) {
      console.error(`Injection attempt ${attempt} failed:`, error);
      if (attempt === MAX_INJECTION_ATTEMPTS) {
        throw new Error(
          `Content script injection failed after ${MAX_INJECTION_ATTEMPTS} attempts`,
        );
      }
      await sleep(1000 * attempt); // Exponential backoff
    }
  }
}

export const callRPCWithTab = async <K extends keyof RPCMethods>(
  tabId: number,
  method: K,
  payload: Parameters<RPCMethods[K]>,
  maxTries = 3,
): Promise<ReturnType<RPCMethods[K]>> => {
  const OPERATION_TIMEOUT = 8000; // Increased timeout
  let lastError: any;

  for (let i = 0; i < maxTries; i++) {
    try {
      console.log(`RPC attempt ${i + 1}/${maxTries} for ${method}`);

      // Ensure content script is ready
      await ensureContentScriptInjected(tabId);

      // Send message with timeout
      const response = await Promise.race([
        sendMessage(tabId, method, payload),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error(`RPC timeout after ${OPERATION_TIMEOUT}ms`)),
            OPERATION_TIMEOUT,
          ),
        ),
      ]);

      return response;
    } catch (error) {
      console.error(`RPC attempt ${i + 1} failed:`, error);
      lastError = error;

      // Reset connection state on error
      contentScriptStatus[tabId] = false;

      if (i < maxTries - 1) {
        const backoffTime = Math.pow(2, i) * 1000;
        console.log(`Retrying in ${backoffTime}ms...`);
        await sleep(backoffTime);
      }
    }
  }

  throw new Error(`Failed after ${maxTries} attempts: ${lastError?.message}`);
};

function sendMessage<K extends keyof RPCMethods>(
  tabId: number,
  method: K,
  payload: Parameters<RPCMethods[K]>,
): Promise<ReturnType<RPCMethods[K]>> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Message timeout for method ${method}`));
    }, 5000);

    try {
      chrome.tabs.sendMessage(tabId, { method, payload }, (response) => {
        clearTimeout(timeout);
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    } catch (e) {
      clearTimeout(timeout);
      reject(e);
    }
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
