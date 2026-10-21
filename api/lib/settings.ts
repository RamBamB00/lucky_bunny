import { eq } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { settings } from "@db/schema";
import {
  SettingKeys,
  DEFAULT_DELIVERY_METHODS,
  DEFAULT_PAYMENT_METHODS,
  type ContactsCfg,
  type DeliveryMethodCfg,
  type PaymentMethodCfg,
} from "@contracts/shop";

export async function getSetting(key: string): Promise<string | null> {
  const rows = await getDb()
    .select()
    .from(settings)
    .where(eq(settings.key, key))
    .limit(1);
  return rows.at(0)?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await getDb()
    .insert(settings)
    .values({ key, value })
    .onDuplicateKeyUpdate({ set: { value } });
}

export async function getJsonSetting<T>(key: string, fallback: T): Promise<T> {
  const raw = await getSetting(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function getDeliveryMethods(): Promise<DeliveryMethodCfg[]> {
  return getJsonSetting(SettingKeys.deliveryMethods, DEFAULT_DELIVERY_METHODS);
}

export async function getPaymentMethods(): Promise<PaymentMethodCfg[]> {
  return getJsonSetting(SettingKeys.paymentMethods, DEFAULT_PAYMENT_METHODS);
}

export async function getContacts(): Promise<ContactsCfg> {
  return getJsonSetting(SettingKeys.contacts, {
    phone: "",
    email: "",
    whatsapp: "",
    address: "",
    instagram: "",
  });
}

export async function getFreeDeliveryFrom(): Promise<number> {
  const raw = await getSetting(SettingKeys.freeDeliveryFrom);
  const n = raw ? parseInt(raw, 10) : 15000;
  return Number.isFinite(n) ? n : 15000;
}

export async function getMinWholesaleOrder(): Promise<number> {
  const raw = await getSetting(SettingKeys.minWholesaleOrder);
  const n = raw ? parseInt(raw, 10) : 0;
  return Number.isFinite(n) ? n : 0;
}
