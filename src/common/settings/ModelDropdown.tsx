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
} from "@chakra-ui/react";
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
} from "../../helpers/aiSdkUtils";
import { enumValues } from "../../helpers/utils";
import { useState, useEffect } from "react";

const ModelDropdown = () => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [ollamaModels, setOllamaModels] = useState<OllamaModelInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [customModelFile, setCustomModelFile] = useState("");
  const [newModelName, setNewModelName] = useState("");

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
    await refreshOllamaModelsCache();
    const models = await listOllamaModels();
    setOllamaModels(models);
    setLoading(false);
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
    try {
      await downloadOllamaModel(newModelName);
      await refreshOllamaModels();
      // Ajouter le nouveau modèle à la liste des modèles supportés
      updateSettings({
        selectedModel: newModelName as SupportedModels,
      });
      setNewModelName("");
    } catch (error) {
      console.error("Error pulling new model:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <VStack spacing={4}>
        <Select
          id="model-select"
          value={selectedModel || ""}
          onChange={(e) =>
            updateSettings({ selectedModel: e.target.value as SupportedModels })
          }
        >
          {enumValues(SupportedModels).map((model) => (
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
              {DisplayName[model]}
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

              {/* Ajout du champ pour pull un nouveau modèle */}
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
              </VStack>

              <List spacing={2} width="100%">
                {ollamaModels.map((model) => (
                  <ListItem key={model.name}>
                    <Text>
                      {model.name} - {model.status}
                    </Text>
                    {model.status === "not_downloaded" && (
                      <Button
                        size="sm"
                        onClick={() => handleDownloadModel(model.name)}
                        isDisabled={loading}
                      >
                        Download
                      </Button>
                    )}
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
    </>
  );
};

export default ModelDropdown;
