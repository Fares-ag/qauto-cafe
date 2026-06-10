import type {
  ApiErrorBody,
  LoginResponse,
  MenuCatalog,
  Order,
  CartLineInput,
  PayOrderResponse,
  QueueOrder,
  OrderStatus,
  Shift,
  DailySalesReport,
  ProductSalesReportRow,
  IngredientUsageReportRow,
} from '@qauto/shared-types';

export interface InventoryStockItem {
  ingredientId: string;
  name: string;
  code: string;
  isPackaging: boolean;
  available: string;
  uom: string;
}

export interface InventoryStockResponse {
  branchId: string;
  items: InventoryStockItem[];
}

export class ApiError extends Error {
  constructor(public readonly body: ApiErrorBody) {
    super(body.detail);
    this.name = 'ApiError';
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  getAccessToken?: () => string | null;
  getBranchId?: () => string | null;
}

export class ApiClient {
  constructor(private readonly options: ApiClientOptions) {}

  async pinLogin(terminalId: string, pin: string): Promise<LoginResponse> {
    return this.request<LoginResponse>('/auth/pin-login', {
      method: 'POST',
      body: JSON.stringify({ terminalId, pin }),
    });
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    return this.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async getBootstrap(): Promise<{ organization: { id: string; name: string; slug: string } | null; branch: { id: string; name: string; code: string } | null }> {
    return this.request('/public/bootstrap');
  }

  async getMe(): Promise<unknown> {
    return this.request('/auth/me');
  }

  async refreshSession(): Promise<LoginResponse> {
    return this.request<LoginResponse>('/auth/refresh', { method: 'POST' });
  }

  async getHealth(): Promise<unknown> {
    return this.request('/health');
  }

  async getMenuCatalog(branchId: string): Promise<MenuCatalog> {
    return this.request(`/menu/catalog?branchId=${encodeURIComponent(branchId)}`);
  }

  async createOrder(body: {
    branchId: string;
    terminalId?: string;
    shiftId?: string;
    lines?: CartLineInput[];
  }): Promise<Order> {
    return this.request<Order>('/orders', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async updateOrderLines(orderId: string, lines: CartLineInput[]): Promise<Order> {
    return this.request<Order>(`/orders/${orderId}/lines`, {
      method: 'PATCH',
      body: JSON.stringify({ lines }),
    });
  }

  async getOrder(orderId: string): Promise<Order> {
    return this.request<Order>(`/orders/${orderId}`);
  }

  async payOrder(
    orderId: string,
    body: { payments: Array<{ method: 'CASH' | 'CARD' | 'CORPORATE' | 'OTHER'; amount: string; reference?: string }>; idempotencyKey?: string },
  ): Promise<PayOrderResponse> {
    return this.request<PayOrderResponse>(`/orders/${orderId}/pay`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async voidOrder(orderId: string, reason: string) {
    return this.request(`/orders/${orderId}/void`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async refundOrder(orderId: string, body: { reason: string; restockInventory?: boolean; idempotencyKey?: string }) {
    return this.request(`/orders/${orderId}/refund`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async listOrders(branchId: string, params?: { status?: string; limit?: number; offset?: number }) {
    const qs = new URLSearchParams({ branchId });
    if (params?.status) qs.set('status', params.status);
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.offset) qs.set('offset', String(params.offset));
    return this.request<{
      items: Array<{
        id: string;
        orderNumber: number;
        status: string;
        total: string;
        lineCount: number;
        createdByName: string;
        paidAt: string | null;
        createdAt: string;
      }>;
      total: number;
    }>(`/orders?${qs}`);
  }

  async getOrderQueue(branchId: string) {
    return this.request<QueueOrder[]>(
      `/orders/queue?branchId=${encodeURIComponent(branchId)}`,
    );
  }

  async updateOrderStatus(orderId: string, status: OrderStatus) {
    return this.request<QueueOrder>(`/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  async openShift(body: {
    branchId: string;
    terminalId?: string;
    openingFloat: string;
    notes?: string;
  }) {
    return this.request<Shift>('/shifts/open', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async getCurrentShift(branchId: string, terminalId?: string) {
    const params = new URLSearchParams({ branchId });
    if (terminalId) params.set('terminalId', terminalId);
    return this.request<Shift | null>(`/shifts/current?${params}`);
  }

  async closeShift(shiftId: string, body: { actualCash: string; notes?: string }) {
    return this.request<Shift>(`/shifts/${shiftId}/close`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async getShiftSummary(shiftId: string) {
    return this.request(`/shifts/${shiftId}/summary`);
  }

  async getMenuAdminItems(branchId: string) {
    return this.request<Array<{
      id: string;
      name: string;
      code: string;
      type: string;
      categoryName: string;
      basePrice: string;
      is86: boolean;
      isAvailable: boolean;
      approvedRecipeCount: number;
      imageUrl: string | null;
    }>>(`/menu/admin/items?branchId=${encodeURIComponent(branchId)}`);
  }

  async updateMenuItemAvailability(
    menuItemId: string,
    body: { branchId: string; is86?: boolean; isAvailable?: boolean },
  ) {
    return this.request(`/menu/admin/items/${menuItemId}/availability`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  async getRecipesAdmin(menuItemId?: string) {
    const qs = menuItemId ? `?menuItemId=${encodeURIComponent(menuItemId)}` : '';
    return this.request<Array<{
      id: string;
      menuItemName: string;
      sizeName: string | null;
      version: number;
      status: string;
      lineCount: number;
    }>>(`/recipes/admin${qs}`);
  }

  async approveRecipe(recipeId: string) {
    return this.request(`/recipes/${recipeId}/approve`, { method: 'POST' });
  }

  async getIngredients() {
    return this.request<Array<{ id: string; name: string; code: string; uom: string }>>('/inventory/ingredients');
  }

  async receiveStock(body: {
    branchId: string;
    ingredientId: string;
    quantity: string;
    unitCost: string;
    notes?: string;
  }) {
    return this.request('/inventory/receive', { method: 'POST', body: JSON.stringify(body) });
  }

  async wasteStock(body: {
    branchId: string;
    ingredientId: string;
    quantity: string;
    reason: string;
  }) {
    return this.request('/inventory/waste', { method: 'POST', body: JSON.stringify(body) });
  }

  async getStockMovements(branchId: string, limit = 30) {
    return this.request(`/inventory/movements?branchId=${encodeURIComponent(branchId)}&limit=${limit}`);
  }

  async getAuditLog(params: { branchId?: string; limit?: number; offset?: number }) {
    const qs = new URLSearchParams();
    if (params.branchId) qs.set('branchId', params.branchId);
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.offset) qs.set('offset', String(params.offset));
    return this.request<{
      items: Array<{
        id: string;
        action: string;
        entityType: string;
        entityId: string;
        userName: string | null;
        createdAt: string;
      }>;
      total: number;
    }>(`/audit?${qs}`);
  }

  async getEmployeeActivity(branchId: string, businessDate: string) {
    const params = new URLSearchParams({ branchId, businessDate });
    return this.request(`/reports/employee-activity?${params}`);
  }

  async listSuppliers() {
    return this.request<Array<{ id: string; name: string; code: string }>>('/suppliers');
  }

  async createSupplier(body: { name: string; code: string; contactName?: string; email?: string }) {
    return this.request('/suppliers', { method: 'POST', body: JSON.stringify(body) });
  }

  async listPurchaseOrders(branchId: string) {
    return this.request(`/purchase-orders?branchId=${encodeURIComponent(branchId)}`);
  }

  async createPurchaseOrder(body: {
    branchId: string;
    supplierId: string;
    notes?: string;
    lines: Array<{ ingredientId: string; quantityOrdered: string; unitCost: string }>;
  }) {
    return this.request('/purchase-orders', { method: 'POST', body: JSON.stringify(body) });
  }

  async sendPurchaseOrder(poId: string) {
    return this.request(`/purchase-orders/${poId}/send`, { method: 'POST' });
  }

  async receivePurchaseOrder(
    poId: string,
    body: { branchId: string; lines: Array<{ lineId: string; quantityReceived: string }> },
  ) {
    return this.request(`/purchase-orders/${poId}/receive`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async getDailySalesReport(branchId: string, businessDate: string) {
    const params = new URLSearchParams({ branchId, businessDate });
    return this.request<DailySalesReport>(`/reports/daily-sales?${params}`);
  }

  async getProductPerformance(branchId: string, businessDate: string) {
    const params = new URLSearchParams({ branchId, businessDate });
    return this.request<ProductSalesReportRow[]>(`/reports/product-performance?${params}`);
  }

  async getIngredientUsage(branchId: string, businessDate: string) {
    const params = new URLSearchParams({ branchId, businessDate });
    return this.request<IngredientUsageReportRow[]>(`/reports/ingredient-usage?${params}`);
  }

  async getInventoryStock(branchId: string) {
    return this.request<InventoryStockResponse>(
      `/inventory/stock?branchId=${encodeURIComponent(branchId)}`,
    );
  }

  async registerTerminal(body: {
    branchId: string;
    name: string;
    type: 'POS' | 'BAR_DISPLAY' | 'ADMIN';
    locationId?: string;
  }) {
    return this.request<{ terminalId: string; name: string; type: string }>('/terminals/register', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async listTerminals(branchId: string) {
    return this.request<Array<{ id: string; name: string; type: string; lastSeenAt: string | null }>>(
      `/terminals?branchId=${encodeURIComponent(branchId)}`,
    );
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set('Content-Type', 'application/json');

    const token = this.options.getAccessToken?.();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const branchId = this.options.getBranchId?.();
    if (branchId) {
      headers.set('X-Branch-Id', branchId);
    }

    const response = await fetch(`${this.options.baseUrl}${path}`, {
      ...init,
      headers,
      credentials: 'include',
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new ApiError({
        type: data.type ?? 'unknown',
        title: data.title ?? 'Error',
        status: response.status,
        detail: data.detail ?? 'Request failed',
        errors: data.errors,
      });
    }

    return data as T;
  }
}

export function createApiClient(baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1') {
  let accessToken: string | null = null;
  let branchId: string | null = null;

  const client = new ApiClient({
    baseUrl,
    getAccessToken: () => accessToken,
    getBranchId: () => branchId,
  });

  return {
    client,
    setAccessToken: (token: string | null) => {
      accessToken = token;
    },
    setBranchId: (id: string | null) => {
      branchId = id;
    },
  };
}
