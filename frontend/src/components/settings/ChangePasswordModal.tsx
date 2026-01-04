import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Modal,
  Button,
  Stack,
  PasswordInput,
  Text,
  Group,
  Progress,
} from '@mantine/core';
import { toast } from 'sonner';
import { changePassword } from '../../api/user';
import { ApiError } from '../../api/client';

interface ChangePasswordModalProps {
  opened: boolean;
  onClose: () => void;
}

function getPasswordStrength(password: string): { strength: number; label: string; color: string } {
  if (password.length === 0) {
    return { strength: 0, label: '', color: 'gray' };
  }
  if (password.length < 8) {
    return { strength: 25, label: 'Too short', color: 'red' };
  }

  let strength = 25; // Base strength for length >= 8
  let label = 'Weak';
  let color = 'red';

  // Check for
  if (/[A-Z]/.test(password)) strength += 25;
  // Check for lowercase
  if (/[a-z]/.test(password)) strength += 25;
  // Check for numbers
  if (/[0-9]/.test(password)) strength += 12.5;
  // Check for special characters
  if (/[^A-Za-z0-9]/.test(password)) strength += 12.5;

  if (strength >= 75) {
    label = 'Strong';
    color = 'green';
  } else if (strength >= 50) {
    label = 'Medium';
    color = 'yellow';
  }

  return { strength, label, color };
}

export function ChangePasswordModal({ opened, onClose }: ChangePasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<{
    current_password?: string;
    new_password?: string;
    confirm_password?: string;
  }>({});

  const passwordStrength = getPasswordStrength(newPassword);

  const changePasswordMutation = useMutation({
    mutationFn: changePassword,
    onSuccess: () => {
      toast.success('Password updated successfully');
      onClose();
      // Reset form
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setErrors({});
    },
    onError: (error: ApiError) => {
      if (error.statusCode === 401) {
        setErrors({ current_password: 'Incorrect current password' });
      } else if (error.statusCode === 400) {
        if (error.message?.includes('8 characters')) {
          setErrors({ new_password: error.message });
        } else {
          setErrors({ current_password: error.message || 'Invalid input' });
        }
      } else {
        toast.error(error.message || 'Failed to update password');
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validation
    if (!currentPassword) {
      setErrors({ current_password: 'Current password is required' });
      return;
    }

    if (!newPassword) {
      setErrors({ new_password: 'New password is required' });
      return;
    }

    if (newPassword.length < 8) {
      setErrors({ new_password: 'Password must be at least 8 characters' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrors({ confirm_password: 'Passwords do not match' });
      return;
    }

    if (currentPassword === newPassword) {
      setErrors({ new_password: 'New password must be different from current password' });
      return;
    }

    changePasswordMutation.mutate({
      current_password: currentPassword,
      new_password: newPassword,
    });
  };

  const handleClose = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setErrors({});
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="Change Password"
      size="md"
    >
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <PasswordInput
            label="Current Password"
            placeholder="Enter your current password"
            value={currentPassword}
            onChange={(e) => {
              setCurrentPassword(e.target.value);
              setErrors({ ...errors, current_password: undefined });
            }}
            error={errors.current_password}
            required
          />

          <div>
            <PasswordInput
              label="New Password"
              placeholder="Enter new password"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                setErrors({ ...errors, new_password: undefined });
              }}
              error={errors.new_password}
              required
            />
            {newPassword && (
              <div className="mt-2">
                <Progress
                  value={passwordStrength.strength}
                  color={passwordStrength.color}
                  size="sm"
                  className="mb-1"
                />
                <Text size="xs" c={passwordStrength.color}>
                  {passwordStrength.label}
                </Text>
              </div>
            )}
          </div>

          <PasswordInput
            label="Confirm New Password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setErrors({ ...errors, confirm_password: undefined });
            }}
            error={errors.confirm_password}
            required
          />

          <Text size="xs" c="dimmed">
            Password must be at least 8 characters long.
          </Text>

          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={changePasswordMutation.isPending}
              disabled={!currentPassword || !newPassword || !confirmPassword}
            >
              Update Password
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

