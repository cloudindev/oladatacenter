ALTER TABLE "plans" ALTER COLUMN "margin_basis_points" SET DEFAULT 7000;--> statement-breakpoint
-- Plans still on the old default move to the new one; a margin set by hand in /admin is kept.
UPDATE "plans" SET "margin_basis_points" = 7000 WHERE "margin_basis_points" = 7500;
