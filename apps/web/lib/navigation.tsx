'use client';

import type { NavGroup } from '@qauto/ui';
import {
  BarChart3,
  ClipboardList,
  Coffee,
  ChefHat,
  LayoutDashboard,
  Package,
  Settings,
  Shield,
  ShoppingCart,
  Truck,
  Users,
  Warehouse,
  Wheat,
} from 'lucide-react';
import type { SessionType } from './auth-store';

const ICON_SIZE = 18;

const STAFF_NAV: NavGroup[] = [
  {
    items: [
      { id: 'sell', label: 'Sell', href: '/sell', icon: <ShoppingCart size={ICON_SIZE} /> },
      { id: 'kitchen', label: 'Kitchen', href: '/kitchen', icon: <ChefHat size={ICON_SIZE} /> },
      { id: 'orders', label: 'Orders', href: '/orders', icon: <ClipboardList size={ICON_SIZE} /> },
      { id: 'shifts', label: 'Shifts', href: '/shifts', icon: <Coffee size={ICON_SIZE} /> },
    ],
  },
];

const MANAGER_NAV: NavGroup[] = [
  {
    label: 'Operations',
    items: [
      { id: 'sell', label: 'Sell', href: '/sell', icon: <ShoppingCart size={ICON_SIZE} /> },
      { id: 'kitchen', label: 'Kitchen', href: '/kitchen', icon: <ChefHat size={ICON_SIZE} /> },
      { id: 'orders', label: 'Orders', href: '/orders', icon: <ClipboardList size={ICON_SIZE} /> },
      { id: 'shifts', label: 'Shifts', href: '/shifts', icon: <Coffee size={ICON_SIZE} /> },
    ],
  },
  {
    label: 'Business',
    items: [
      { id: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard size={ICON_SIZE} /> },
      { id: 'reports', label: 'Reports', href: '/reports', icon: <BarChart3 size={ICON_SIZE} /> },
      { id: 'customers', label: 'Customers', href: '/customers', icon: <Users size={ICON_SIZE} /> },
    ],
  },
  {
    label: 'Inventory',
    items: [
      { id: 'inventory', label: 'Stock', href: '/inventory', icon: <Warehouse size={ICON_SIZE} /> },
      { id: 'ingredients', label: 'Ingredients', href: '/ingredients', icon: <Wheat size={ICON_SIZE} /> },
      { id: 'procurement', label: 'Procurement', href: '/procurement', icon: <Truck size={ICON_SIZE} /> },
    ],
  },
  {
    label: 'Admin',
    items: [
      { id: 'menu', label: 'Menu', href: '/menu', icon: <Package size={ICON_SIZE} /> },
      { id: 'users', label: 'Users', href: '/users', icon: <Users size={ICON_SIZE} /> },
      { id: 'audit', label: 'Audit log', href: '/audit', icon: <Shield size={ICON_SIZE} /> },
      { id: 'settings', label: 'Settings', href: '/settings', icon: <Settings size={ICON_SIZE} /> },
    ],
  },
];

export function getNavGroups(sessionType: SessionType | null): NavGroup[] {
  return sessionType === 'staff' ? STAFF_NAV : MANAGER_NAV;
}

export function getShellSubtitle(sessionType: SessionType | null): string {
  return sessionType === 'staff' ? 'Register' : 'Manager';
}

const ROLE_LABELS: Record<string, string> = {
  staff: 'Staff',
  owner: 'Owner',
  manager: 'Manager',
  admin: 'Admin',
};

export function getRoleLabel(role: string, sessionType: SessionType | null): string {
  if (sessionType === 'staff') return 'Staff';
  return ROLE_LABELS[role] ?? role.replaceAll('_', ' ');
}

export function applyNavBadges(groups: NavGroup[], badges: { orders?: number; kitchen?: number }): NavGroup[] {
  return groups.map((group) => ({
    ...group,
    items: group.items.map((item) => {
      if (item.id === 'orders' && badges.orders) return { ...item, badge: badges.orders };
      if (item.id === 'kitchen' && badges.kitchen) return { ...item, badge: badges.kitchen };
      return item;
    }),
  }));
}

export const CATEGORY_ICONS: Record<string, string> = {
  coffee: '☕',
  drinks: '🥤',
  tea: '🍵',
  pastry: '🥐',
  pastries: '🥐',
  food: '🥪',
  snacks: '🍪',
  default: '🍽️',
};

export function getCategoryIcon(name: string): string {
  const key = name.toLowerCase();
  for (const [pattern, icon] of Object.entries(CATEGORY_ICONS)) {
    if (key.includes(pattern)) return icon;
  }
  return CATEGORY_ICONS.default;
}
