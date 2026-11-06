ALTER TYPE "public"."dunning_stage" ADD VALUE IF NOT EXISTS 'reminded' BEFORE 'charging';--> statement-breakpoint
ALTER TYPE "public"."dunning_stage" ADD VALUE IF NOT EXISTS 'deletion_warned' BEFORE 'terminating';
