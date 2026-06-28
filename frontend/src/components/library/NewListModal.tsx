import { useState } from 'react';
import { Modal, TextInput, Textarea, Switch, Button, Group, Stack } from '@mantine/core';

interface NewListModalProps {
  opened: boolean;
  onClose: () => void;
  onCreate: (name: string, ranked: boolean, description?: string) => void;
}

export function NewListModal({ opened, onClose, onCreate }: NewListModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ranked, setRanked] = useState(false);

  const submit = () => {
    if (!name.trim()) return;
    onCreate(name.trim(), ranked, description.trim() || undefined);
    setName('');
    setDescription('');
    setRanked(false);
    onClose();
  };

  return (
    <Modal opened={opened} onClose={onClose} title="New list" centered>
      <Stack gap="md">
        <TextInput
          label="Name"
          placeholder="e.g. Comfort shows"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          data-autofocus
        />
        <Textarea
          label="Description"
          placeholder="Optional — what's this list about?"
          value={description}
          onChange={(e) => setDescription(e.currentTarget.value)}
          autosize
          minRows={2}
          maxRows={4}
        />
        <Switch
          label="Ranked list"
          description="Show numbers and let you drag to reorder"
          checked={ranked}
          onChange={(e) => setRanked(e.currentTarget.checked)}
        />
        <Group justify="flex-end" gap="sm">
          <Button variant="subtle" color="gray" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!name.trim()}>
            Create
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
