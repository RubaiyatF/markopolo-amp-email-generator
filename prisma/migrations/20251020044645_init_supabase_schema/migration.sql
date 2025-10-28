-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT,
    "api_key" TEXT NOT NULL,
    "plan_type" TEXT NOT NULL DEFAULT 'free',
    "credits_remaining" INTEGER NOT NULL DEFAULT 1000,
    "rate_limit_tier" TEXT NOT NULL DEFAULT 'free',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "internal_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "external_campaign_id" TEXT,
    "name" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "total_products" INTEGER,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "templates" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "variation_name" TEXT NOT NULL,
    "amp_url" TEXT NOT NULL,
    "fallback_url" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "merge_tags" TEXT[],
    "amp_features" TEXT[],
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generation_logs" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "campaign_id" TEXT,
    "generation_type" TEXT NOT NULL,
    "products_processed" INTEGER NOT NULL,
    "cost_usd" DECIMAL(10,6) NOT NULL,
    "duration_ms" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "generation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "template_id" TEXT,
    "event_type" TEXT NOT NULL,
    "event_data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personalization_history" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "patterns" JSONB NOT NULL,
    "performance_metrics" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personalization_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "companies_company_id_key" ON "companies"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "companies_api_key_key" ON "companies"("api_key");

-- CreateIndex
CREATE INDEX "companies_company_id_idx" ON "companies"("company_id");

-- CreateIndex
CREATE INDEX "companies_plan_type_idx" ON "companies"("plan_type");

-- CreateIndex
CREATE UNIQUE INDEX "campaigns_internal_id_key" ON "campaigns"("internal_id");

-- CreateIndex
CREATE INDEX "campaigns_company_id_idx" ON "campaigns"("company_id");

-- CreateIndex
CREATE INDEX "campaigns_user_id_idx" ON "campaigns"("user_id");

-- CreateIndex
CREATE INDEX "campaigns_status_idx" ON "campaigns"("status");

-- CreateIndex
CREATE INDEX "campaigns_created_at_idx" ON "campaigns"("created_at");

-- CreateIndex
CREATE INDEX "templates_campaign_id_idx" ON "templates"("campaign_id");

-- CreateIndex
CREATE INDEX "templates_created_at_idx" ON "templates"("created_at");

-- CreateIndex
CREATE INDEX "generation_logs_company_id_idx" ON "generation_logs"("company_id");

-- CreateIndex
CREATE INDEX "generation_logs_user_id_idx" ON "generation_logs"("user_id");

-- CreateIndex
CREATE INDEX "generation_logs_created_at_idx" ON "generation_logs"("created_at");

-- CreateIndex
CREATE INDEX "generation_logs_success_idx" ON "generation_logs"("success");

-- CreateIndex
CREATE INDEX "analytics_campaign_id_idx" ON "analytics"("campaign_id");

-- CreateIndex
CREATE INDEX "analytics_template_id_idx" ON "analytics"("template_id");

-- CreateIndex
CREATE INDEX "analytics_event_type_idx" ON "analytics"("event_type");

-- CreateIndex
CREATE INDEX "analytics_created_at_idx" ON "analytics"("created_at");

-- CreateIndex
CREATE INDEX "personalization_history_company_id_idx" ON "personalization_history"("company_id");

-- CreateIndex
CREATE INDEX "personalization_history_user_id_idx" ON "personalization_history"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "personalization_history_company_id_user_id_key" ON "personalization_history"("company_id", "user_id");

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("company_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "templates" ADD CONSTRAINT "templates_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_logs" ADD CONSTRAINT "generation_logs_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics" ADD CONSTRAINT "analytics_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics" ADD CONSTRAINT "analytics_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
