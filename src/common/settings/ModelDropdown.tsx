import React from "react";
import {
  Select,
  Button,
  VStack,
  Input,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  Text,
  List,
  ListItem,
  Spinner,
  HStack,
  Box,
  Progress,
  useToast,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  AlertDialogCloseButton,
  IconButton,
} from "@chakra-ui/react";
import { DeleteIcon } from "@chakra-ui/icons";
import { useAppState } from "../../state/store";
import {
  SupportedModels,
  DisplayName,
  isValidModelSettings,
  listOllamaModels,
  downloadOllamaModel,
  createCustomOllamaModel,
  type OllamaModelInfo,
  refreshOllamaModelsCache,
  addNewOllamaModel,
  deleteOllamaModel,
  downloadedModelsCache,
} from "../../helpers/aiSdkUtils";
import { enumValues } from "../../helpers/utils";
import { useState, useEffect } from "react";

const ModelDropdown = () => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [ollamaModels, setOllamaModels] = useState<OllamaModelInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [customModelFile, setCustomModelFile] = useState("");
  const [newModelName, setNewModelName] = useState("");
  const [downloadProgress, setDownloadProgress] = useState<{
    [key: string]: number;
  }>({});
  const [modelToDelete, setModelToDelete] = useState<string | null>(null);
  const cancelRef = React.useRef<HTMLButtonElement | null>(null);
  const toast = useToast();

  const { selectedModel, agentMode, updateSettings } = useAppState((state) => ({
    selectedModel: state.settings.selectedModel,
    agentMode: state.settings.agentMode,
    updateSettings: state.settings.actions.update,
  }));

  const { openAIKey, anthropicKey, geminiKey, huggingFaceKey } = useAppState(
    (state) => ({
      openAIKey: state.settings.openAIKey,
      anthropicKey: state.settings.anthropicKey,
      geminiKey: state.settings.geminiKey,
      huggingFaceKey: state.settings.huggingFaceKey,
    }),
  );

  const refreshOllamaModels = async () => {
    setLoading(true);
    try {
      await refreshOllamaModelsCache(); // Appeler d'abord le refresh du cache
      const models = await listOllamaModels();
      setOllamaModels(models);

      // Log pour debug
      console.log(
        "Downloaded models cache:",
        Array.from(downloadedModelsCache),
      );
      console.log("Ollama models:", models);
    } catch (error) {
      console.error("Error refreshing models:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshOllamaModels();
  }, []);

  const handleDownloadModel = async (modelName: string) => {
    setLoading(true);
    await downloadOllamaModel(modelName);
    await refreshOllamaModels();
    setLoading(false);
  };

  const handleCreateCustomModel = async () => {
    if (!customModelFile) return;
    setLoading(true);
    await createCustomOllamaModel(customModelFile);
    await refreshOllamaModels();
    setLoading(false);
    setCustomModelFile("");
  };

  const handlePullNewModel = async () => {
    if (!newModelName) return;
    setLoading(true);
    setDownloadProgress({ ...downloadProgress, [newModelName]: 0 });

    try {
      await downloadOllamaModel(newModelName, (progress) => {
        setDownloadProgress((prev) => ({
          ...prev,
          [newModelName]: Math.round(progress),
        }));
      });

      await refreshOllamaModelsCache();
      updateSettings({
        selectedModel: newModelName as SupportedModels,
      });
      setNewModelName("");
      setDownloadProgress((prev) => {
        const newProgress = { ...prev };
        delete newProgress[newModelName];
        return newProgress;
      });
    } catch (error) {
      console.error("Error pulling new model:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteModel = async (modelName: string) => {
    try {
      setLoading(true);
      const success = await deleteOllamaModel(modelName);
      if (success) {
        toast({
          title: "Model deleted",
          description: `Successfully deleted model ${modelName}`,
          status: "success",
          duration: 3000,
        });
        await refreshOllamaModels();
      } else {
        throw new Error("Failed to delete model");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to delete model ${modelName}`,
        status: "error",
        duration: 3000,
      });
    } finally {
      setLoading(false);
      setModelToDelete(null);
    }
  };

  // Modifier la logique des modèles disponibles
  const availableModels = React.useMemo(() => {
    const defaultModels = enumValues(SupportedModels);
    const localModels = Array.from(downloadedModelsCache);

    console.log("Processing available models:");
    console.log("- Default models:", defaultModels);
    console.log("- Local models:", localModels);

    // Créer un Map pour stocker les modèles uniques avec leur source
    const modelMap = new Map<string, string>();

    // Ajouter d'abord les modèles par défaut
    defaultModels.forEach((model) => modelMap.set(model, "default"));

    // Ajouter ensuite les modèles locaux
    localModels.forEach((model) => modelMap.set(model, "local"));

    // Convertir le Map en tableau
    return Array.from(modelMap.keys());
  }, [downloadedModelsCache]);

  const renderModelOption = (model: string) => {
    if (downloadedModelsCache.has(model)) {
      return `${model} (Local)`;
    }
    return DisplayName[model as SupportedModels] || model;
  };

  return (
    <>
      <VStack spacing={4} width="100%">
        <Select
          id="model-select"
          value={selectedModel || ""}
          onChange={(e) => {
            const newModel = e.target.value;
            console.log("Selecting model:", newModel);
            updateSettings({ selectedModel: newModel });
          }}
          width="100%"
        >
          <option value="">Select a model</option>
          {availableModels.map((model) => (
            <option
              key={model}
              value={model}
              disabled={
                !isValidModelSettings(
                  model,
                  agentMode,
                  openAIKey,
                  anthropicKey,
                  geminiKey,
                  huggingFaceKey,
                )
              }
            >
              {renderModelOption(model)}
            </option>
          ))}
        </Select>

        <Button onClick={onOpen} size="sm">
          Manage Local Models
        </Button>
      </VStack>

      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Manage Local Models</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4} pb={4}>
              <Button onClick={refreshOllamaModels} isDisabled={loading}>
                Refresh Model List
              </Button>

              {loading && <Spinner />}

              <VStack w="100%" spacing={2}>
                <Text fontWeight="bold">Pull New Model</Text>
                <HStack w="100%">
                  <Input
                    placeholder="Enter model name (e.g., llama2:latest)"
                    value={newModelName}
                    onChange={(e) => setNewModelName(e.target.value)}
                  />
                  <Button
                    onClick={handlePullNewModel}
                    isDisabled={!newModelName || loading}
                  >
                    Pull
                  </Button>
                </HStack>
                {downloadProgress[newModelName] > 0 && (
                  <Box w="100%">
                    <Text>Downloading: {downloadProgress[newModelName]}%</Text>
                    <Progress
                      value={downloadProgress[newModelName]}
                      size="sm"
                      colorScheme="blue"
                    />
                  </Box>
                )}
              </VStack>

              <List spacing={2} width="100%">
                {ollamaModels.map((model) => (
                  <ListItem key={model.name}>
                    <HStack justify="space-between">
                      <Text>
                        {model.name} - {model.status}
                      </Text>
                      <HStack>
                        {model.status === "not_downloaded" ? (
                          <Button
                            size="sm"
                            onClick={() => handleDownloadModel(model.name)}
                            isDisabled={loading}
                          >
                            Download
                          </Button>
                        ) : (
                          <IconButton
                            aria-label="Delete model"
                            icon={<DeleteIcon />}
                            size="sm"
                            colorScheme="red"
                            onClick={() => setModelToDelete(model.name)}
                            isDisabled={loading}
                          />
                        )}
                      </HStack>
                    </HStack>
                  </ListItem>
                ))}
              </List>

              <Text fontWeight="bold" mt={4}>
                Add Custom Model
              </Text>
              <Input
                placeholder="Enter Modelfile content"
                value={customModelFile}
                onChange={(e) => setCustomModelFile(e.target.value)}
              />
              <Button
                onClick={handleCreateCustomModel}
                isDisabled={!customModelFile || loading}
              >
                Create Custom Model
              </Button>
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>

      <AlertDialog
        isOpen={!!modelToDelete}
        leastDestructiveRef={cancelRef}
        onClose={() => setModelToDelete(null)}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader>Delete Model</AlertDialogHeader>
            <AlertDialogCloseButton />
            <AlertDialogBody>
              Are you sure you want to delete {modelToDelete}? This action
              cannot be undone.
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={() => setModelToDelete(null)}>
                Cancel
              </Button>
              <Button
                colorScheme="red"
                onClick={() =>
                  modelToDelete && handleDeleteModel(modelToDelete)
                }
                ml={3}
              >
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </>
  );
};

export default ModelDropdown;
