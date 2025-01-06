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
  Card,
  CardBody,
  keyframes,
  SlideFade,
  useColorModeValue,
  Container,
  Textarea,
  Tooltip,
} from "@chakra-ui/react";
import { ArrowUpIcon, CloseIcon, SmallCloseIcon } from "@chakra-ui/icons";
import { FaRobot } from "react-icons/fa";
import { useAppState } from "../state/store";
import { useState, useRef, useEffect } from "react";
import TaskStatus from "./TaskStatus";
import { motion } from "framer-motion";

// Animation pour les messages qui apparaissent
const slideIn = keyframes`
  from { transform: translateY(10px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
`;

// Composant animé pour les messages
const MessageContainer = motion(Box);

const formatConversationTitle = (prompt: string): string => {
  // Extract core content by removing system prefixes and timestamps
  const cleanTitle = prompt
    .replace(/^The user requests the following task:\s*/i, "")
    .replace(/Current time:.*$/i, "")
    .replace(/fais moi des recherches? sur/i, "")
    .replace(
      /et écris moi le résultat de tes recherches sur un nouveau google docs/i,
      "",
    )
    .replace(/recherche/i, "")
    .replace(/^\s+|\s+$/g, "") // Trim whitespace
    .split("\n")[0]; // Take first line only

  // Capitalize first letter
  return cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);
};

const TaskUI = () => {
  const [instructions, setInstructions] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  const { history, status, runTask, interrupt } = useAppState((state) => ({
    history: state.currentTask.history,
    status: state.currentTask.status,
    runTask: state.currentTask.actions.runTask,
    interrupt: state.currentTask.actions.interrupt,
  }));

  const handleSubmit = () => {
    if (!instructions.trim()) {
      toast({
        title: "Error",
        description: "Please enter instructions",
        status: "error",
        duration: 3000,
      });
      return;
    }

    if (status === "running") {
      interrupt();
    } else {
      runTask((error) =>
        toast({
          title: "Error",
          description: error,
          status: "error",
          duration: 5000,
        }),
      );
    }
  };

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [history]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleResize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
    setInstructions(e.target.value);
  };

  const bgColor = useColorModeValue("gray.50", "gray.700");
  const cardBg = useColorModeValue("white", "gray.600");
  const aiBg = useColorModeValue("blue.50", "blue.900");
  const borderColor = useColorModeValue("gray.200", "gray.600");

  return (
    <VStack h="calc(100vh - 200px)" spacing={4} w="100%">
      {/* Chat Container */}
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
        {history.length === 0 ? (
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
        ) : (
          <VStack spacing={6} align="stretch">
            {/* Conversation Title */}
            <Box mb={4} textAlign="center">
              <Text
                fontSize="xl"
                fontWeight="bold"
                color={useColorModeValue("gray.700", "gray.300")}
                pb={2}
              >
                {formatConversationTitle(history[0].prompt)}
              </Text>
              <Box
                borderBottom="2px"
                borderColor={useColorModeValue("gray.200", "gray.600")}
              />
            </Box>

            {history.map((entry, index) => (
              <MessageContainer
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
              >
                <HStack align="start">
                  <Avatar
                    size="sm"
                    icon={<FaRobot />}
                    bg="purple.500"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 260, damping: 20 }}
                  />
                  <MessageContainer
                    flex={1}
                    bg={useColorModeValue("blue.50", "blue.900")}
                    p={4}
                    borderRadius="lg"
                    borderWidth="1px"
                    borderColor={useColorModeValue("blue.200", "blue.700")}
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ duration: 0.2, delay: 0.1 }}
                    _hover={{ shadow: "md" }}
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

      {/* Input Area - Fixed to bottom with full width */}
      <Box position="fixed" bottom="80px" left={0} right={0} px={4} zIndex={1}>
        <Box
          maxW="container.xl"
          mx="auto"
          bg={useColorModeValue("white", "gray.800")}
          borderRadius="xl"
          boxShadow="lg"
          p={4}
        >
          <HStack spacing={3}>
            <Box flex={1} position="relative">
              <Input
                ref={inputRef}
                placeholder="What would you like me to do?"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                onKeyPress={handleKeyPress}
                size="lg"
                fontSize="sm"
                lineHeight="normal"
                bg={useColorModeValue("gray.50", "gray.700")}
                border="2px solid"
                borderColor={useColorModeValue("gray.200", "gray.600")}
                _focus={{
                  borderColor: "blue.400",
                  boxShadow: "0 0 0 1px var(--chakra-colors-blue-400)",
                }}
                pr={instructions ? "0.5rem" : "inherit"}
              />
            </Box>
            <Button
              colorScheme="blue"
              size="lg"
              px={8}
              isDisabled={!instructions.trim()}
              leftIcon={<ArrowUpIcon />}
              onClick={handleSubmit}
              _hover={{
                transform: "translateY(-2px)",
              }}
              transition="all 0.2s"
            >
              {status === "running" ? "Stop" : "Send"}
            </Button>
          </HStack>
          <TaskStatus />
        </Box>
      </Box>
    </VStack>
  );
};

export default TaskUI;
