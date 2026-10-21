import { z } from "zod";
import { asc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, publicQuery, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { banners, newsletterSubs, contactMessages, wholesaleRequests, users } from "@db/schema";
import {
  getDeliveryMethods,
  getPaymentMethods,
  getContacts,
  getFreeDeliveryFrom,
  getMinWholesaleOrder,
  getSetting,
} from "./lib/settings";
import { SettingKeys } from "@contracts/shop";
import { cached } from "./lib/cache";

export const shopRouter = createRouter({
  // Публичные настройки для витрины
  publicConfig: publicQuery.query(() =>
    cached("shop:publicConfig", 60_000, async () => {
      const [topBarText, contacts, deliveryMethods, paymentMethods, freeDeliveryFrom, minWholesaleOrder] =
        await Promise.all([
          getSetting(SettingKeys.topBarText),
          getContacts(),
          getDeliveryMethods(),
          getPaymentMethods(),
          getFreeDeliveryFrom(),
          getMinWholesaleOrder(),
        ]);
      return {
        topBarText,
        contacts,
        deliveryMethods,
        paymentMethods,
        freeDeliveryFrom,
        minWholesaleOrder,
      };
    }),
  ),

  page: publicQuery
    .input(z.object({ key: z.enum(["pageDelivery", "pageReturns", "pageTerms", "wholesaleText", "aboutText"]) }))
    .query(async ({ input }) => {
      return { content: (await getSetting(SettingKeys[input.key])) ?? "" };
    }),

  banners: publicQuery.query(() =>
    cached("shop:banners", 60_000, () =>
      getDb()
        .select()
        .from(banners)
        .where(eq(banners.isActive, true))
        .orderBy(asc(banners.sortOrder)),
    ),
  ),

  subscribe: publicQuery
    .input(z.object({ email: z.string().email().max(320), consent: z.literal(true) }))
    .mutation(async ({ input }) => {
      await getDb()
        .insert(newsletterSubs)
        .values({ email: input.email.trim().toLowerCase() })
        .onDuplicateKeyUpdate({ set: { email: input.email.trim().toLowerCase() } });
      return { success: true };
    }),

  contact: publicQuery
    .input(
      z.object({
        name: z.string().min(2).max(255),
        contact: z.string().min(3).max(255),
        message: z.string().min(3).max(3000),
      }),
    )
    .mutation(async ({ input }) => {
      await getDb().insert(contactMessages).values(input);
      return { success: true };
    }),

  // Заявка на оптовое сотрудничество (авторизованный пользователь)
  requestWholesale: authedQuery
    .input(
      z.object({
        companyName: z.string().min(2, "Укажите название компании").max(255),
        message: z.string().max(2000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      if (ctx.user.wholesaleStatus === "approved") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Ваш оптовый аккаунт уже одобрен" });
      }
      if (ctx.user.wholesaleStatus === "pending") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Заявка уже на рассмотрении" });
      }
      await db.insert(wholesaleRequests).values({
        userId: ctx.user.id,
        companyName: input.companyName,
        message: input.message ?? null,
      });
      await db
        .update(users)
        .set({ accountType: "wholesale", wholesaleStatus: "pending", companyName: input.companyName })
        .where(eq(users.id, ctx.user.id));
      return { success: true };
    }),

  myWholesaleStatus: authedQuery.query(({ ctx }) => ({
    accountType: ctx.user.accountType,
    wholesaleStatus: ctx.user.wholesaleStatus,
    companyName: ctx.user.companyName,
  })),
});
