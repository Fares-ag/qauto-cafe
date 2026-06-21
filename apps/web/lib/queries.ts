import { useQuery } from '@tanstack/react-query';
import type { MenuCatalog, Shift } from '@qauto/shared-types';
import { getApiClient } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { ensureTerminal } from '@/lib/terminal';

const MENU_STALE_MS = 0;
const SHIFT_STALE_MS = 0;
const LIVE_POLL_MS = 5_000;

export function useMenuCatalog(branchId: string | null) {
  return useQuery({
    queryKey: queryKeys.menuCatalog(branchId ?? ''),
    queryFn: () => getApiClient().getMenuCatalog(branchId!),
    enabled: Boolean(branchId),
    staleTime: MENU_STALE_MS,
  });
}

export function usePosBootstrap(branchId: string | null) {
  return useQuery({
    queryKey: ['pos-bootstrap', branchId],
    queryFn: async (): Promise<{ terminalId: string; catalog: MenuCatalog; shift: Shift | null }> => {
      const client = getApiClient();
      const terminalId = await ensureTerminal(client, branchId!, 'POS');
      const [catalog, shift] = await Promise.all([
        client.getMenuCatalog(branchId!),
        client.getCurrentShift(branchId!, terminalId),
      ]);
      return { terminalId, catalog, shift };
    },
    enabled: Boolean(branchId),
    staleTime: SHIFT_STALE_MS,
    refetchInterval: LIVE_POLL_MS,
  });
}

export function useOrderQueue(branchId: string | null, refetchInterval = LIVE_POLL_MS) {
  return useQuery({
    queryKey: queryKeys.orderQueue(branchId ?? ''),
    queryFn: () => getApiClient().getOrderQueue(branchId!),
    enabled: Boolean(branchId),
    staleTime: 0,
    refetchInterval,
  });
}

export function useNavBadges(branchId: string | null) {
  return useQuery({
    queryKey: queryKeys.navBadges(branchId ?? ''),
    queryFn: async () => {
      const client = getApiClient();
      const [unpaid, queue] = await Promise.all([
        client.getUnpaidOrdersReport(branchId!),
        client.getOrderQueue(branchId!),
      ]);
      return {
        unpaidCount: unpaid.orderCount,
        kitchenCount: queue.filter((o) =>
          ['PENDING_PAYMENT', 'PAID', 'IN_PREP', 'READY'].includes(o.status),
        ).length,
      };
    },
    enabled: Boolean(branchId),
    staleTime: 0,
    refetchInterval: LIVE_POLL_MS,
  });
}

export function useDashboardData(branchId: string | null, businessDate: string) {
  return useQuery({
    queryKey: queryKeys.dashboard(branchId ?? '', businessDate),
    queryFn: async () => {
      const client = getApiClient();
      const [dashboardData, productData, queueData, lowStockData, unpaidData] = await Promise.all([
        client.getDashboardAnalytics(branchId!, businessDate, 7),
        client.getProductPerformance(branchId!, businessDate),
        client.getOrderQueue(branchId!),
        client.getLowStock(branchId!),
        client.getUnpaidOrdersReport(branchId!),
      ]);
      return {
        analytics: dashboardData,
        products: productData,
        queue: queueData,
        stock: lowStockData.items.map((i) => ({
          ingredientId: i.ingredientId,
          name: i.name,
          code: i.code,
          isPackaging: false,
          available: i.available,
          uom: i.uom,
        })),
        unpaidCount: unpaidData.orderCount,
        outstandingTotal: unpaidData.outstandingTotal,
      };
    },
    enabled: Boolean(branchId),
    staleTime: 0,
    refetchInterval: LIVE_POLL_MS,
  });
}

export function useOrdersList(branchId: string | null, statusFilter: string) {
  return useQuery({
    queryKey: queryKeys.ordersList(branchId ?? '', statusFilter || undefined),
    queryFn: () =>
      getApiClient().listOrders(branchId!, {
        status: statusFilter || undefined,
        limit: 50,
      }),
    enabled: Boolean(branchId),
    staleTime: 0,
    refetchInterval: LIVE_POLL_MS,
  });
}
