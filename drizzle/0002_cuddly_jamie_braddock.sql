CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`userEmail` varchar(320),
	`eventType` varchar(64) NOT NULL,
	`resourceType` varchar(64),
	`resourceId` varchar(255),
	`description` text,
	`metadata` json,
	`ipAddress` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `chunk_embeddings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`source_type` enum('regulation','knowledge_base') NOT NULL,
	`source_id` int NOT NULL,
	`chunk_index` int NOT NULL,
	`text` text NOT NULL,
	`embedding` json NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chunk_embeddings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `knowledge_base_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(512) NOT NULL,
	`originalName` varchar(512) NOT NULL,
	`fileType` varchar(32) NOT NULL,
	`fileSize` int NOT NULL,
	`s3Url` text NOT NULL,
	`s3Key` varchar(512) NOT NULL,
	`extractedText` text,
	`description` text,
	`tags` text,
	`projectId` int,
	`deletedAt` timestamp,
	`uploadedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `knowledge_base_documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`eventType` varchar(64) NOT NULL,
	`title` varchar(255) NOT NULL,
	`body` text,
	`link` varchar(512),
	`isRead` boolean NOT NULL DEFAULT false,
	`emailSentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `platform_credentials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`platform` enum('mszt','jogtar','epitesijog','eurlex') NOT NULL,
	`displayName` varchar(255),
	`username` varchar(320),
	`encryptedPassword` text,
	`status` enum('untested','connected','failed') NOT NULL DEFAULT 'untested',
	`lastConnectedAt` timestamp,
	`lastError` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `platform_credentials_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `project_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`userId` int NOT NULL,
	`role` enum('owner','member','reviewer') NOT NULL DEFAULT 'member',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `project_members_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`status` enum('active','archived','deleted') NOT NULL DEFAULT 'active',
	`workflowStatus` enum('uj','elemzes_alatt','ai_eloelenorizve','ember_felulvizsgalva','javitasra_visszakuldve','lezart') NOT NULL DEFAULT 'uj',
	`ownerId` int NOT NULL,
	`discipline` enum('altalanos','epiteszet','tuzvedelmi','energetika','statika','gepeszet','villamos','geotechnika','kozlekedes','tajepiteszet','egyeb') NOT NULL DEFAULT 'altalanos',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `regulation_sources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(512) NOT NULL,
	`shortCode` varchar(64),
	`discipline` enum('altalanos','epiteszet','tuzvedelmi','energetika','statika','gepeszet','villamos','geotechnika','kozlekedes','tajepiteszet','egyeb') NOT NULL DEFAULT 'altalanos',
	`sourceType` enum('njt','netjogtar','eurlex','mszt','jogtar','epitesijog','pdf','url') NOT NULL DEFAULT 'njt',
	`sourceUrl` text,
	`content` mediumtext,
	`contentFetchedAt` timestamp,
	`lastSyncAt` timestamp,
	`syncStatus` enum('ok','error','pending','never') DEFAULT 'never',
	`version` varchar(128),
	`lastSyncError` text,
	`s3Key` varchar(512),
	`isActive` boolean NOT NULL DEFAULT true,
	`deletedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `regulation_sources_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `search_queries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`question` text NOT NULL,
	`rewritten_question` text,
	`search_mode` enum('mszt','internal','combined','web','combined_with_web') NOT NULL DEFAULT 'combined',
	`answer_length` enum('short','standard','detailed') NOT NULL DEFAULT 'standard',
	`operation_mode` enum('fast','accurate') NOT NULL DEFAULT 'accurate',
	`answer` text,
	`extended_answer` text,
	`confidence` enum('low','medium','high'),
	`sources` json,
	`has_sufficient_sources` boolean NOT NULL DEFAULT true,
	`self_check_passed` boolean NOT NULL DEFAULT true,
	`self_check_notes` text,
	`user_id` int,
	`project_id` int,
	`project_name` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `search_queries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `search_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int,
	`answer_length` enum('short','standard','detailed') NOT NULL DEFAULT 'standard',
	`operation_mode` enum('fast','accurate') NOT NULL DEFAULT 'accurate',
	`search_mode` enum('mszt','internal','combined','web','combined_with_web') NOT NULL DEFAULT 'combined',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `search_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','reviewer') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `analyses` ADD `projectId` int;--> statement-breakpoint
ALTER TABLE `analyses` ADD `userId` int;--> statement-breakpoint
ALTER TABLE `analyses` ADD `workflowStatus` enum('uj','elemzes_alatt','ai_eloelenorizve','ember_felulvizsgalva','javitasra_visszakuldve','lezart') DEFAULT 'uj';--> statement-breakpoint
ALTER TABLE `analyses` ADD `progressStep` varchar(128);--> statement-breakpoint
ALTER TABLE `analyses` ADD `retryCount` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `analyses` ADD `planDocuments` json DEFAULT ('[]');--> statement-breakpoint
ALTER TABLE `analyses` ADD `regulationSourceIds` json DEFAULT ('[]');--> statement-breakpoint
ALTER TABLE `analyses` DROP COLUMN `planDocumentKey`;--> statement-breakpoint
ALTER TABLE `analyses` DROP COLUMN `planDocumentName`;