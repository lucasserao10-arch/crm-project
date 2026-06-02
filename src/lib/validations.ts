import { z } from "zod"

export const passwordSchema = z
  .string()
  .min(8, "Mínimo 8 caracteres")
  .regex(/[a-zA-Z]/, "Deve conter pelo menos 1 letra")
  .regex(/[0-9]/, "Deve conter pelo menos 1 número")

export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Senha obrigatória"),
})

export const contactSchema = z.object({
  name: z.string().min(1, "Nome obrigatório").max(150, "Máximo 150 caracteres"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  phone: z.string().max(30).optional().or(z.literal("")),
  company: z.string().max(150).optional().or(z.literal("")),
  ownerId: z.string().uuid("Owner inválido"),
})

export const interactionSchema = z.object({
  contactId: z.string().uuid(),
  type: z.enum(["call", "email", "meeting", "note"]),
  notes: z.string().max(2000).optional().or(z.literal("")),
  date: z.string().min(1, "Data obrigatória"),
})

export const dealSchema = z.object({
  contactId: z.string().uuid(),
  title: z.string().min(1, "Título obrigatório").max(200, "Máximo 200 caracteres"),
  value: z.number().nonnegative("Valor não pode ser negativo").optional(),
  stage: z.enum(["lead", "qualified", "proposal", "negotiation", "closed_won", "closed_lost"]),
})

export const updateDealStageSchema = z.object({
  dealId: z.string().uuid(),
  stage: z.enum(["lead", "qualified", "proposal", "negotiation", "closed_won", "closed_lost"]),
  updatedAt: z.string().min(1),
})

export const profileSchema = z.object({
  fullName: z.string().min(1, "Nome obrigatório").max(100, "Máximo 100 caracteres"),
})

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Senha atual obrigatória"),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Senhas não coincidem",
    path: ["confirmPassword"],
  })

export const createUserSchema = z.object({
  fullName: z.string().min(1).max(100),
  email: z.string().email(),
  role: z.enum(["admin", "user"]),
})

export const resetPasswordRequestSchema = z.object({
  email: z.string().email(),
})

export const setPasswordSchema = z
  .object({
    token: z.string().min(1),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Senhas não coincidem",
    path: ["confirmPassword"],
  })
