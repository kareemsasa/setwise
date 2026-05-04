import {
  pgTable,
  uuid,
  varchar,
  decimal,
  date,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";

export const biologicalSexEnum = pgEnum("biological_sex", ["male", "female"]);

export const experienceLevelEnum = pgEnum("experience_level", [
  "beginner",
  "intermediate",
  "advanced",
]);

export const userProfiles = pgTable("user_profiles", {
  id: uuid().primaryKey().defaultRandom(),
  name: varchar({ length: 255 }).notNull(),
  email: varchar({ length: 255 }).notNull().unique(),
  heightCm: decimal("height_cm", { precision: 5, scale: 1 }).notNull(),
  weightKg: decimal("weight_kg", { precision: 5, scale: 1 }).notNull(),
  dateOfBirth: date("date_of_birth").notNull(),
  biologicalSex: biologicalSexEnum("biological_sex").notNull(),
  experienceLevel: experienceLevelEnum("experience_level").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
