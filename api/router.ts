import { authRouter } from "./auth-router";
import { localAuthRouter } from "./local-auth-router";
import { catalogRouter } from "./catalog-router";
import { cartRouter } from "./cart-router";
import { favoritesRouter } from "./favorites-router";
import { orderRouter } from "./order-router";
import { accountRouter } from "./account-router";
import { shopRouter } from "./shop-router";
import { adminCatalogRouter } from "./admin-catalog-router";
import { adminRouter } from "./admin-router";
import { createRouter, publicQuery } from "./middleware";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  localAuth: localAuthRouter,
  catalog: catalogRouter,
  cart: cartRouter,
  favorites: favoritesRouter,
  order: orderRouter,
  account: accountRouter,
  shop: shopRouter,
  adminCatalog: adminCatalogRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
