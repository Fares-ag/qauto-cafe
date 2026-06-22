-- Kitchen queue, unpaid orders, aggregation ledger, waste analytics
CREATE INDEX "orders_branch_id_organization_id_status_paid_at_idx" ON "orders"("branch_id", "organization_id", "status", "paid_at");

CREATE INDEX "order_aggregation_ledger_order_id_action_idx" ON "order_aggregation_ledger"("order_id", "action");

CREATE INDEX "stock_movements_branch_id_type_created_at_idx" ON "stock_movements"("branch_id", "type", "created_at");
