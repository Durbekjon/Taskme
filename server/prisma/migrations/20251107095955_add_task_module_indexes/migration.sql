-- CreateIndex
CREATE INDEX "idx_files_task_id" ON "public"."files"("task_id");

-- CreateIndex
CREATE INDEX "idx_files_company_id" ON "public"."files"("company_id");

-- CreateIndex
CREATE INDEX "idx_files_sheet_id" ON "public"."files"("sheet_id");

-- CreateIndex
CREATE INDEX "idx_logs_task_id" ON "public"."logs"("task_id");

-- CreateIndex
CREATE INDEX "idx_logs_company_id" ON "public"."logs"("company_id");

-- CreateIndex
CREATE INDEX "idx_logs_sheet_id" ON "public"."logs"("sheet_id");

-- CreateIndex
CREATE INDEX "idx_logs_workspace_id" ON "public"."logs"("workspace_id");

-- CreateIndex
CREATE INDEX "idx_tasks_sheet_id" ON "public"."tasks"("sheet_id");

-- CreateIndex
CREATE INDEX "idx_tasks_company_id" ON "public"."tasks"("company_id");

-- CreateIndex
CREATE INDEX "idx_tasks_workspace_id" ON "public"."tasks"("workspace_id");

-- CreateIndex
CREATE INDEX "idx_tasks_status" ON "public"."tasks"("status");

-- CreateIndex
CREATE INDEX "idx_tasks_priority" ON "public"."tasks"("priority");

-- CreateIndex
CREATE INDEX "idx_tasks_order" ON "public"."tasks"("order");

-- CreateIndex
CREATE INDEX "idx_tasks_last_updated_by_user_id" ON "public"."tasks"("last_updated_by_user_id");

-- CreateIndex
CREATE INDEX "idx_tasks_sheet_id_order" ON "public"."tasks"("sheet_id", "order");

-- CreateIndex
CREATE INDEX "idx_tasks_sheet_id_status" ON "public"."tasks"("sheet_id", "status");

-- CreateIndex
CREATE INDEX "idx_tasks_sheet_id_priority" ON "public"."tasks"("sheet_id", "priority");

-- CreateIndex
CREATE INDEX "idx_tasks_company_id_order" ON "public"."tasks"("company_id", "order");
