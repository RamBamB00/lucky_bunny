import * as cookie from "cookie";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { Session } from "@contracts/constants";
import { createRouter, publicQuery, authedQuery } from "./middleware";
import { getSessionCookieOptions } from "./lib/cookies";
import { signSessionToken } from "./kimi/session";
import { hashPassword, verifyPassword } from "./lib/passwords";
import { getDb } from "./queries/connection";
import { users, wholesaleRequests, passwordResets } from "@db/schema";

function localUnionId(email: string) {
  return `local:${email.trim().toLowerCase()}`;
}

async function issueSession(ctx: { req: Request; resHeaders: Headers }, unionId: string) {
  const token = await signSessionToken({ unionId, clientId: "local" });
  const opts = getSessionCookieOptions(ctx.req.headers);
  ctx.resHeaders.append(
    "set-cookie",
    cookie.serialize(Session.cookieName, token, {
      httpOnly: opts.httpOnly,
      path: opts.path,
      sameSite: opts.sameSite?.toLowerCase() as "lax" | "none",
      secure: opts.secure,
      maxAge: Session.maxAgeMs / 1000,
    }),
  );
}

const registerInput = z.object({
  name: z.string().min(2, "Укажите имя").max(255),
  email: z.string().email("Некорректный email").max(320),
  phone: z.string().min(6, "Укажите телефон").max(32),
  password: z.string().min(6, "Пароль не короче 6 символов").max(128),
  accountType: z.enum(["retail", "wholesale"]).default("retail"),
  companyName: z.string().max(255).optional(),
  newsletterOptIn: z.boolean().default(false),
});

export const localAuthRouter = createRouter({
  register: publicQuery
    .input(registerInput)
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const unionId = localUnionId(input.email);
      const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.unionId, unionId))
        .limit(1);
      if (existing.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Аккаунт с таким email уже существует",
        });
      }

      const isWholesale = input.accountType === "wholesale";
      const [{ id }] = await db
        .insert(users)
        .values({
          unionId,
          name: input.name,
          email: input.email.trim().toLowerCase(),
          phone: input.phone,
          passwordHash: hashPassword(input.password),
          role: "user",
          accountType: input.accountType,
          wholesaleStatus: isWholesale ? "pending" : "none",
          companyName: input.companyName ?? null,
          newsletterOptIn: input.newsletterOptIn,
          lastSignInAt: new Date(),
        })
        .$returningId();

      if (isWholesale) {
        await db.insert(wholesaleRequests).values({
          userId: id,
          companyName: input.companyName ?? null,
          message: "Заявка создана при регистрации",
        });
      }

      await issueSession(ctx, unionId);
      return { success: true, wholesalePending: isWholesale };
    }),

  login: publicQuery
    .input(
      z.object({
        email: z.string().email().max(320),
        password: z.string().min(1).max(128),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const unionId = localUnionId(input.email);
      const user = await db
        .select()
        .from(users)
        .where(eq(users.unionId, unionId))
        .limit(1)
        .then((r) => r.at(0));

      if (!user || !user.passwordHash) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Неверный email или пароль",
        });
      }
      if (!verifyPassword(input.password, user.passwordHash)) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Неверный email или пароль",
        });
      }

      await db
        .update(users)
        .set({ lastSignInAt: new Date() })
        .where(eq(users.id, user.id));

      await issueSession(ctx, unionId);
      return { success: true };
    }),

  // Восстановление пароля: без SMTP создаём заявку, которую обрабатывает администратор
  requestPasswordReset: publicQuery
    .input(z.object({ email: z.string().email().max(320) }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const unionId = localUnionId(input.email);
      const user = await db
        .select()
        .from(users)
        .where(eq(users.unionId, unionId))
        .limit(1)
        .then((r) => r.at(0));
      // Не раскрываем, существует ли аккаунт
      if (user) {
        await db.insert(passwordResets).values({
          userId: user.id,
          email: input.email.trim().toLowerCase(),
        });
      }
      return { success: true };
    }),

  changePassword: authedQuery
    .input(
      z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(6).max(128),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1)
        .then((r) => r.at(0));
      if (!user?.passwordHash) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Для этого аккаунта пароль не установлен",
        });
      }
      if (!verifyPassword(input.currentPassword, user.passwordHash)) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Текущий пароль неверен",
        });
      }
      await db
        .update(users)
        .set({ passwordHash: hashPassword(input.newPassword) })
        .where(eq(users.id, ctx.user.id));
      return { success: true };
    }),
});
