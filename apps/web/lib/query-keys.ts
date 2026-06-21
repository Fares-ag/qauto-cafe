export const queryKeys = {
  menuCatalog: (branchId: string) => ['menu-catalog', branchId] as const,
  currentShift: (branchId: string, terminalId: string) =>
    ['current-shift', branchId, terminalId] as const,
  navBadges: (branchId: string) => ['nav-badges', branchId] as const,
  dashboard: (branchId: string, businessDate: string) =>
    ['dashboard', branchId, businessDate] as const,
  ordersList: (branchId: string, status?: string) =>
    ['orders-list', branchId, status ?? 'all'] as const,
  orderQueue: (branchId: string) => ['order-queue', branchId] as const,
};
