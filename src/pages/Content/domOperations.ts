// The content script runs inside each page this extension is enabled on
// Do NOT import from here from outside of content script (other than types).

import getAnnotatedDOM, { getUniqueElementSelectorId } from "./getAnnotatedDOM";
import { copyToClipboard } from "./copyToClipboard";
import attachFile from "./attachFile";
import { drawLabels, removeLabels } from "./drawLabels";
import ripple from "./ripple";
import { getDataFromRenderedMarkdown } from "./reverseMarkdown";

export const rpcMethods = {
  getAnnotatedDOM,
  getUniqueElementSelectorId,
  ripple,
  copyToClipboard,
  attachFile,
  drawLabels,
  removeLabels,
  getDataFromRenderedMarkdown,
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
    (message: RPCMessage, sender, sendResponse): true | undefined => {
      const { method, payload } = message;
      if (method in rpcMethods) {
        // @ts-expect-error - we know this is valid (see pageRPC)
        const resp = rpcMethods[method as keyof RPCMethods](...payload);
        if (resp instanceof Promise) {
          resp.then((resolvedResp) => {
            sendResponse(resolvedResp);
          });
          return true;
        } else {
          sendResponse(resp);
        }
      }
    },
  );
};
