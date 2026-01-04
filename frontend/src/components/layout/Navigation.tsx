import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useAuthStore } from '../../stores/authStore';
import { Button, Burger, Drawer, Stack, Divider } from "@mantine/core";
import { IconLogout } from '@tabler/icons-react';

export function Navigation() {
  const [location] = useLocation();
  const { logout } = useAuthStore();
  const [mobileMenuOpened, setMobileMenuOpened] = useState(false);

  const navItems = [
    { path: '/', label: 'Browse' },
    { path: '/library', label: 'Library' },
    { path: '/stats', label: 'Stats' },
    { path: '/lineup', label: 'Lineup' },
    { path: '/settings', label: 'Settings' },
  ];

  const handleNavClick = () => {
    setMobileMenuOpened(false);
  };

  const handleLogout = () => {
    setMobileMenuOpened(false);
    logout();
  };

  return (
    <nav className="bg-[rgb(var(--color-bg-surface))] shadow-sm border-b border-[rgb(var(--color-border-subtle))]">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo/Brand */}
          <div className="flex-shrink-0">
            <Link href="/">
              <span className="text-xl font-bold text-[rgb(var(--color-text-primary))] cursor-pointer">
                ShowShowShow
              </span>
            </Link>
          </div>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center space-x-4">
            {navItems.map((item) => (
              <Link key={item.path} href={item.path}>
                <span
                  className={`px-3 py-2 rounded-md text-sm font-semibold cursor-pointer ${
                    location === item.path
                      ? 'bg-[rgb(var(--color-accent))] text-white'
                      : 'text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-bg-elevated))]'
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            ))}
          </div>

          {/* Desktop User Menu */}
          <div className="hidden md:flex items-center space-x-4">
            <Button
              onClick={logout}
              variant='filled'
              className="font-semibold"
            >
              Logout
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <Burger
              opened={mobileMenuOpened}
              onClick={() => setMobileMenuOpened((o) => !o)}
              size="sm"
            />
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      <Drawer
        opened={mobileMenuOpened}
        onClose={() => setMobileMenuOpened(false)}
        title="Menu"
        position="right"
        size="xs"
      >
        <Stack gap="md">
          {navItems.map((item) => (
            <Link key={item.path} href={item.path} onClick={handleNavClick}>
              <div
                className={`px-4 py-3 rounded-md text-base font-semibold cursor-pointer transition-colors ${
                  location === item.path
                    ? 'bg-[rgb(var(--color-accent))] text-white'
                    : 'text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-bg-elevated))]'
                }`}
              >
                {item.label}
              </div>
            </Link>
          ))}

          <Divider />

          <Button
            onClick={handleLogout}
            variant='filled'
            fullWidth
            leftSection={<IconLogout size={16} />}
            className="font-semibold"
          >
            Logout
          </Button>
        </Stack>
      </Drawer>
    </nav>
  );
}