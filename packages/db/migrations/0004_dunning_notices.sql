ALTER TYPE "public"."dunning_stage" ADD VALUE 'reminded' BEFORE 'charging';--> statement-breakpoint
ALTER TYPE "public"."dunning_stage" ADD VALUE 'deletion_warned' BEFORE 'terminating';