import {
  Link,
  Box,
  ChakraProvider,
  Heading,
  HStack,
  IconButton,
  Icon,
} from "@chakra-ui/react";
import { SettingsIcon } from "@chakra-ui/icons";
import { FaDiscord, FaGithub } from "react-icons/fa6";
import { useState } from "react";
import { useAppState } from "../state/store";
import SetAPIKey from "./settings/SetAPIKey";
import TaskUI from "./TaskUI";
import Settings from "./Settings";
import { downloadedModelsCache } from "../helpers/aiSdkUtils";

const App = () => {
  const { hasAPIKey, hasLocalModels } = useAppState((state) => ({
    hasAPIKey: !!(
      state.settings.anthropicKey ||
      state.settings.openAIKey ||
      state.settings.huggingFaceKey ||
      state.settings.geminiKey
    ),
    hasLocalModels:
      state.settings.selectedModel && downloadedModelsCache.size > 0,
  }));

  const [inSettingsView, setInSettingsView] = useState(false);

  return (
    <ChakraProvider>
      <Box display="flex" flexDirection="column" minH="100vh" w="100%">
        <Box flex="1" px={4} pt={4} pb={16}>
          <HStack mb={4} alignItems="center">
            <Heading as="h1" size="lg" flex={1}>
              Better-Fuji 🌋
            </Heading>
            {(hasAPIKey || hasLocalModels) && (
              <IconButton
                icon={<SettingsIcon />}
                onClick={() => setInSettingsView(true)}
                aria-label="open settings"
              />
            )}
          </HStack>
          <Box w="100%" h="100%">
            {hasAPIKey || hasLocalModels ? (
              inSettingsView ? (
                <Settings setInSettingsView={setInSettingsView} />
              ) : (
                <TaskUI />
              )
            ) : (
              <SetAPIKey asInitializerView />
            )}
          </Box>
        </Box>
        <Box
          px="8"
          pos="fixed"
          w="100%"
          bottom={0}
          height="60px" // Fixed height for footer
          zIndex={1}
          as="footer"
          backdropFilter="auto"
          backdropBlur="6px"
          backgroundColor="rgba(255, 255, 255, 0.8)"
          borderTop="1px solid"
          borderColor="gray.200"
        >
          <HStack
            columnGap="1.5rem"
            rowGap="0.5rem"
            fontSize="md"
            py="3"
            justify="center"
            shouldWrapChildren
            wrap="wrap"
          >
            <Link href="https://github.com/H1B0B0/fuji-web" isExternal>
              GitHub <Icon verticalAlign="text-bottom" as={FaGithub} />
            </Link>
          </HStack>
        </Box>
      </Box>
    </ChakraProvider>
  );
};

export default App;
