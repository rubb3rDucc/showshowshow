import { Link, useLocation } from 'wouter';
import { useAuthStore } from '../../stores/authStore';
import { Button } from "@mantine/core";

export function Navigation() {
  const [location] = useLocation();
  const { logout, user } = useAuthStore();

  const navItems = [
    { path: '/', label: 'Home' },
    { path: '/search', label: 'Search' },
    { path: '/queue', label: 'Queue' },
  ];

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

          {/* Nav Links */}
          <div className="flex items-center space-x-4">
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

          {/* User Menu */}
          <div className="flex items-center space-x-4">
            <Button
              onClick={logout}
              variant="gradient"
              gradient={{ from: 'violet', to: 'orange', deg: 90 }}
            >
              Logout
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}