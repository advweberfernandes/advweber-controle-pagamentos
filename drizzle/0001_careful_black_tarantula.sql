CREATE TABLE `clients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`totalFees` decimal(10,2) NOT NULL,
	`installmentCount` int NOT NULL,
	`installmentValue` decimal(10,2) NOT NULL,
	`startDate` bigint NOT NULL,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `installments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`number` int NOT NULL,
	`dueDate` bigint NOT NULL,
	`paidAt` bigint,
	`status` enum('pending','paid','overdue') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `installments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `installments` ADD CONSTRAINT `installments_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;