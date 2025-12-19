import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Modal,
  Button,
  Stack,
  TextInput,
  Text,
  Checkbox,
  Group,
  Alert,
} from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { useLocation } from 'wouter';
import { toast } from 'sonner';
import { deleteAccount } from '../../api/user';
import { useAuthStore } from '../../stores/authStore';

interface DeleteAccountModalProps {
  opened: boolean;
  onClose: () => void;
  userEmail: string;
}

export function DeleteAccountModal({ opened, onClose, userEmail }: DeleteAccountModalProps) {
  const [, setLocation] = useLocation();
  const { logout } = useAuthStore();
  const [confirmEmail, setConfirmEmail] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; confirm?: string }>({});

  const deleteAccountMutation = useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => {
      toast.success('Account deleted successfully');
      // Clear auth state
      logout();
      // Clear local storage
      localStorage.clear();
      // Redirect to login
      setLocation('/login');
    },
    onError: (error: any) => {
      if (error.statusCode === 400) {
        if (error.message?.includes('Email does not match')) {
          setErrors({ email: 'Email does not match' });
        } else {
          setErrors({ confirm: error.message || 'Invalid input' });
        }
      } else {
        toast.error(error.message || 'Failed to delete account');
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validation
    if (!confirmEmail) {
      setErrors({ email: 'Email is required' });
      return;
    }

    if (confirmEmail.toLowerCase() !== userEmail.toLowerCase()) {
      setErrors({ email: 'Email does not match' });
      return;
    }

    if (!confirmed) {
      setErrors({ confirm: 'You must confirm that you understand this action cannot be undone' });
      return;
    }

    deleteAccountMutation.mutate({
      email: confirmEmail,
      confirm: true,
    });
  };

  const handleClose = () => {
    setConfirmEmail('');
    setConfirmed(false);
    setErrors({});
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="Delete Account"
      size="md"
      centered
    >
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <Alert
            icon={<IconAlertTriangle size={16} />}
            title="Warning"
            color="red"
          >
            This action cannot be undone. All your data will be permanently deleted.
          </Alert>

          <div>
            <Text size="sm" fw={500} className="mb-2">
              The following will be deleted:
            </Text>
            <ul className="list-disc list-inside text-sm text-gray-700 space-y-1 ml-2">
              <li>All watch history</li>
              <li>All schedules</li>
              <li>All queue items</li>
              <li>All library items</li>
              <li>All preferences</li>
              <li>Your account information</li>
            </ul>
          </div>

          <TextInput
            label="Type your email to confirm"
            placeholder={userEmail}
            value={confirmEmail}
            onChange={(e) => {
              setConfirmEmail(e.target.value);
              setErrors({ ...errors, email: undefined });
            }}
            error={errors.email}
            required
            type="email"
          />

          <Checkbox
            label="I understand this action cannot be undone"
            checked={confirmed}
            onChange={(e) => {
              setConfirmed(e.currentTarget.checked);
              setErrors({ ...errors, confirm: undefined });
            }}
            error={errors.confirm}
            color="red"
          />

          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              color="red"
              loading={deleteAccountMutation.isPending}
              disabled={!confirmEmail || !confirmed || confirmEmail.toLowerCase() !== userEmail.toLowerCase()}
            >
              Delete Account
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

