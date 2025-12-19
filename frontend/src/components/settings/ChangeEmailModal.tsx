import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Modal,
  Button,
  Stack,
  TextInput,
  Text,
  PasswordInput,
  Group,
} from '@mantine/core';
import { toast } from 'sonner';
import { changeEmail } from '../../api/user';
import { useAuthStore } from '../../stores/authStore';

interface ChangeEmailModalProps {
  opened: boolean;
  onClose: () => void;
  currentEmail: string;
}

export function ChangeEmailModal({ opened, onClose, currentEmail }: ChangeEmailModalProps) {
  const queryClient = useQueryClient();
  const { setUser } = useAuthStore();
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ new_email?: string; password?: string }>({});

  const changeEmailMutation = useMutation({
    mutationFn: changeEmail,
    onSuccess: (data) => {
      // Update auth store with new user data
      setUser(data.user);
      // Invalidate user query to refetch
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      toast.success('Email updated successfully');
      onClose();
      // Reset form
      setNewEmail('');
      setPassword('');
      setErrors({});
    },
    onError: (error: any) => {
      if (error.statusCode === 401) {
        setErrors({ password: 'Incorrect password' });
      } else if (error.statusCode === 409) {
        setErrors({ new_email: 'Email already in use' });
      } else if (error.statusCode === 400) {
        if (error.message?.includes('email')) {
          setErrors({ new_email: error.message });
        } else {
          setErrors({ password: error.message || 'Invalid input' });
        }
      } else {
        toast.error(error.message || 'Failed to update email');
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validation
    if (!newEmail) {
      setErrors({ new_email: 'New email is required' });
      return;
    }

    if (!password) {
      setErrors({ password: 'Password is required' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      setErrors({ new_email: 'Invalid email format' });
      return;
    }

    if (newEmail.toLowerCase() === currentEmail.toLowerCase()) {
      setErrors({ new_email: 'New email must be different from current email' });
      return;
    }

    changeEmailMutation.mutate({
      new_email: newEmail,
      password,
    });
  };

  const handleClose = () => {
    setNewEmail('');
    setPassword('');
    setErrors({});
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="Change Email"
      size="md"
    >
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <div>
            <Text size="sm" c="dimmed" className="mb-2">
              Current Email
            </Text>
            <TextInput value={currentEmail} disabled />
          </div>

          <TextInput
            label="New Email"
            placeholder="Enter new email address"
            value={newEmail}
            onChange={(e) => {
              setNewEmail(e.target.value);
              setErrors({ ...errors, new_email: undefined });
            }}
            error={errors.new_email}
            required
            type="email"
          />

          <PasswordInput
            label="Current Password"
            placeholder="Enter your current password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setErrors({ ...errors, password: undefined });
            }}
            error={errors.password}
            required
          />

          <Text size="xs" c="dimmed">
            You'll need to enter your current password to confirm this change.
          </Text>

          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={changeEmailMutation.isPending}
              disabled={!newEmail || !password}
            >
              Update Email
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

