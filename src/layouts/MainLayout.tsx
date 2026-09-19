import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarDays,
  Bell,
  Settings,
  Shield,
  User,
  LogOut,
  Menu,
  X,
  ListChecks,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useVault } from '../lib/VaultContext';

const navItems = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Today', path: '/today', icon: ListChecks },
  { name: 'Upcoming Events', path: '/upcoming', icon: CalendarDays },
  { name: 'Notifications', path: '/notifications', icon: Bell },
  { name: 'Private Vault', path: '/vault', icon: Shield },
  { name: 'Settings', path: '/settings', icon: Settings },
  { name: 'Profile', path: '/profile', icon: User },
];

const mobileNavItems = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Today', path: '/today', icon: ListChecks },
  { name: 'Events', path: '/upcoming', icon: CalendarDays },
  { name: 'Vault', path: '/vault', icon: Shield },
];

export default function MainLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { lockVault } = useVault();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    const confirmLogout = window.confirm('Are you sure you want to log out?');
    if (!confirmLogout) return;

    lockVault();
    await supabase.auth.signOut();
    navigate('/');
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-5 flex items-center space-x-3">
        <div className="w-9 h-9 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md shadow-primary-500/20">
          ✓
        </div>
        <span className="font-bold text-primary-900 text-lg tracking-tight">TO-DO LIST</span>
      </div>

      <div className="flex-1 px-3 space-y-0.5 overflow-y-auto pb-4">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            onClick={() => setIsMobileMenuOpen(false)}
            className={({ isActive }) =>
              `flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-primary-500/15 text-primary-700 shadow-sm'
                  : 'text-gray-600 hover:bg-white/50 hover:text-primary-700'
              }`
            }
          >
            <item.icon className="w-[1.15rem] h-[1.15rem]" />
            <span>{item.name}</span>
          </NavLink>
        ))}
      </div>

      <div className="p-3 border-t border-white/30 flex flex-col gap-2">
        <button
          onClick={handleSignOut}
          className="flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all w-full"
        >
          <LogOut className="w-[1.15rem] h-[1.15rem]" />
          <span>Sign Out</span>
        </button>
        <div className="text-center mt-2 pb-1">
          <p className="text-[0.65rem] text-gray-400 font-medium tracking-wide">
            © 2026 All rights reserved
          </p>
          <p className="text-[0.6rem] text-primary-500/80 font-semibold uppercase mt-0.5 tracking-wider">
            Developed by VIGNESH
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex w-64 flex-col glass-card-solid h-full shrink-0 border-r-0" style={{ borderRadius: 0, borderRight: '1px solid rgba(255,255,255,0.3)' }}>
        <SidebarContent />
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex animate-fade-in">
          <div className="fixed inset-0 bg-purple-950/40 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="relative w-72 h-full bg-white shadow-2xl flex flex-col animate-fade-in-up" style={{ borderRadius: 0 }}>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="absolute top-4 right-4 p-2 text-gray-500 hover:bg-white/60 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="glass-card-solid h-14 flex items-center justify-between px-4 md:px-6 z-10 shrink-0" style={{ borderRadius: 0, borderBottom: '1px solid rgba(255,255,255,0.3)' }}>
          <div className="flex items-center">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 -ml-2 text-primary-700 hover:bg-white/50 rounded-lg mr-2 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="font-semibold text-primary-800 md:hidden text-sm">To-Do List</h2>
          </div>

          <div className="flex items-center space-x-1">
            <NavLink
              to="/notifications"
              className="p-2 text-primary-600 hover:bg-white/50 rounded-full transition-colors relative"
            >
              <Bell className="w-5 h-5" />
            </NavLink>
            <NavLink
              to="/settings"
              className="p-2 text-primary-600 hover:bg-white/50 rounded-full transition-colors"
            >
              <Settings className="w-5 h-5" />
            </NavLink>
            <NavLink
              to="/profile"
              className="p-2 text-primary-600 hover:bg-white/50 rounded-full transition-colors"
            >
              <User className="w-5 h-5" />
            </NavLink>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-5xl mx-auto">
            <Outlet />
          </div>
        </main>

        {/* Mobile Bottom Navigation */}
        <nav className="md:hidden glass-card-solid h-16 flex items-center justify-around px-2 shrink-0 pb-safe" style={{ borderRadius: 0, borderTop: '1px solid rgba(255,255,255,0.3)' }}>
          {mobileNavItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center w-full h-full space-y-0.5 text-[0.65rem] transition-colors ${
                  isActive ? 'text-primary-600' : 'text-gray-500'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.name}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
