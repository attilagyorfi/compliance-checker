CREATE TABLE `analyses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`status` enum('pending','processing','completed','error') NOT NULL DEFAULT 'pending',
	`planDocumentKey` varchar(512),
	`planDocumentName` varchar(255),
	`regulationDocumentKeys` json DEFAULT ('[]'),
	`regulationDocumentNames` json DEFAULT ('[]'),
	`results` json,
	`summary` text,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `analyses_id` PRIMARY KEY(`id`)
);
