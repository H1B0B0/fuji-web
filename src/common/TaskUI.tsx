import {
  Box,
  Button,
  HStack,
  Input,
  IconButton,
  Text,
  VStack,
  useToast,
  Flex,
  Avatar,
  Alert,
  AlertIcon,
  AlertDescription,
  Spacer,
  useColorModeValue,
} from "@chakra-ui/react";
import { FaRobot } from "react-icons/fa";
import { useAppState } from "../state/store";
import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { debugMode } from "../constants";
import RunTaskButton from "./RunTaskButton";
import VoiceButton from "./VoiceButton";
import TaskStatus from "./TaskStatus";
import RecommendedTasks from "./RecommendedTasks";
import AutosizeTextarea from "./AutosizeTextarea";

const MessageContainer = motion(Box);

const formatConversationTitle = (prompt: string): string => {
  const cleanTitle = prompt
    .replace(/^The user requests the following task:\s*/i, "")
    .replace(/Current time:.*$/i, "")
    .replace(/fais moi des recherches? sur/i, "")
    .replace(
      /et écris moi le résultat de tes recherches sur un nouveau google docs/i,
      "",
    )
    .replace(/recherche/i, "")
    .replace(/^\s+|\s+$/g, "")
    .split("\n")[0];

  return cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);
};

const injectContentScript = async () => {
  const [tab] = await chrome.tabs.query({ currentWindow: true, active: true });
  if (!tab?.id) return;
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["src/pages/contentInjected/index.js"],
    world: "MAIN",
  });
};

function ActionExecutor() {
  const state = useAppState((state) => ({
    attachDebugger: state.currentTask.actions.attachDebugger,
    detachDegugger: state.currentTask.actions.detachDebugger,
    performActionString: state.currentTask.actions.performActionString,
    prepareLabels: state.currentTask.actions.prepareLabels,
    showImagePrompt: state.currentTask.actions.showImagePrompt,
  }));

  return (
    <Box mt={4}>
      <HStack spacing={2} py={3} borderTop="1px dashed" borderColor="gray.300">
        <Button onClick={state.attachDebugger}>Attach</Button>
        <Button onClick={state.prepareLabels}>Prepare</Button>
        <Button onClick={state.showImagePrompt}>Show Image</Button>
        <Button onClick={injectContentScript}>Inject</Button>
      </HStack>
    </Box>
  );
}

const TaskUI = () => {
  const state = useAppState((state) => ({
    history: state.currentTask.history,
    status: state.currentTask.status,
    runTask: state.currentTask.actions.runTask,
    instructions: state.ui.instructions,
    setInstructions: state.ui.actions.setInstructions,
    voiceMode: state.settings.voiceMode,
    isListening: state.currentTask.isListening,
    maxActions: state.currentTask.maxActions,
    setMaxActions: state.currentTask.actions.setMaxActions,
    interrupt: state.currentTask.actions.interrupt,
  }));

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  const toastError = useCallback(
    (message: string) => {
      toast({
        title: "Error",
        description: message,
        status: "error",
        duration: 5000,
      });
    },
    [toast],
  );

  const handleSubmit = () => {
    if (!state.instructions?.trim()) {
      toastError("Please enter instructions");
      return;
    }

    if (state.status === "running") {
      state.interrupt();
    } else {
      state.runTask(toastError);
    }
  };

  const runTaskWithNewInstructions = (newInstructions: string = "") => {
    if (!newInstructions) return;
    state.setInstructions(newInstructions);
    state.runTask(toastError);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [state.history]);

  const handleMaxActionsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "");
    state.setMaxActions(parseInt(value, 10) || 0);
  };

  const bgColor = useColorModeValue("gray.50", "gray.700");

  return (
    <VStack h="calc(100vh - 200px)" spacing={4} w="100%">
      <Box
        ref={chatContainerRef}
        flex="1"
        w="100%"
        overflowY="auto"
        borderRadius="xl"
        bg={bgColor}
        p={6}
        mb={20}
        sx={{
          "&::-webkit-scrollbar": {
            width: "4px",
          },
          "&::-webkit-scrollbar-track": {
            bg: "transparent",
          },
          "&::-webkit-scrollbar-thumb": {
            bg: useColorModeValue("gray.300", "gray.600"),
            borderRadius: "full",
          },
        }}
      >
        {state.history.length === 0 ? (
          <VStack spacing={6}>
            <Flex
              h="100%"
              direction="column"
              align="center"
              justify="center"
              color="gray.500"
              gap={4}
            >
              <Box
                p={6}
                borderRadius="full"
                bg={useColorModeValue("gray.100", "gray.700")}
              >
                <FaRobot size="48px" />
              </Box>
              <Text fontSize="lg" fontWeight="medium">
                Start a conversation by entering your instructions below
              </Text>
            </Flex>
            <RecommendedTasks runTask={runTaskWithNewInstructions} />
          </VStack>
        ) : (
          <VStack spacing={6} align="stretch">
            <Box mb={4} textAlign="center">
              <Text
                fontSize="xl"
                fontWeight="bold"
                color={useColorModeValue("gray.700", "gray.300")}
                pb={2}
              >
                {formatConversationTitle(state.history[0].prompt)}
              </Text>
              <Box
                borderBottom="2px"
                borderColor={useColorModeValue("gray.200", "gray.600")}
              />
            </Box>

            {state.history.map((entry, index) => (
              <MessageContainer
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
              >
                <HStack align="start">
                  <Avatar size="sm" icon={<FaRobot />} bg="purple.500" />
                  <MessageContainer
                    flex={1}
                    bg={useColorModeValue("blue.50", "blue.900")}
                    p={4}
                    borderRadius="lg"
                    borderWidth="1px"
                    borderColor={useColorModeValue("blue.200", "blue.700")}
                  >
                    <VStack align="stretch" spacing={3}>
                      <Box>
                        <Text fontWeight="bold" mb={2}>
                          Thought:
                        </Text>
                        <Text>{entry.action.thought}</Text>
                      </Box>
                    </VStack>
                  </MessageContainer>
                </HStack>
              </MessageContainer>
            ))}
          </VStack>
        )}
      </Box>

      <Box position="fixed" bottom="80px" left={0} right={0} px={4} zIndex={1}>
        <Box
          maxW="container.xl"
          mx="auto"
          bg={useColorModeValue("white", "gray.800")}
          borderRadius="xl"
          boxShadow="lg"
          p={4}
        >
          <VStack spacing={3}>
            <AutosizeTextarea
              autoFocus
              placeholder="What would you like me to do?"
              value={state.instructions || ""}
              onChange={(e) => state.setInstructions(e.target.value)}
              isDisabled={state.status === "running" || state.isListening}
              onKeyDown={handleKeyPress}
            />
            <HStack w="100%">
              <RunTaskButton
                runTask={handleSubmit}
                disabled={state.maxActions === 0}
              />
              {state.voiceMode && (
                <VoiceButton
                  taskInProgress={state.status === "running"}
                  onStopSpeaking={handleSubmit}
                />
              )}
              <Spacer />
              <Input
                type="number"
                value={state.maxActions}
                onChange={handleMaxActionsChange}
                placeholder="Max Actions"
                width="100px"
              />
            </HStack>
            {state.voiceMode && (
              <Alert status="info" borderRadius="lg">
                <AlertIcon />
                <AlertDescription fontSize="sm">
                  Press Space to start/stop speaking
                </AlertDescription>
              </Alert>
            )}
          </VStack>
          <TaskStatus />
          {debugMode && <ActionExecutor />}
        </Box>
      </Box>
    </VStack>
  );
};

export default TaskUI;
