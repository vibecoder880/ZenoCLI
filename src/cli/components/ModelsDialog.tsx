import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { ModelRegistry } from "../../providers/model-registry.js";
import { updateConfig, type ZenoConfig } from "../../storage/config.js";

interface ModelsDialogProps {
  onClose: () => void;
  onSelect: (model: string) => void;
}

/**
 * Model picker (opencode DialogManageModels style).
 * Lists registry models grouped by tier; ↑/↓ navigate, Enter selects (writes
 * config.default.model), Esc closes.
 */
export function ModelsDialog({ onClose, onSelect }: ModelsDialogProps): React.JSX.Element {
  const [registry] = useState(() => new ModelRegistry());
  const models = registry.getAll();
  const tiers = ["premium", "standard", "economy"] as const;
  const [selected, setSelected] = useState(0);

  // Flatten models into the tier order for a linear selected index.
  const flat = tiers.flatMap((tier) => models.filter((model) => model.tier === tier));

  useInput((_input, key) => {
    if (key.upArrow) {
      setSelected((current) => (current === 0 ? flat.length - 1 : current - 1));
    } else if (key.downArrow) {
      setSelected((current) => (current === flat.length - 1 ? 0 : current + 1));
    } else if (key.return) {
      onSelect(flat[selected].id);
    } else if (key.escape) {
      onClose();
    }
  });

  let flatIndex = 0;
  return (
    <Box borderStyle="round" paddingX={1} flexDirection="column" marginTop={1}>
      <Text bold>Select model (↑/↓ Enter Esc)</Text>
      {tiers.map((tier) => {
        const inTier = models.filter((model) => model.tier === tier);
        if (inTier.length === 0) return null;
        return (
          <Box key={tier} flexDirection="column" marginBottom={1}>
            <Text dimColor bold>{tier}</Text>
            {inTier.map((model) => {
              const isSelected = flatIndex === selected;
              flatIndex += 1;
              return (
                <Text key={model.id} inverse={isSelected}>
                  {"  "}
                  {model.id.padEnd(34)} q{model.qualityScore.toFixed(1)} ${model.pricing.inputPerMillion.toFixed(2)}/1M
                </Text>
              );
            })}
          </Box>
        );
      })}
    </Box>
  );
}

/** Set the active model in config and return the new config. */
export function setActiveModel(modelId: string): ZenoConfig {
  return updateConfig((config) => ({
    ...config,
    default: { ...config.default, model: modelId, provider: modelId.split("/")[0] ?? config.default.provider },
  }));
}