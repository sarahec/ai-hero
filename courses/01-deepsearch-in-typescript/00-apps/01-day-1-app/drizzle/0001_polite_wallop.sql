ALTER TABLE "ai-app-template_chat" DROP CONSTRAINT "ai-app-template_chat_user_id_ai-app-template_user_id_fk";
--> statement-breakpoint
ALTER TABLE "ai-app-template_message" DROP CONSTRAINT "ai-app-template_message_chat_id_ai-app-template_chat_id_fk";
--> statement-breakpoint
ALTER TABLE "ai-app-template_request" DROP CONSTRAINT "ai-app-template_request_user_id_ai-app-template_user_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "request_user_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "request_user_time_idx";--> statement-breakpoint
ALTER TABLE "ai-app-template_chat" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "ai-app-template_chat" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "ai-app-template_chat" ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "ai-app-template_message" ALTER COLUMN "order" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "ai-app-template_message" ALTER COLUMN "parts" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "ai-app-template_message" ALTER COLUMN "role" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "ai-app-template_message" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "ai-app-template_request" ALTER COLUMN "id" SET DATA TYPE serial;--> statement-breakpoint
ALTER TABLE "ai-app-template_request" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "ai-app-template_message" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai-app-template_chat" ADD CONSTRAINT "ai-app-template_chat_user_id_ai-app-template_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."ai-app-template_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai-app-template_message" ADD CONSTRAINT "ai-app-template_message_chat_id_ai-app-template_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."ai-app-template_chat"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai-app-template_request" ADD CONSTRAINT "ai-app-template_request_user_id_ai-app-template_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."ai-app-template_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "ai-app-template_message" DROP COLUMN IF EXISTS "content";--> statement-breakpoint
ALTER TABLE "ai-app-template_request" DROP COLUMN IF EXISTS "prompt_tokens";--> statement-breakpoint
ALTER TABLE "ai-app-template_request" DROP COLUMN IF EXISTS "completion_tokens";