import {
  AbsoluteCenter,
  Box,
  Button,
  Divider,
  Input,
  VStack,
  Text,
  Link,
  HStack,
  FormControl,
  FormLabel,
} from "@chakra-ui/react";
import React from "react";
import { useAppState } from "../../state/store";
import { SupportedModels } from "@root/src/helpers/aiSdkUtils";

type SetAPIKeyProps = {
  asInitializerView?: boolean;
  initialOpenAIKey?: string;
  initialAnthropicKey?: string;
  initialGeminiKey?: string;
  onClose?: () => void;
};

const SetAPIKey = ({
  asInitializerView = false,
  initialOpenAIKey = "",
  initialAnthropicKey = "",
  initialGeminiKey = "",
  onClose,
}: SetAPIKeyProps) => {
  const { updateSettings, initialOpenAIBaseUrl, initialAnthropicBaseUrl } =
    useAppState((state) => ({
      initialOpenAIBaseUrl: state.settings.openAIBaseUrl,
      initialAnthropicBaseUrl: state.settings.anthropicBaseUrl,
      updateSettings: state.settings.actions.update,
    }));

  const [openAIKey, setOpenAIKey] = React.useState(initialOpenAIKey || "");
  const [anthropicKey, setAnthropicKey] = React.useState(
    initialAnthropicKey || "",
  );
  const [geminiKey, setGeminiKey] = React.useState(initialGeminiKey || "");
  const [openAIBaseUrl, setOpenAIBaseUrl] = React.useState(
    initialOpenAIBaseUrl || "",
  );
  const [anthropicBaseUrl, setAnthropicBaseUrl] = React.useState(
    initialAnthropicBaseUrl || "",
  );

  const [showPassword, setShowPassword] = React.useState(false);

  const onSave = () => {
    updateSettings({
      openAIKey,
      openAIBaseUrl,
      anthropicKey,
      anthropicBaseUrl,
      geminiKey,
    });
    onClose && onClose();
  };

  return (
    <VStack spacing={4}>
      <Text fontSize="sm">
        You'll need an OpenAI, Anthropic, or Google API key to run Fuji, or you
        can continue with local models only.
      </Text>
      <Box position="relative" py="2" w="full">
        <Divider />
        <AbsoluteCenter bg="white" px="4">
          OpenAI
        </AbsoluteCenter>
      </Box>
      <FormControl>
        <FormLabel>OpenAI API Key</FormLabel>
        <HStack w="full">
          <Input
            placeholder="Enter OpenAI API Key"
            value={openAIKey}
            onChange={(event) => setOpenAIKey(event.target.value)}
            type={showPassword ? "text" : "password"}
          />
          {asInitializerView && (
            <Button
              onClick={() => setShowPassword(!showPassword)}
              variant="outline"
            >
              {showPassword ? "Hide" : "Show"}
            </Button>
          )}
        </HStack>
      </FormControl>
      {!asInitializerView && (
        <FormControl>
          <FormLabel>Base Url (optional)</FormLabel>
          <Input
            placeholder="Set Base Url"
            value={openAIBaseUrl}
            onChange={(event) => setOpenAIBaseUrl(event.target.value)}
            type="text"
          />
        </FormControl>
      )}

      <Box position="relative" py={2} w="full">
        <Divider />
        <AbsoluteCenter bg="white" px="4">
          Anthropic
        </AbsoluteCenter>
      </Box>
      <FormControl>
        <FormLabel>Anthropic API Key</FormLabel>
        <HStack w="full">
          <Input
            placeholder="Enter Anthropic API Key"
            value={anthropicKey}
            onChange={(event) => setAnthropicKey(event.target.value)}
            type={showPassword ? "text" : "password"}
          />
          {asInitializerView && (
            <Button
              onClick={() => setShowPassword(!showPassword)}
              variant="outline"
            >
              {showPassword ? "Hide" : "Show"}
            </Button>
          )}
        </HStack>
      </FormControl>
      {!asInitializerView && (
        <FormControl>
          <FormLabel>Base Url (optional)</FormLabel>
          <Input
            placeholder="Set Base Url"
            value={anthropicBaseUrl}
            onChange={(event) => setAnthropicBaseUrl(event.target.value)}
            type="text"
          />
        </FormControl>
      )}

      <Box position="relative" py={2} w="full">
        <Divider />
        <AbsoluteCenter bg="white" px="4">
          Gemini (Google)
        </AbsoluteCenter>
      </Box>
      <FormControl>
        <FormLabel>Gemini API Key</FormLabel>
        <HStack w="full">
          <Input
            placeholder="Enter Gemini API Key"
            value={geminiKey}
            onChange={(event) => setGeminiKey(event.target.value)}
            type={showPassword ? "text" : "password"}
          />
          {asInitializerView && (
            <Button
              onClick={() => setShowPassword(!showPassword)}
              variant="outline"
            >
              {showPassword ? "Hide" : "Show"}
            </Button>
          )}
        </HStack>
      </FormControl>

      <HStack w="full" spacing={4}>
        <Button
          onClick={onSave}
          w="full"
          isDisabled={!openAIKey && !anthropicKey && !geminiKey}
          colorScheme="blue"
        >
          Save API Keys
        </Button>
        <Button
          onClick={() => {
            updateSettings({
              selectedModel: SupportedModels.OllamaMistral,
            });
            onClose?.();
          }}
          w="full"
          variant="outline"
        >
          Continue with Local Models
        </Button>
      </HStack>
    </VStack>
  );
};

export default SetAPIKey;
