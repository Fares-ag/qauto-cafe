import type {
  ApiErrorBody,
  LoginResponse,
  MenuCatalog,
  Order,
  CartLineInput,
  PayOrderResponse,
  QueueOrder,
  OrderStatus,
  OrderType,
  Shift,
  ShiftSummary,
  DailySalesReport,
  DashboardAnalytics,
  ArAgingReport,
  LoyaltySummaryReport,
  ProductSalesReportRow,
  IngredientUsageReportRow,
  UnpaidOrdersReport,
  PnlAnalyticsReport,
  CorporateBillingReport,
  DepartmentStatementReport,
  StockMovementRow,
} from '@qauto/shared-types';

export interface InventoryStockItem {
  ingredientId: string;
  name: string;
  code: string;
  isPackaging: boolean;
  available: string;
  uom: string;
  uomId?: string;
  purchaseUom?: string | null;
  purchaseUomId?: string | null;
  reorderPoint?: string | null;
  parLevel?: string | null;
  valueOnHandQar?: string;
  isLow?: boolean;
}

export interface InventoryStockResponse {
  branchId: string;
  totalValueQar?: string;
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
  /** Called on 401 (except /auth/*). Return true to retry the request once. */
  onUnauthorized?: () => Promise<boolean>;
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

  async getBootstrap(): Promise<{
    organization: { id: string; name: string; slug: string } | null;
    branch: { id: string; name: string; code: string } | null;
    terminals: Array<{ id: string; name: string; type: string }>;
  }> {
    return this.request('/public/bootstrap');
  }

  async getMe(): Promise<unknown> {
    return this.request('/auth/me');
  }

  async refreshSession(): Promise<LoginResponse> {
    return this.request<LoginResponse>('/auth/refresh', { method: 'POST' });
  }

