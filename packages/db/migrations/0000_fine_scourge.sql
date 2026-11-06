CREATE TYPE "public"."action_status" AS ENUM('queued', 'running', 'done', 'error');--> statement-breakpoint
CREATE TYPE "public"."actor_type" AS ENUM('user', 'admin', 'system', 'webhook');--> statement-breakpoint
CREATE TYPE "public"."addon_status" AS ENUM('pending', 'active', 'removed');--> statement-breakpoint
CREATE TYPE "public"."billing_term" AS ENUM('P1M', 'P12M');--> statement-breakpoint
CREATE TYPE "public"."credit_reason" AS ENUM('welcome', 'manual', 'refund');--> statement-breakpoint
CREATE TYPE "public"."customer_kind" AS ENUM('company', 'individual');--> statement-breakpoint
CREATE TYPE "public"."customer_status" AS ENUM('unverified', 'verified', 'review', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."dunning_stage" AS ENUM('scheduled', 'invoiced', 'charging', 'retry_1', 'retry_2', 'suspended', 'terminating', 'paid');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('unpaid', 'paid', 'cancelled', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."order_kind" AS ENUM('new', 'upgrade', 'addon');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('draft', 'pending_payment', 'paid', 'provisioning', 'delivered', 'delayed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."service_status" AS ENUM('provisioning', 'active', 'stopped', 'suspended', 'review', 'terminating', 'terminated');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('customer', 'admin');--> statement-breakpoint
CREATE TYPE "public"."webhook_provider" AS ENUM('stripe', 'whmcs');--> statement-breakpoint
CREATE TABLE "actions" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"service_id" varchar(26) NOT NULL,
	"user_id" varchar(26),
	"type" varchar(40) NOT NULL,
	"status" "action_status" DEFAULT 'queued' NOT NULL,
	"ovh_task_id" integer,
	"payload" jsonb,
	"result" jsonb,
	"error" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "addons" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"ovh_plan_code" varchar(80) NOT NULL,
	"family" varchar(32) NOT NULL,
	"name" varchar(120) NOT NULL,
	"cost_month" integer NOT NULL,
	"cost_12m" integer NOT NULL,
	"price_month" integer,
	"price_12m" integer,
	"margin_basis_points" integer DEFAULT 5000 NOT NULL,
	"applies_to" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"mandatory" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"actor_id" varchar(26),
	"actor_type" "actor_type" DEFAULT 'system' NOT NULL,
	"entity" varchar(40) NOT NULL,
	"entity_id" varchar(26),
	"action" varchar(60) NOT NULL,
	"diff" jsonb,
	"ip" varchar(45),
	"user_agent" text,
	"correlation_id" varchar(40),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credits" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"customer_id" varchar(26) NOT NULL,
	"amount" integer NOT NULL,
	"consumed" integer DEFAULT 0 NOT NULL,
	"reason" "credit_reason" NOT NULL,
	"note" text,
	"expires_at" timestamp with time zone,
	"signals" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"user_id" varchar(26) NOT NULL,
	"kind" "customer_kind" DEFAULT 'company' NOT NULL,
	"legal_name" varchar(200),
	"tax_id" varchar(32),
	"tax_id_validated" boolean DEFAULT false NOT NULL,
	"tax_id_validated_at" timestamp with time zone,
	"address_line1" varchar(200),
	"address_line2" varchar(200),
	"city" varchar(120),
	"postal_code" varchar(20),
	"country" varchar(2),
	"phone" varchar(32),
	"phone_verified_at" timestamp with time zone,
	"whmcs_client_id" integer,
	"stripe_customer_id" varchar(64),
	"status" "customer_status" DEFAULT 'unverified' NOT NULL,
	"first_paid_at" timestamp with time zone,
	"risk_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feature_flags" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"key" varchar(60) NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feature_flags_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"customer_id" varchar(26) NOT NULL,
	"service_id" varchar(26),
	"order_id" varchar(26),
	"whmcs_invoice_id" integer NOT NULL,
	"number" varchar(40),
	"status" "invoice_status" DEFAULT 'unpaid' NOT NULL,
	"subtotal" integer DEFAULT 0 NOT NULL,
	"tax" integer DEFAULT 0 NOT NULL,
	"credit" integer DEFAULT 0 NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"due_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"customer_id" varchar(26) NOT NULL,
	"kind" "order_kind" DEFAULT 'new' NOT NULL,
	"status" "order_status" DEFAULT 'draft' NOT NULL,
	"service_id" varchar(26),
	"items" jsonb NOT NULL,
	"term" "billing_term" DEFAULT 'P1M' NOT NULL,
	"subtotal" integer NOT NULL,
	"tax" integer DEFAULT 0 NOT NULL,
	"credit_applied" integer DEFAULT 0 NOT NULL,
	"total" integer NOT NULL,
	"expected_cost" integer DEFAULT 0 NOT NULL,
	"stripe_payment_intent_id" varchar(64),
	"whmcs_order_id" integer,
	"whmcs_invoice_id" integer,
	"ovh_cart_id" varchar(64),
	"ovh_order_id" integer,
	"completed_steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"idempotency_key" varchar(64) NOT NULL,
	"error" text,
	"error_code" varchar(40),
	"paid_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbound_emails" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"customer_id" varchar(26),
	"to" varchar(320) NOT NULL,
	"template" varchar(60) NOT NULL,
	"subject" text NOT NULL,
	"provider_id" varchar(120),
	"sent_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ovh_catalog_snapshots" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"raw" jsonb NOT NULL,
	"diff" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_methods" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"customer_id" varchar(26) NOT NULL,
	"stripe_payment_method_id" varchar(64) NOT NULL,
	"fingerprint" varchar(64),
	"brand" varchar(24),
	"last4" varchar(4),
	"exp_month" integer,
	"exp_year" integer,
	"verified_at" timestamp with time zone,
	"is_default" boolean DEFAULT false NOT NULL,
	"detached_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"customer_id" varchar(26) NOT NULL,
	"order_id" varchar(26),
	"invoice_id" varchar(26),
	"stripe_payment_intent_id" varchar(64),
	"amount" integer NOT NULL,
	"status" varchar(32) NOT NULL,
	"failure_code" varchar(64),
	"failure_message" text,
	"refunded_amount" integer DEFAULT 0 NOT NULL,
	"settled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"ovh_plan_code" varchar(64) NOT NULL,
	"slug" varchar(32) NOT NULL,
	"name" varchar(80) NOT NULL,
	"vcores" integer NOT NULL,
	"ram_gb" integer NOT NULL,
	"nvme_gb" integer NOT NULL,
	"bandwidth_mbps" integer NOT NULL,
	"cost_month" integer NOT NULL,
	"cost_12m" integer NOT NULL,
	"true_cost_month" integer DEFAULT 0 NOT NULL,
	"true_cost_12m" integer DEFAULT 0 NOT NULL,
	"price_month" integer,
	"price_12m" integer,
	"margin_basis_points" integer DEFAULT 7500 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_addons" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"service_id" varchar(26) NOT NULL,
	"addon_id" varchar(26) NOT NULL,
	"status" "addon_status" DEFAULT 'pending' NOT NULL,
	"monthly_price" integer DEFAULT 0 NOT NULL,
	"ovh_option_ref" varchar(120),
	"removed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"customer_id" varchar(26) NOT NULL,
	"plan_id" varchar(26) NOT NULL,
	"order_id" varchar(26),
	"display_name" varchar(80),
	"ovh_service_name" varchar(80),
	"datacenter" varchar(24) NOT NULL,
	"os" varchar(80) NOT NULL,
	"ipv4" varchar(45),
	"ipv6" varchar(45),
	"status" "service_status" DEFAULT 'provisioning' NOT NULL,
	"term" "billing_term" DEFAULT 'P1M' NOT NULL,
	"monthly_price" integer NOT NULL,
	"next_due_at" timestamp with time zone,
	"auto_renew" boolean DEFAULT true NOT NULL,
	"dunning_stage" "dunning_stage" DEFAULT 'scheduled' NOT NULL,
	"dunning_completed" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"whmcs_service_id" integer,
	"ovh_expires_at" timestamp with time zone,
	"rescue_mode" boolean DEFAULT false NOT NULL,
	"suspended_at" timestamp with time zone,
	"terminated_at" timestamp with time zone,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"user_id" varchar(26) NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip" varchar(45),
	"user_agent" text,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ssh_keys" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"customer_id" varchar(26) NOT NULL,
	"name" varchar(120) NOT NULL,
	"public_key" text NOT NULL,
	"fingerprint" varchar(128) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"email" varchar(320) NOT NULL,
	"password_hash" text,
	"totp_secret" text,
	"totp_enabled_at" timestamp with time zone,
	"role" "user_role" DEFAULT 'customer' NOT NULL,
	"email_verified_at" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"user_id" varchar(26),
	"purpose" varchar(32) NOT NULL,
	"token_hash" text NOT NULL,
	"target" varchar(320),
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"provider" "webhook_provider" NOT NULL,
	"event_id" varchar(120) NOT NULL,
	"event_type" varchar(80),
	"payload" jsonb NOT NULL,
	"processed_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credits" ADD CONSTRAINT "credits_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbound_emails" ADD CONSTRAINT "outbound_emails_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_addons" ADD CONSTRAINT "service_addons_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_addons" ADD CONSTRAINT "service_addons_addon_id_addons_id_fk" FOREIGN KEY ("addon_id") REFERENCES "public"."addons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ssh_keys" ADD CONSTRAINT "ssh_keys_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_tokens" ADD CONSTRAINT "verification_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "actions_service_idx" ON "actions" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "actions_status_idx" ON "actions" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "addons_ovh_code_unique" ON "addons" USING btree ("ovh_plan_code");--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_log" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "audit_actor_idx" ON "audit_log" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "audit_created_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "credits_customer_idx" ON "credits" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_user_unique" ON "customers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "customers_whmcs_idx" ON "customers" USING btree ("whmcs_client_id");--> statement-breakpoint
CREATE INDEX "customers_stripe_idx" ON "customers" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_whmcs_unique" ON "invoices" USING btree ("whmcs_invoice_id");--> statement-breakpoint
CREATE INDEX "invoices_customer_idx" ON "invoices" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_idempotency_unique" ON "orders" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "orders_customer_idx" ON "orders" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "orders_stripe_pi_idx" ON "orders" USING btree ("stripe_payment_intent_id");--> statement-breakpoint
CREATE INDEX "outbound_emails_customer_idx" ON "outbound_emails" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_methods_stripe_unique" ON "payment_methods" USING btree ("stripe_payment_method_id");--> statement-breakpoint
CREATE INDEX "payment_methods_customer_idx" ON "payment_methods" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "payment_methods_fingerprint_idx" ON "payment_methods" USING btree ("fingerprint");--> statement-breakpoint
CREATE INDEX "payments_customer_idx" ON "payments" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "payments_stripe_idx" ON "payments" USING btree ("stripe_payment_intent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "plans_ovh_code_unique" ON "plans" USING btree ("ovh_plan_code");--> statement-breakpoint
CREATE INDEX "service_addons_service_idx" ON "service_addons" USING btree ("service_id");--> statement-breakpoint
CREATE UNIQUE INDEX "services_ovh_name_unique" ON "services" USING btree ("ovh_service_name");--> statement-breakpoint
CREATE INDEX "services_customer_idx" ON "services" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "services_status_idx" ON "services" USING btree ("status");--> statement-breakpoint
CREATE INDEX "services_due_idx" ON "services" USING btree ("next_due_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_unique" ON "sessions" USING btree ("token");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ssh_keys_customer_idx" ON "ssh_keys" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "verification_tokens_user_idx" ON "verification_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_tokens_hash_idx" ON "verification_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_events_unique" ON "webhook_events" USING btree ("provider","event_id");