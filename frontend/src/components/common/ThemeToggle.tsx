import { Sun, Moon, Monitor } from 'lucide-react';
import { Button, Menu } from '@mantine/core';
import { useThemeStore } from '../../stores/themeStore';

export function ThemeToggle() {
  const { theme, setTheme } = useThemeStore();

  const icons = {
    light: <Sun size={18} />,
    dark: <Moon size={18} />,
    system: <Monitor size={18} />,
  };

  return (
    <Menu position="bottom-end" shadow="sm">
      <Menu.Target>
        <Button
          variant="subtle"
          size="sm"
          className="font-semibold text-sm"
          leftSection={icons[theme]}
        >
          Theme
        </Button>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Item
          leftSection={<Sun size={16} />}
          onClick={() => setTheme('light')}
          className={theme === 'light' ? 'bg-gray-100' : ''}
        >
          Light
        </Menu.Item>
        <Menu.Item
          leftSection={<Moon size={16} />}
          onClick={() => setTheme('dark')}
          className={theme === 'dark' ? 'bg-gray-100' : ''}
        >
          Dark
        </Menu.Item>
        <Menu.Item
          leftSection={<Monitor size={16} />}
          onClick={() => setTheme('system')}
          className={theme === 'system' ? 'bg-gray-100' : ''}
        >
          System
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
