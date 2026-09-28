CREATE TABLE `courses` (
	`code` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`units` integer NOT NULL,
	`description` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `enrolments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`course_code` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`course_code`) REFERENCES `courses`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `enrolments_course_code_unique` ON `enrolments` (`course_code`);