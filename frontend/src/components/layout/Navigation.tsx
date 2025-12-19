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
    { path: '/', label: 'Home' },
    { path: '/search', label: 'Search' },
    { path: '/queue', label: 'Queue' },
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
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo/Brand */}
          <div className="flex-shrink-0">
            <Link href="/">
              <span className="text-xl font-bold text-gray-900 cursor-pointer">
                ShowShowShow
              </span>
            </Link>
          </div>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center space-x-4">
            {navItems.map((item) => (
              <Link key={item.path} href={item.path}>
                <span
                  className={`px-3 py-2 rounded-md text-sm font-medium cursor-pointer ${
                    location === item.path
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
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
              variant="gradient"
              gradient={{ from: 'violet', to: 'orange', deg: 90 }}
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
                className={`px-4 py-3 rounded-md text-base font-medium cursor-pointer transition-colors ${
                  location === item.path
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {item.label}
              </div>
            </Link>
          ))}
          
          <Divider />
          
          <Button
            onClick={handleLogout}
            variant="gradient"
            gradient={{ from: 'violet', to: 'orange', deg: 90 }}
            fullWidth
            leftSection={<IconLogout size={16} />}
          >
            Logout
          </Button>
        </Stack>
      </Drawer>
    </nav>
  );
}