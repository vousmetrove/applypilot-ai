import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const profiles = sqliteTable("profiles", {
  userId: text("user_id").primaryKey(),
  profileJson: text("profile_json").notNull().default("{}"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const applications = sqliteTable(
  "applications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    company: text("company").notNull().default(""),
    role: text("role").notNull().default(""),
    platform: text("platform").notNull().default("待确认"),
    applicationUrl: text("application_url").notNull().default(""),
    status: text("status").notNull().default("待投递"),
    jd: text("jd").notNull().default(""),
    resultJson: text("result_json").notNull().default("{}"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("applications_user_updated_idx").on(table.userId, table.updatedAt)],
);

export const attachments = sqliteTable(
  "attachments",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    type: text("type").notNull().default("其他材料"),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull().default("application/octet-stream"),
    size: integer("size").notNull().default(0),
    r2Key: text("r2_key").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("attachments_user_created_idx").on(table.userId, table.createdAt)],
);

export const devicePairings = sqliteTable(
  "device_pairings",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    codeHash: text("code_hash").notNull(),
    tokenHash: text("token_hash"),
    deviceName: text("device_name").notNull().default("浏览器助手"),
    status: text("status").notNull().default("pending"),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    lastSeenAt: text("last_seen_at"),
  },
  (table) => [
    uniqueIndex("device_pairings_code_hash_uidx").on(table.codeHash),
    uniqueIndex("device_pairings_token_hash_uidx").on(table.tokenHash),
    index("device_pairings_user_created_idx").on(table.userId, table.createdAt),
  ],
);

export const deviceEvents = sqliteTable(
  "device_events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    deviceId: text("device_id").notNull(),
    type: text("type").notNull(),
    platform: text("platform").notNull().default("unknown"),
    message: text("message").notNull().default(""),
    payloadJson: text("payload_json").notNull().default("{}"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("device_events_user_created_idx").on(table.userId, table.createdAt),
    index("device_events_device_created_idx").on(table.deviceId, table.createdAt),
  ],
);

export const deviceCommands = sqliteTable(
  "device_commands",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    deviceId: text("device_id").notNull(),
    type: text("type").notNull(),
    payloadJson: text("payload_json").notNull().default("{}"),
    status: text("status").notNull().default("pending"),
    resultJson: text("result_json").notNull().default("{}"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    completedAt: text("completed_at"),
  },
  (table) => [
    index("device_commands_device_status_idx").on(table.deviceId, table.status),
    index("device_commands_user_created_idx").on(table.userId, table.createdAt),
  ],
);