  async logoutSession(): Promise<void> {
    await this.request('/auth/logout', { method: 'POST' });
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
    orderType?: OrderType;
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

  async addOrderLine(orderId: string, line: CartLineInput): Promise<Order> {
    return this.request<Order>(`/orders/${orderId}/lines`, {
      method: 'POST',
      body: JSON.stringify(line),
    });
  }

  async updateOrderLineQuantity(orderId: string, lineId: string, quantity: number): Promise<Order> {
    return this.request<Order>(`/orders/${orderId}/lines/${lineId}`, {
      method: 'PATCH',
      body: JSON.stringify({ quantity }),
    });
  }

  async removeOrderLine(orderId: string, lineId: string): Promise<Order> {
    return this.request<Order>(`/orders/${orderId}/lines/${lineId}`, {
      method: 'DELETE',
    });
  }

  async clearOrderLines(orderId: string): Promise<Order> {
    return this.request<Order>(`/orders/${orderId}/lines`, {
      method: 'DELETE',
    });
  }

  async applyOrderDiscount(
    orderId: string,
    body: {
      scope: 'ORDER' | 'LINE';
      type: 'PERCENTAGE' | 'FIXED_AMOUNT';
      value: string;
      orderLineId?: string;
      reason?: string;
    },
  ): Promise<Order> {
    return this.request<Order>(`/orders/${orderId}/discounts`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async clearOrderDiscount(orderId: string): Promise<Order> {
    return this.request<Order>(`/orders/${orderId}/discounts`, {
      method: 'DELETE',
    });
  }

  async listOrderDiscounts(orderId: string) {
    return this.request(`/orders/${orderId}/discounts`);
  }

  async removeOrderDiscount(orderId: string, discountId: string) {
    return this.request(`/orders/${orderId}/discounts/${discountId}`, { method: 'DELETE' });
  }

  async getOrder(orderId: string): Promise<Order> {
    return this.request<Order>(`/orders/${orderId}`);
  }

  async payOrder(
    orderId: string,
    body: {
      payments: Array<{ method: 'CASH' | 'CARD' | 'CORPORATE' | 'OTHER'; amount: string; reference?: string }>;
      idempotencyKey?: string;
      loyaltyPointsRedeem?: number;
      rewardId?: string;
      giftCardCode?: string;
    },
  ): Promise<PayOrderResponse> {
    return this.request<PayOrderResponse>(`/orders/${orderId}/pay`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async deferOrder(orderId: string) {
    return this.request<{
      order: {
        id: string;
        orderNumber: number;
        status: string;
        total: string;
        cogsTotal: string;
        deferredAt?: string;
        customerName?: string | null;
        customerDepartment?: string | null;
        guestName?: string | null;
        billingParty?: 'INDIVIDUAL' | 'DEPARTMENT';
      };
    }>(`/orders/${orderId}/defer`, { method: 'POST' });
  }

  async updateOrderCustomer(
    orderId: string,
    body: {
      customerName?: string;
      customerDepartment?: string;
      customerId?: string | null;
      guestName?: string;
      billingParty?: 'INDIVIDUAL' | 'DEPARTMENT';
      paymentDueDate?: string;
    },
  ): Promise<{
    id: string;
    customerName: string | null;
    customerDepartment: string | null;
    customerId: string | null;
    guestName: string | null;
    billingParty: 'INDIVIDUAL' | 'DEPARTMENT';
    paymentDueDate: string | null;
  }> {
    return this.request(`/orders/${orderId}/customer`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  async collectPayment(
    orderId: string,
    body: { payments: Array<{ method: 'CASH' | 'CARD' | 'CORPORATE' | 'OTHER'; amount: string; reference?: string }>; idempotencyKey?: string },
  ): Promise<PayOrderResponse> {
    return this.payOrder(orderId, body);
  }

  async voidOrder(orderId: string, reason: string) {
    return this.request(`/orders/${orderId}/void`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async refundOrder(
    orderId: string,
    body: { reason: string; restockInventory?: boolean; idempotencyKey?: string; lineIds?: string[] },
  ) {
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
        customerName: string | null;
        customerDepartment: string | null;
        deferredAt: string | null;
        paymentDueDate: string | null;
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

  async listShifts(branchId: string, limit = 20) {
    return this.request<Shift[]>(
      `/shifts?branchId=${encodeURIComponent(branchId)}&limit=${limit}`,
    );
  }

  async closeShift(shiftId: string, body: { actualCash: string; notes?: string }) {
    return this.request<Shift>(`/shifts/${shiftId}/close`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async getShiftSummary(shiftId: string) {
    return this.request<ShiftSummary>(`/shifts/${shiftId}/summary`);
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
      menuItemId: string;
      menuItemName: string;
      sizeId: string | null;
      sizeName: string | null;
      version: number;
      status: string;
      lineCount: number;
      lines: Array<{
        id: string;
        ingredientId: string;
        ingredientName: string;
        quantity: string;
        uom: string;
        isOptional: boolean;
      }>;
    }>>(`/recipes/admin${qs}`);
  }

  async approveRecipe(recipeId: string) {
    return this.request(`/recipes/${recipeId}/approve`, { method: 'POST' });
  }

  async getIngredients() {
    return this.request<
      Array<{
        id: string;
        name: string;
        code: string;
        uom: string;
        uomId: string;
        purchaseUom?: string | null;
        purchaseUomId?: string | null;
        reorderPoint?: string | null;
        trackStock?: boolean;
      }>
    >('/inventory/ingredients');
  }

  async listUoms() {
    return this.request<Array<{ id: string; code: string; name: string; symbol: string }>>(
      '/inventory/uoms',
    );
  }

  async receiveStock(body: {
    branchId: string;
    ingredientId: string;
    quantity: string;
    unitCost: string;
    inputUomId?: string;
    notes?: string;
  }) {
    return this.request('/inventory/receive', { method: 'POST', body: JSON.stringify(body) });
  }

  async wasteStock(body: {
    branchId: string;
    ingredientId: string;
    quantity: string;
    reason: string;
    inputUomId?: string;
  }) {
    return this.request('/inventory/waste', { method: 'POST', body: JSON.stringify(body) });
  }

  async adjustStock(body: {
    branchId: string;
    ingredientId: string;
    quantityDelta: string;
    reason: string;
    inputUomId?: string;
    unitCost?: string;
  }) {
    return this.request('/inventory/adjust', { method: 'POST', body: JSON.stringify(body) });
  }

  async getStockMovements(branchId: string, limit = 30) {
    return this.request<StockMovementRow[]>(
      `/inventory/movements?branchId=${encodeURIComponent(branchId)}&limit=${limit}`,
    );
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

  async listSuppliers(includeInactive = false) {
    const qs = includeInactive ? '?includeInactive=true' : '';
    return this.request<Array<{
      id: string;
      name: string;
      code: string;
      contactName?: string | null;
      email?: string | null;
      phone?: string | null;
      isActive?: boolean;
    }>>(`/suppliers${qs}`);
  }

  async createSupplier(body: { name: string; code: string; contactName?: string; email?: string; phone?: string }) {
    return this.request('/suppliers', { method: 'POST', body: JSON.stringify(body) });
  }

  async updateSupplier(
    supplierId: string,
    body: { name?: string; contactName?: string; email?: string; phone?: string; isActive?: boolean },
  ) {
    return this.request(`/suppliers/${supplierId}`, { method: 'PATCH', body: JSON.stringify(body) });
  }

  async deleteSupplier(supplierId: string) {
    return this.request(`/suppliers/${supplierId}`, { method: 'DELETE' });
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

  async cancelPurchaseOrder(poId: string) {
    return this.request(`/purchase-orders/${poId}/cancel`, { method: 'POST' });
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

  async getUnpaidOrdersReport(branchId: string) {
    return this.request<UnpaidOrdersReport>(
      `/reports/unpaid-orders?branchId=${encodeURIComponent(branchId)}`,
    );
  }

  async getDashboardAnalytics(branchId: string, businessDate: string, trendDays = 7) {
    const params = new URLSearchParams({ branchId, businessDate, trendDays: String(trendDays) });
    return this.request<DashboardAnalytics>(`/reports/dashboard?${params}`);
  }

  async getArAgingReport(branchId: string) {
    return this.request<ArAgingReport>(
      `/reports/ar-aging?branchId=${encodeURIComponent(branchId)}`,
    );
  }

  async getPnlAnalytics(branchId: string, from: string, to: string) {
    const params = new URLSearchParams({ branchId, from, to });
    return this.request<PnlAnalyticsReport>(`/reports/pnl?${params}`);
  }

  async getCorporateBillingReport(branchId: string, from: string, to: string) {
    const params = new URLSearchParams({ branchId, from, to });
    return this.request<CorporateBillingReport>(`/reports/corporate-billing?${params}`);
  }

  async getBillingDepartments(branchId: string) {
    return this.request<string[]>(
      `/reports/billing-departments?branchId=${encodeURIComponent(branchId)}`,
    );
  }

  async getDepartmentStatement(branchId: string, department: string, month: string) {
    const params = new URLSearchParams({ branchId, department, month });
    return this.request<DepartmentStatementReport>(`/reports/department-statement?${params}`);
  }

  async getSalesRangeReport(branchId: string, from: string, to: string) {
    const params = new URLSearchParams({ branchId, from, to });
    return this.request<
      Array<{
        businessDate: string;
        orderCount: number;
        grossSales: string;
        netSales: string;
        cogsTotal: string;
        discountTotal: string;
        taxTotal: string;
        refundTotal: string;
      }>
    >(`/reports/sales-range?${params}`);
  }

  async downloadDepartmentStatementCsv(branchId: string, department: string, month: string) {
    const params = new URLSearchParams({ branchId, department, month });
    const headers = new Headers();
    const token = this.options.getAccessToken?.();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const branchHeader = this.options.getBranchId?.();
    if (branchHeader) headers.set('X-Branch-Id', branchHeader);

    const response = await fetch(
      `${this.options.baseUrl}/reports/department-statement/export?${params}`,
      { headers, credentials: 'include' },
    );
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new ApiError({
        type: data.type ?? 'unknown',
        title: data.title ?? 'Error',
        status: response.status,
        detail: data.detail ?? 'Export failed',
      });
    }
    return response.text();
  }

  async getLoyaltySummary(branchId: string) {
    return this.request<LoyaltySummaryReport>(
      `/reports/loyalty-summary?branchId=${encodeURIComponent(branchId)}`,
    );
  }

  async searchCustomers(query: string) {
    return this.request<
      Array<{
        id: string;
        name: string;
        department: string | null;
        phoneExtension: string | null;
        email: string | null;
        phone: string | null;
        pointsBalance: number;
      }>
    >(`/customers?q=${encodeURIComponent(query)}`);
  }

  async getCustomerDirectory(query?: string) {
    const qs = query?.trim() ? `?q=${encodeURIComponent(query.trim())}` : '';
    return this.request<
      Array<{
        id: string;
        name: string;
        department: string | null;
        phoneExtension: string | null;
        position?: string | null;
        pointsBalance: number;
      }>
    >(`/customers/directory${qs}`);
  }

  async registerLookup(query?: string) {
    const qs = query?.trim() ? `?q=${encodeURIComponent(query.trim())}` : '';
    return this.request<
      Array<{
        id: string;
        name: string;
        department: string | null;
        phoneExtension: string | null;
        position?: string | null;
        pointsBalance: number;
      }>
    >(`/customers/register-lookup${qs}`);
  }

  async getCustomerDepartments() {
    return this.request<string[]>('/customers/departments');
  }

  async getLoyaltyRewards() {
    return this.request<Array<{ id: string; name: string; pointsCost: number }>>('/loyalty/rewards');
  }

  async getLoyaltyAccount(customerId: string) {
    return this.request<{ customerId: string; pointsBalance: number; lifetimePoints: number }>(
      `/loyalty/accounts/${customerId}`,
    );
  }

  async issueGiftCard(body: { amount: string; customerId?: string; expiresAt?: string }) {
    return this.request<{ id: string; code: string; balance: string }>('/gift-cards', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async getGiftCardBalance(code: string) {
    return this.request<{ code: string; balance: string; status: string }>(
      `/gift-cards/${encodeURIComponent(code)}/balance`,
    );
  }

  async getWasteAnalytics(branchId: string, businessDate: string) {
    const params = new URLSearchParams({ branchId, businessDate });
    return this.request<{
      branchId: string;
      businessDate: string;
      totalRecords: number;
      totalValue: string;
      byIngredient: Array<{
        ingredientId: string;
        ingredientName: string;
        quantityWasted: string;
        valueWasted: string;
        eventCount: number;
      }>;
      recent: Array<{
        id: string;
        ingredientName: string;
        quantity: string;
        reason: string;
        createdAt: string;
      }>;
    }>(`/reports/waste?${params}`);
  }

  async transferInventory(body: {
    fromBranchId: string;
    toBranchId: string;
    ingredientId: string;
    quantity: string;
    inputUomId?: string;
    notes?: string;
  }) {
    return this.request('/inventory/transfer', { method: 'POST', body: JSON.stringify(body) });
  }

  async getLowStock(branchId: string) {
    return this.request<{
      branchId: string;
      items: Array<{
        ingredientId: string;
        name: string;
        code: string;
        available: string;
        reorderPoint: string;
        uom: string;
      }>;
    }>(`/inventory/low-stock?branchId=${encodeURIComponent(branchId)}`);
  }

  async updatePurchaseOrder(
    poId: string,
    body: {
      notes?: string;
      lines?: Array<{ ingredientId: string; quantityOrdered: string; unitCost: string }>;
    },
  ) {
    return this.request(`/purchase-orders/${poId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  async createRecipe(body: {
    menuItemId: string;
    sizeId?: string;
    notes?: string;
    lines: Array<{ ingredientId: string; quantity: string; uomId?: string; isOptional?: boolean }>;
  }) {
    return this.request('/recipes/admin', { method: 'POST', body: JSON.stringify(body) });
  }

  async updateRecipeLines(
    recipeId: string,
    lines: Array<{ ingredientId: string; quantity: string; uomId?: string; isOptional?: boolean }>,
  ) {
    return this.request(`/recipes/${recipeId}/lines`, {
      method: 'PATCH',
      body: JSON.stringify({ lines }),
    });
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
    return this.request<Array<{ id: string; name: string; type: string; lastSeenAt: string | null; isActive?: boolean }>>(
      `/terminals?branchId=${encodeURIComponent(branchId)}`,
    );
  }

  async updateTerminal(terminalId: string, body: { name?: string; isActive?: boolean }) {
    return this.request(`/terminals/${terminalId}`, { method: 'PATCH', body: JSON.stringify(body) });
  }

  async listBranches() {
    return this.request<Array<{
      id: string;
      name: string;
      code: string;
      address: string | null;
      phone: string | null;
      isActive: boolean;
      businessDayCutoverHour: number;
    }>>('/branches');
  }

  async getBranch(branchId: string) {
    return this.request(`/branches/${branchId}`);
  }

  async createBranch(body: {
    name: string;
    code: string;
    address?: string;
    phone?: string;
    businessDayCutoverHour?: number;
  }) {
    return this.request('/branches', { method: 'POST', body: JSON.stringify(body) });
  }

  async updateBranch(
    branchId: string,
    body: {
      name?: string;
      address?: string;
      phone?: string;
      businessDayCutoverHour?: number;
      isActive?: boolean;
    },
  ) {
    return this.request(`/branches/${branchId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  async deleteBranch(branchId: string) {
    return this.request(`/branches/${branchId}`, { method: 'DELETE' });
  }

  async getBranchSettings(branchId: string) {
    return this.request<{ branchId: string; settings: Record<string, unknown> }>(
      `/branches/${branchId}/settings`,
    );
  }

  async upsertBranchSettings(branchId: string, body: { settings: Record<string, unknown> }) {
    return this.request(`/branches/${branchId}/settings`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  async listCustomers() {
    return this.request<Array<{
      id: string;
      name: string;
      email: string | null;
      employeeId: string | null;
      department: string | null;
      phoneExtension: string | null;
      isActive: boolean;
    }>>('/customers');
  }

  async getCustomer(customerId: string) {
    return this.request(`/customers/${customerId}`);
  }

  async createCustomer(body: {
    name: string;
    department?: string;
    employeeId?: string;
    email?: string;
    phone?: string;
    phoneExtension?: string;
    notes?: string;
  }) {
    return this.request('/customers', { method: 'POST', body: JSON.stringify(body) });
  }

  async updateCustomer(
    customerId: string,
    body: {
      name?: string;
      department?: string;
      employeeId?: string;
      email?: string;
      phone?: string;
      phoneExtension?: string;
      notes?: string;
      isActive?: boolean;
    },
  ) {
    return this.request(`/customers/${customerId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  async deleteCustomer(customerId: string) {
    return this.request(`/customers/${customerId}`, { method: 'DELETE' });
  }

  async listRoles() {
    return this.request<Array<{ id: string; slug: string; name: string }>>('/users/roles/list');
  }

  async listUsers() {
    return this.request<Array<{
      id: string;
      firstName: string;
      lastName: string;
      email: string | null;
      employeeNumber: string | null;
      status: string;
      role: { id: string; slug: string; name: string };
      branches: Array<{ branch: { id: string; name: string; code: string } }>;
    }>>('/users');
  }

  async getUser(userId: string) {
    return this.request(`/users/${userId}`);
  }

  async createUser(body: {
    firstName: string;
    lastName: string;
    email?: string;
    password?: string;
    pin: string;
    employeeNumber?: string;
    branchIds: string[];
  }) {
    return this.request('/users', { method: 'POST', body: JSON.stringify(body) });
  }

  async updateUser(
    userId: string,
    body: {
      firstName?: string;
      lastName?: string;
      email?: string;
      employeeNumber?: string;
      phone?: string;
      status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
    },
  ) {
    return this.request(`/users/${userId}`, { method: 'PATCH', body: JSON.stringify(body) });
  }

  async assignUserRole(userId: string, body: { roleId: string }) {
    return this.request(`/users/${userId}/role`, { method: 'PATCH', body: JSON.stringify(body) });
  }

  async setUserBranches(userId: string, body: { branchIds: string[]; defaultBranchId?: string }) {
    return this.request(`/users/${userId}/branches`, { method: 'PUT', body: JSON.stringify(body) });
  }

  async resetUserPin(userId: string, body: { pin: string }) {
    return this.request(`/users/${userId}/reset-pin`, { method: 'POST', body: JSON.stringify(body) });
  }

  async listIngredientCategories() {
    return this.request<Array<{ id: string; name: string; sortOrder: number; ingredientCount: number }>>(
      '/admin/ingredients/categories',
    );
  }

  async createIngredientCategory(body: { name: string; sortOrder?: number }) {
    return this.request('/admin/ingredients/categories', { method: 'POST', body: JSON.stringify(body) });
  }

  async updateIngredientCategory(categoryId: string, body: { name?: string; sortOrder?: number }) {
    return this.request(`/admin/ingredients/categories/${categoryId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  async deleteIngredientCategory(categoryId: string) {
    return this.request(`/admin/ingredients/categories/${categoryId}`, { method: 'DELETE' });
  }

  async listIngredientsAdmin() {
    return this.request<Array<{
      id: string;
      name: string;
      code: string;
      uom: string;
      reorderPoint: string | null;
      parLevel: string | null;
      isActive: boolean;
      trackStock: boolean;
      isPackaging: boolean;
      categoryName?: string | null;
      isSnackSku?: boolean;
    }>>('/admin/ingredients');
  }

  async createIngredient(body: {
    name: string;
    code: string;
    baseUomId?: string;
    baseUomCode?: string;
    categoryId?: string;
    reorderPoint?: string;
    parLevel?: string;
    trackStock?: boolean;
    isPackaging?: boolean;
  }) {
    return this.request('/admin/ingredients', { method: 'POST', body: JSON.stringify(body) });
  }

  async updateIngredient(
    ingredientId: string,
    body: {
      name?: string;
      categoryId?: string | null;
      reorderPoint?: string | null;
      parLevel?: string | null;
      isActive?: boolean;
    },
  ) {
    return this.request(`/admin/ingredients/${ingredientId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  async deleteIngredient(ingredientId: string) {
    return this.request(`/admin/ingredients/${ingredientId}`, { method: 'DELETE' });
  }

  async listMenuCategories() {
    return this.request<Array<{
      id: string;
      name: string;
      sortOrder: number;
      itemCount: number;
      isActive: boolean;
    }>>('/menu/admin/categories');
  }

  async createMenuCategory(body: { name: string; sortOrder?: number }) {
    return this.request('/menu/admin/categories', { method: 'POST', body: JSON.stringify(body) });
  }

  async updateMenuCategory(
    categoryId: string,
    body: { name?: string; sortOrder?: number; isActive?: boolean },
  ) {
    return this.request(`/menu/admin/categories/${categoryId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  async deleteMenuCategory(categoryId: string) {
    return this.request(`/menu/admin/categories/${categoryId}`, { method: 'DELETE' });
  }

  async createMenuItem(body: {
    categoryId: string;
    name: string;
    code: string;
    type: 'DRINK' | 'SNACK';
    basePrice: string;
    description?: string;
    imageUrl?: string;
  }) {
    return this.request('/menu/admin/items', { method: 'POST', body: JSON.stringify(body) });
  }

  async uploadMenuItemImage(file: File) {
    const form = new FormData();
    form.append('file', file);

    const headers = new Headers();
    const token = this.options.getAccessToken?.();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const branchHeader = this.options.getBranchId?.();
    if (branchHeader) headers.set('X-Branch-Id', branchHeader);

    const response = await fetch(`${this.options.baseUrl}/menu/admin/upload-image`, {
      method: 'POST',
      headers,
      body: form,
      credentials: 'include',
    });

    const text = await response.text().catch(() => '');
    let data: Record<string, unknown> = {};
    if (text) {
      try {
        data = JSON.parse(text) as Record<string, unknown>;
      } catch {
        data = {};
      }
    }

    if (!response.ok) {
      throw new ApiError({
        type: (data.type as string) ?? 'unknown',
        title: (data.title as string) ?? 'Error',
        status: response.status,
        detail: (typeof data.detail === 'string' && data.detail) || 'Image upload failed',
      });
    }

    return data as { url: string };
  }

  async updateMenuItem(
    menuItemId: string,
    body: {
      name?: string;
      basePrice?: string;
      categoryId?: string;
      description?: string;
      isActive?: boolean;
      imageUrl?: string;
    },
  ) {
    return this.request(`/menu/admin/items/${menuItemId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  async deleteMenuItem(menuItemId: string) {
    return this.request(`/menu/admin/items/${menuItemId}`, { method: 'DELETE' });
  }

  async setMenuItemPriceOverride(
    menuItemId: string,
    body: { branchId: string; priceOverride?: string | null },
  ) {
    return this.request(`/menu/admin/items/${menuItemId}/price-override`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  async listMenuItemSizes(menuItemId: string) {
    return this.request(`/menu/admin/items/${menuItemId}/sizes`);
  }

  async createMenuItemSize(
    menuItemId: string,
    body: { name: string; code: string; priceAdjustment?: string; isDefault?: boolean },
  ) {
    return this.request(`/menu/admin/items/${menuItemId}/sizes`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async updateMenuItemSize(
    menuItemId: string,
    sizeId: string,
    body: { name?: string; priceAdjustment?: string; isDefault?: boolean; isActive?: boolean },
  ) {
    return this.request(`/menu/admin/items/${menuItemId}/sizes/${sizeId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  async deleteMenuItemSize(menuItemId: string, sizeId: string) {
    return this.request(`/menu/admin/items/${menuItemId}/sizes/${sizeId}`, { method: 'DELETE' });
  }

  async listModifierGroups(options?: { includeModifiers?: boolean }) {
    const query = options?.includeModifiers ? '?includeModifiers=true' : '';
    return this.request<
      Array<{
        id: string;
        name: string;
        minSelections: number;
        maxSelections: number;
        isRequired: boolean;
        sortOrder?: number;
        modifierCount?: number;
        modifiers?: Array<{
          id: string;
          modifierGroupId: string;
          name: string;
          code: string;
          priceAdjustment: string;
          isActive: boolean;
          sortOrder: number;
        }>;
      }>
    >(`/menu/admin/modifier-groups${query}`);
  }

  async createModifierGroup(body: {
    name: string;
    minSelections?: number;
    maxSelections?: number;
    isRequired?: boolean;
  }) {
    return this.request('/menu/admin/modifier-groups', { method: 'POST', body: JSON.stringify(body) });
  }

  async updateModifierGroup(
    groupId: string,
    body: { name?: string; minSelections?: number; maxSelections?: number; isRequired?: boolean },
  ) {
    return this.request(`/menu/admin/modifier-groups/${groupId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  async deleteModifierGroup(groupId: string) {
    return this.request(`/menu/admin/modifier-groups/${groupId}`, { method: 'DELETE' });
  }

  async listModifiers(groupId: string) {
    return this.request<Array<{
      id: string;
      modifierGroupId: string;
      name: string;
      code: string;
      priceAdjustment: string;
      isActive: boolean;
      sortOrder: number;
    }>>(`/menu/admin/modifier-groups/${groupId}/modifiers`);
  }

  async createModifier(groupId: string, body: { name: string; code: string; priceAdjustment?: string }) {
    return this.request(`/menu/admin/modifier-groups/${groupId}/modifiers`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async updateModifier(
    groupId: string,
    modifierId: string,
    body: { name?: string; priceAdjustment?: string; isActive?: boolean },
  ) {
    return this.request(`/menu/admin/modifier-groups/${groupId}/modifiers/${modifierId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  async deleteModifier(groupId: string, modifierId: string) {
    return this.request(`/menu/admin/modifier-groups/${groupId}/modifiers/${modifierId}`, {
      method: 'DELETE',
    });
  }

  async linkMenuItemModifierGroup(menuItemId: string, body: { modifierGroupId: string; sortOrder?: number }) {
    return this.request(`/menu/admin/items/${menuItemId}/modifier-groups`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async unlinkMenuItemModifierGroup(menuItemId: string, groupId: string) {
    return this.request(`/menu/admin/items/${menuItemId}/modifier-groups/${groupId}`, { method: 'DELETE' });
  }

  /** Aliases used by menu builder UI */
  getMenuAdminCategories = () => this.listMenuCategories();
  getModifierGroups = (options?: { includeModifiers?: boolean }) =>
    this.listModifierGroups(options);

  private async request<T>(path: string, init: RequestInit = {}, retried = false): Promise<T> {
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

    let response: Response;
    try {
      response = await fetch(`${this.options.baseUrl}${path}`, {
        ...init,
        headers,
        credentials: 'include',
      });
    } catch {
      throw new ApiError({
        type: 'network-error',
        title: 'Network Error',
        status: 0,
        detail: 'Cannot reach the API. Ensure the API server is running.',
      });
    }

    const text = await response.text().catch(() => '');
    let data: Record<string, unknown> = {};
    if (text) {
      try {
        data = JSON.parse(text) as Record<string, unknown>;
      } catch {
        data = {};
      }
    }

    if (
      !response.ok &&
      response.status === 401 &&
      !retried &&
      this.options.onUnauthorized &&
      !path.startsWith('/auth/')
    ) {
      const refreshed = await this.options.onUnauthorized();
      if (refreshed) {
        return this.request<T>(path, init, true);
      }
    }

    if (!response.ok) {
      const status = response.status;
      const detail =
        (typeof data.detail === 'string' && data.detail) ||
        (status === 502 || status === 503
          ? 'API server unavailable. Start the API (port 3001) and try again.'
          : status >= 500
            ? 'Server error. Try again in a moment.'
            : `Request failed (${status})`);
      const errors = Array.isArray(data.errors)
        ? (data.errors as Array<{ field: string; message: string }>)
        : undefined;

      throw new ApiError({
        type: (data.type as string) ?? 'unknown',
        title: (data.title as string) ?? 'Error',
        status,
        detail,
        errors,
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
