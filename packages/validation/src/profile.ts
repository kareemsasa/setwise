import { z } from "zod";

export const createProfileSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().max(255),
  heightCm: z.number().positive().max(300),
  weightKg: z.number().positive().max(500),
  dateOfBirth: z.string().date(),
  biologicalSex: z.enum(["male", "female"]),
  experienceLevel: z.enum(["beginner", "intermediate", "advanced"]),
});

export type CreateProfileInput = z.infer<typeof createProfileSchema>;

export const updateProfileSchema = createProfileSchema.partial().omit({
  email: true,
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
