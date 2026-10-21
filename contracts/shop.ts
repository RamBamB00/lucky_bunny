// Общие константы магазина Lucky Bunny (frontend + backend)

export const ORDER_STATUSES = [
  "new",
  "confirmed",
  "paid",
  "assembling",
  "shipped",
  "delivered",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new: "Новый",
  confirmed: "Подтверждён",
  paid: "Оплачен",
  assembling: "Собирается",
  shipped: "Передан в доставку",
  delivered: "Доставлен",
  cancelled: "Отменён",
};

export const AGE_GROUPS = ["0+", "3+", "6+", "12+", "16+", "18+"] as const;

export const LANGUAGES = ["Русский", "Казахский", "Английский"] as const;

export const BINDINGS = ["Твёрдый", "Мягкий", "Картонные страницы"] as const;

// Ключи настроек магазина (таблица settings)
export const SettingKeys = {
  topBarText: "topBarText",
  contacts: "contacts", // JSON: { phone, email, whatsapp, address, instagram }
  deliveryMethods: "deliveryMethods", // JSON: [{ id, name, description, fee, eta }]
  paymentMethods: "paymentMethods", // JSON: [{ id, name, description }]
  freeDeliveryFrom: "freeDeliveryFrom", // число (₸), 0 = нет
  minWholesaleOrder: "minWholesaleOrder", // число (₸)
  wholesaleText: "wholesaleText", // текст условий опта
  pageDelivery: "pageDelivery", // HTML/текст страницы «Доставка и оплата»
  pageReturns: "pageReturns", // «Возврат и обмен»
  pageTerms: "pageTerms", // «Условия покупки»
  aboutText: "aboutText",
} as const;

export type DeliveryMethodCfg = {
  id: string;
  name: string;
  description?: string;
  fee: number;
  eta?: string;
};

export type PaymentMethodCfg = {
  id: string;
  name: string;
  description?: string;
};

export type ContactsCfg = {
  phone?: string;
  email?: string;
  whatsapp?: string;
  address?: string;
  instagram?: string;
};

export const DEFAULT_DELIVERY_METHODS: DeliveryMethodCfg[] = [
  {
    id: "courier",
    name: "Курьерская доставка",
    description: "Доставка курьером по городу",
    fee: 990,
    eta: "1–2 дня",
  },
  {
    id: "pickup",
    name: "Самовывоз",
    description: "Из пункта выдачи Lucky Bunny",
    fee: 0,
    eta: "В день заказа",
  },
  {
    id: "post",
    name: "Почтовая доставка",
    description: "Казпочта по всему Казахстану",
    fee: 1490,
    eta: "3–7 дней",
  },
];

export const DEFAULT_PAYMENT_METHODS: PaymentMethodCfg[] = [
  {
    id: "cash",
    name: "Наличными при получении",
    description: "Курьеру или при самовывозе",
  },
  {
    id: "card_transfer",
    name: "Перевод на карту",
    description: "Kaspi / Halyk — реквизиты после подтверждения заказа",
  },
];

export const CURRENCY = "₸";
