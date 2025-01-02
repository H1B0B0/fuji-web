// The content script runs inside each page this extension is enabled on
// Do NOT import from here from outside of content script (other than types).

import getAnnotatedDOM, { getUniqueElementSelectorId } from "./getAnnotatedDOM";
import { copyToClipboard } from "./copyToClipboard";
import attachFile from "./attachFile";
import { drawLabels, removeLabels } from "./drawLabels";
import ripple from "./ripple";
import { getDataFromRenderedMarkdown } from "./reverseMarkdown";
import getViewportPercentage from "./getViewportPercentage";
import { injectMicrophonePermissionIframe } from "./permission";

function clickWithSelector(selector: string) {
  const element = document.querySelector(selector) as HTMLElement;
  // get center coordinates of the element
  const { x, y } = element.getBoundingClientRect();
  const centerX = x + element.offsetWidth / 2;
  const centerY = y + element.offsetHeight / 2;
  ripple(centerX, centerY);
  if (element) {
    element.click();
  }
}

export const rpcMethods = {
  clickWithSelector,
  getAnnotatedDOM,
  getUniqueElementSelectorId,
  ripple,
  copyToClipboard,
  attachFile,
  drawLabels,
  removeLabels,
  getDataFromRenderedMarkdown,
  getViewportPercentage,
  injectMicrophonePermissionIframe,
} as const;

export type RPCMethods = typeof rpcMethods;
type MethodName = keyof RPCMethods;

export type RPCMessage = {
  [K in MethodName]: {
    method: K;
    payload: Parameters<RPCMethods[K]>;
  };
}[MethodName];

// This function should run in the content script
export const initializeRPC = () => {
  chrome.runtime.onMessage.addListener(
    (message: RPCMessage | { type: string }, sender, sendResponse) => {
      if ("type" in message && message.type === "ping") {
        sendResponse("pong");
        return;
      }

      if ("method" in message) {
        const { method, payload } = message;
        console.log("RPC listener", method);
        if (method in rpcMethods) {
          const resp = rpcMethods[method as keyof RPCMethods](...payload);
          if (resp instanceof Promise) {
            resp.then(sendResponse).catch((e) => {
              console.error("RPC error:", e);
              sendResponse(null);
            });
            return true;
          }
          sendResponse(resp);
        }
      }
    },
  );
};
