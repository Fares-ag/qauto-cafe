import { useQuery } from '@tanstack/react-query';
import type { MenuCatalog, Shift } from '@qauto/shared-types';
import { getApiClient } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { ensureTerminal } from '@/lib/terminal';

/** Menu catalog changes infrequently — invalidate on stock errors or admin edits. */
const MENU_CATALOG_STALE_MS = 5 * 60_000;

/** Live operational data — kitchen needs faster updates than dashboard. */
const KITCHEN_POLL_MS = 3_000;
const OPS_POLL_MS = 15_000;
const DASHBOARD_POLL_MS = 60_000;
const ORDERS_POLL_MS = 20_000;
const SHIFT_POLL_MS = 30_000;
const BADGE_POLL_MS = 30_000;

const queueStatuses = new Set(['PENDING_PAYMENT', 'PAID', 'IN_PREP', 'READY']);

export function useMenuCatalog(branchId: string | null) {
  return useQuery({
    queryKey: queryKeys.menuCatalog(branchId ?? ''),
    queryFn: () => getApiClient().getMenuCatalog(branchId!),
    enabled: Boolean(branchId),
    staleTime: MENU_CATALOG_STALE_MS,
    refetchOnWindowFocus: false,
  });
}

export function usePosTerminal(branchId: string | null) {
  return useQuery({
    queryKey: ['pos-terminal', branchId],
    queryFn: () => ensureTerminal(getApiClient(), branchId!, 'POS'),
    enabled: Boolean(branchId),
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
  });
}

export function useCurrentShift(branchId: string | null, terminalId: string | null) {
  return useQuery({
    queryKey: queryKeys.currentShift(branchId ?? '', terminalId ?? ''),
    queryFn: () => getApiClient().getCurrentShift(branchId!, terminalId!),
    enabled: Boolean(branchId && terminalId),
    staleTime: 0,
    refetchInterval: SHIFT_POLL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
  });
}

export function usePosBootstrap(branchId: string | null) {
  const terminal = usePosTerminal(branchId);
  const catalog = useMenuCatalog(branchId);
  const shift = useCurrentShift(branchId, terminal.data ?? null);

  const isLoading =
    (terminal.isLoading && !terminal.data) ||
    (catalog.isLoading && catalog.data === undefined) ||
    (shift.isLoading && shift.data === undefined);

  const error = terminal.error ?? catalog.error ?? shift.error;

  const data =
    terminal.data && catalog.data !== undefined
      ? {
          terminalId: terminal.data,
          catalog: catalog.data as MenuCatalog,
          shift: (shift.data ?? null) as Shift | null,
        }
      : undefined;

  return { data, isLoading, error };
}

export function useOrderQueue(
  branchId: string | null,
  refetchInterval: number | false = OPS_POLL_MS,
) {
  return useQuery({
    queryKey: queryKeys.orderQueue(branchId ?? ''),
    queryFn: () => getApiClient().getOrderQueue(branchId!),
    enabled: Boolean(branchId),
    staleTime: 0,
    refetchInterval,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
  });
}

export function useUnpaidReport(
  branchId: string | null,
  refetchInterval: number | false = BADGE_POLL_MS,
) {
  return useQuery({
    queryKey: queryKeys.unpaidCount(branchId ?? ''),
    queryFn: () => getApiClient().getUnpaidOrdersReport(branchId!),
    enabled: Boolean(branchId),
    staleTime: 0,
    refetchInterval,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
  });
}

export function useUnpaidCount(
  branchId: string | null,
  refetchInterval: number | false = BADGE_POLL_MS,
) {
  const query = useUnpaidReport(branchId, refetchInterval);
  return {
    ...query,
    data: query.data?.orderCount ?? 0,
  };
}

export function useNavBadges(
  branchId: string | null,
  options?: { refetchInterval?: number | false; enabled?: boolean },
) {
  const enabled = options?.enabled ?? Boolean(branchId);
  const interval = options?.refetchInterval ?? BADGE_POLL_MS;

  const { data: queue = [] } = useOrderQueue(branchId, enabled ? interval : false);
  const { data: unpaidCount = 0 } = useUnpaidCount(branchId, enabled ? interval : false);

  return {
    data: {
      unpaidCount,
      kitchenCount: queue.filter((order) => queueStatuses.has(order.status)).length,
    },
  };
}

export function useDashboardData(branchId: string | null, businessDate: string) {
  return useQuery({
    queryKey: queryKeys.dashboard(branchId ?? '', businessDate),
    queryFn: async () => {
      const client = getApiClient();
      const [dashboardData, productData, lowStockData] = await Promise.all([
        client.getDashboardAnalytics(branchId!, businessDate, 7),
        client.getProductPerformance(branchId!, businessDate),
        client.getLowStock(branchId!),
      ]);
      return {
        analytics: dashboardData,
        products: productData,
        stock: lowStockData.items.map((i) => ({
          ingredientId: i.ingredientId,
          name: i.name,
          code: i.code,
          isPackaging: false,
          available: i.available,
          uom: i.uom,
        })),
      };
    },
    enabled: Boolean(branchId),
    staleTime: DASHBOARD_POLL_MS,
    refetchInterval: DASHBOARD_POLL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
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
    refetchInterval: ORDERS_POLL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
  });
}
