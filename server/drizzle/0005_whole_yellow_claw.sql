ALTER TABLE "webinar_registrations" DROP CONSTRAINT "webinar_registrations_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "webinar_registrations" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "webinar_registrations" ADD COLUMN "name" varchar(100) NOT NULL;--> statement-breakpoint
ALTER TABLE "webinar_registrations" ADD COLUMN "email" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "webinar_registrations" ADD CONSTRAINT "webinar_registrations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;