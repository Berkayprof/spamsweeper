import { pgTable, text, serial, integer, boolean, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  microsoftId: text("microsoft_id").unique(),
  googleId: text("google_id").unique(),
  yahooId: text("yahoo_id").unique(),
  provider: text("provider").notNull(), // "microsoft", "google", or "yahoo"
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiry: timestamp("token_expiry"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const emailScans = pgTable("email_scans", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  totalScanned: integer("total_scanned").default(0),
  detectedSpam: integer("detected_spam").default(0),
  unsubscribeLinks: integer("unsubscribe_links").default(0),
  processed: integer("processed").default(0),
  currentProgress: integer("current_progress").default(0), // Current email being processed
  status: text("status").default("pending"), // pending, processing, completed, failed
  createdAt: timestamp("created_at").defaultNow(),
});

export const spamEmails = pgTable("spam_emails", {
  id: serial("id").primaryKey(),
  scanId: integer("scan_id").notNull(),
  messageId: text("message_id").notNull(),
  sender: text("sender").notNull(),
  subject: text("subject").notNull(),
  body: text("body"),
  aiConfidence: integer("ai_confidence"), // 0-100
  hasUnsubscribeLink: boolean("has_unsubscribe_link").default(false),
  unsubscribeUrl: text("unsubscribe_url"),
  isSelected: boolean("is_selected").default(true),
  isProcessed: boolean("is_processed").default(false),
  userFeedback: text("user_feedback"), // "spam", "not_spam", "uncertain"
  aiStatus: text("ai_status").default("classified"), // "classified", "error", "timeout"
  unsubscribeStatus: text("unsubscribe_status"), // "success", "failed", "unclear", null = not attempted
  unsubscribeMessage: text("unsubscribe_message"), // details about the unsubscribe attempt
  receivedDate: timestamp("received_date"),
  createdAt: timestamp("created_at").defaultNow(),
});

// New table for learning system
export const userLearningData = pgTable("user_learning_data", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  senderPattern: text("sender_pattern").notNull(),
  subjectPattern: text("subject_pattern"),
  bodyKeywords: text("body_keywords").array(),
  userDecision: text("user_decision").notNull(), // "spam", "not_spam"
  confidence: integer("confidence").default(50), // How confident the system is in this pattern
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  microsoftId: true,
  googleId: true,
  yahooId: true,
  provider: true,
});

export const insertEmailScanSchema = createInsertSchema(emailScans).pick({
  userId: true,
  totalScanned: true,
  detectedSpam: true,
  unsubscribeLinks: true,
  processed: true,
  currentProgress: true,
  status: true,
});

export const insertSpamEmailSchema = createInsertSchema(spamEmails).pick({
  scanId: true,
  messageId: true,
  sender: true,
  subject: true,
  body: true,
  aiConfidence: true,
  hasUnsubscribeLink: true,
  unsubscribeUrl: true,
  isSelected: true,
  userFeedback: true,
  aiStatus: true,
  receivedDate: true,
});

export const insertUserLearningDataSchema = createInsertSchema(userLearningData).pick({
  userId: true,
  senderPattern: true,
  subjectPattern: true,
  bodyKeywords: true,
  userDecision: true,
  confidence: true,
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type EmailScan = typeof emailScans.$inferSelect;
export type InsertEmailScan = z.infer<typeof insertEmailScanSchema>;
export type SpamEmail = typeof spamEmails.$inferSelect;
export type InsertSpamEmail = z.infer<typeof insertSpamEmailSchema>;
export type UserLearningData = typeof userLearningData.$inferSelect;
export type InsertUserLearningData = z.infer<typeof insertUserLearningDataSchema>;
