import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { users, addresses } from "@db/schema";

export const accountRouter = createRouter({
  updateProfile: authedQuery
    .input(
      z.object({
        name: z.string().min(2).max(255),
        phone: z.string().min(6).max(32),
        newsletterOptIn: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await getDb()
        .update(users)
        .set({
          name: input.name,
          phone: input.phone,
          newsletterOptIn: input.newsletterOptIn,
        })
        .where(eq(users.id, ctx.user.id));
      return { success: true };
    }),

  addresses: authedQuery.query(async ({ ctx }) => {
    return getDb().select().from(addresses).where(eq(addresses.userId, ctx.user.id));
  }),

  addAddress: authedQuery
    .input(
      z.object({
        label: z.string().max(128).optional(),
        city: z.string().min(2).max(128),
        address: z.string().min(3).max(512),
        isDefault: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      if (input.isDefault) {
        await db.update(addresses).set({ isDefault: false }).where(eq(addresses.userId, ctx.user.id));
      }
      await db.insert(addresses).values({ ...input, userId: ctx.user.id });
      return { success: true };
    }),

  deleteAddress: authedQuery
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await getDb()
        .delete(addresses)
        .where(and(eq(addresses.id, input.id), eq(addresses.userId, ctx.user.id)));
      return { success: true };
    }),
});
