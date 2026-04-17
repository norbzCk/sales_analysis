import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useAuth } from "../features/auth/AuthContext";
import { apiRequest } from "../lib/http";
import type {
  BuyerAccountSnapshot,
  BuyerAddress,
  BuyerCartItem,
  BuyerChatThread,
  BuyerDeliveryEvent,
  BuyerNotification,
  BuyerPreference,
  BuyerSuggestion,
  BuyerTrackedOrder,
  Order,
  Product,
  Provider,
} from "../types/domain";

const lifecycleSteps = ["Pending", "Confirmed", "Processing", "Dispatched", "In Transit", "Delivered"] as const;
const searchableCategories = ["All", "Fresh Produce", "Dairy", "Bakery", "Pantry", "Beverages"] as const;

function formatMoney(value?: number) {
  return `TZS ${Number(value || 0).toLocaleString()}`;
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function normalizeLifecycleStatus(value?: string | null): BuyerTrackedOrder["status"] {
  const status = String(value || "").trim().toLowerCase();
  if (status === "confirmed") return "Confirmed";
  if (status === "processing" || status === "packed" || status === "ready for shipping") return "Processing";
  if (status === "dispatched" || status === "shipped") return "Dispatched";
  if (status === "in transit" || status === "on the way") return "In Transit";
  if (status === "delivered" || status === "received") return "Delivered";
  if (status === "cancelled" || status === "canceled") return "Cancelled";
  return "Pending";
}

function getStatusTone(status: BuyerTrackedOrder["status"]) {
  if (status === "Delivered") return "buyer-badge buyer-badge--good";
  if (status === "Cancelled") return "buyer-badge buyer-badge--danger";
  if (status === "Pending") return "buyer-badge buyer-badge--warn";
  return "buyer-badge";
}

function getProgressPercent(status: BuyerTrackedOrder["status"]) {
  if (status === "Cancelled") return 8;
  const index = lifecycleSteps.indexOf(status);
  return Math.max(12, Math.round(((index + 1) / lifecycleSteps.length) * 100));
}

function getInitials(name?: string) {
  const text = String(name || "Customer").trim();
  return text
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

function buildProvider(providerId?: number | null, providerName?: string | null): Provider | undefined {
  if (!providerName && providerId == null) return undefined;
  return {
    id: Number(providerId ?? 0),
    name: providerName || "Marketplace seller",
    verified: true,
    location: "Dar es Salaam",
  };
}

function buildAddressFromOrder(order: Order, recipientName?: string): BuyerAddress | undefined {
  if (!order.delivery_address && !recipientName) return undefined;
  return {
    id: `order-address-${order.id}`,
    label: "Delivery address",
    recipientName: recipientName || "Customer",
    phone: order.delivery_phone || "+255 710 123 456",
    line1: order.delivery_address || "Primary delivery address",
    city: "Dar es Salaam",
    state: "Dar es Salaam",
    country: "Tanzania",
    deliveryNotes: order.delivery_notes || undefined,
    isDefault: true,
    type: "Home",
  };
}

function buildOrderProduct(order: Order, provider?: Provider): Product {
  return {
    id: Number(order.product_id ?? order.id),
    name: order.product || "Marketplace order",
    category: order.category || "General",
    price: Number(order.unit_price || order.total || 0),
    provider_id: provider?.id,
    provider,
  };
}

function buildDeliveryEvents(order: Order, normalizedStatus: BuyerTrackedOrder["status"]): BuyerDeliveryEvent[] {
  const orderDate = order.order_date || new Date().toISOString();
  const quantity = Number(order.quantity || 0);
  const baseEvents: BuyerDeliveryEvent[] = [
    {
      id: `${order.id}-placed`,
      title: "Order placed",
      description: `Your request for ${quantity || 1} item(s) was received.`,
      timestamp: orderDate,
      status: "Pending",
      isCompleted: true,
    },
    {
      id: `${order.id}-confirmed`,
      title: "Seller confirmation",
      description: `${order.provider_name || "Marketplace seller"} confirmed availability.`,
      timestamp: orderDate,
      status: "Confirmed",
      isCompleted: ["Confirmed", "Processing", "Dispatched", "In Transit", "Delivered"].includes(normalizedStatus),
    },
    {
      id: `${order.id}-processing`,
      title: "Packing and quality check",
      description: "Items are being prepared for dispatch.",
      timestamp: orderDate,
      status: "Processing",
      isCompleted: ["Processing", "Dispatched", "In Transit", "Delivered"].includes(normalizedStatus),
    },
    {
      id: `${order.id}-dispatched`,
      title: "Left the seller",
      description: "Package handed over for last-mile delivery.",
      timestamp: orderDate,
      status: "Dispatched",
      isCompleted: ["Dispatched", "In Transit", "Delivered"].includes(normalizedStatus),
    },
    {
      id: `${order.id}-transit`,
      title: "In transit",
      description: "Rider is coordinating final delivery.",
      timestamp: orderDate,
      status: "In Transit",
      isCompleted: ["In Transit", "Delivered"].includes(normalizedStatus),
    },
    {
      id: `${order.id}-delivered`,
      title: "Delivered",
      description: "Delivery completed successfully.",
      timestamp: orderDate,
      status: "Delivered",
      isCompleted: normalizedStatus === "Delivered",
    },
  ];

  if (normalizedStatus === "Cancelled") {
    return [
      ...baseEvents.slice(0, 2),
      {
        id: `${order.id}-cancelled`,
        title: "Order cancelled",
        description: order.status_reason || "This order was cancelled before delivery.",
        timestamp: orderDate,
        status: "Cancelled",
        isCompleted: true,
      },
    ];
  }

  return baseEvents;
}

function mapOrderToTrackedOrder(order: Order, recipientName?: string): BuyerTrackedOrder {
  const status = normalizeLifecycleStatus(order.status);
  const provider = buildProvider(order.provider_id, order.provider_name);
  const product = buildOrderProduct(order, provider);
  const unitPrice = Number(order.unit_price || order.total || 0);
  const quantity = Number(order.quantity || 0);
  const subtotal = Number(order.total || unitPrice * Math.max(quantity, 1));
  const address = buildAddressFromOrder(order, recipientName);
  const estimatedDeliveryAt =
    status === "Delivered" || status === "Cancelled"
      ? undefined
      : new Date(Date.now() + 1000 * 60 * 60 * 4).toISOString();

  return {
    id: String(order.id),
    order,
    orderNumber: String(order.id),
    status,
    placedAt: order.order_date || undefined,
    estimatedDeliveryAt,
    provider,
    address,
    items: [
      {
        id: `order-item-${order.id}`,
        product,
        provider,
        orderId: order.id,
        quantity: Math.max(quantity, 1),
        unitPrice,
        subtotal,
        availabilityStatus: "in_stock",
      },
    ],
    events: buildDeliveryEvents(order, status),
    progressPercent: getProgressPercent(status),
    supportThreadId: order.provider_name ? "thread-seller" : "thread-agent",
  };
}

function createMockSnapshot(userName?: string, fallbackOrders: Order[] = []): BuyerAccountSnapshot {
  const generatedOrders = fallbackOrders.length
    ? fallbackOrders
    : [
        {
          id: 3201,
          order_date: new Date().toISOString(),
          product: "Premium Hass Avocados",
          category: "Fresh Produce",
          provider_name: "Green Basket Co.",
          quantity: 3,
          unit_price: 8500,
          total: 25500,
          status: "In Transit",
          delivery_address: "Msasani Peninsula, Masaki",
          delivery_method: "Rider delivery",
        },
        {
          id: 3194,
          order_date: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
          product: "Organic Greek Yoghurt",
          category: "Dairy",
          provider_name: "Blue Dune Farms",
          quantity: 4,
          unit_price: 6200,
          total: 24800,
          status: "Delivered",
          delivery_address: "Msasani Peninsula, Masaki",
          delivery_method: "Cold chain delivery",
        },
        {
          id: 3187,
          order_date: new Date(Date.now() - 1000 * 60 * 60 * 52).toISOString(),
          product: "Wholegrain Sandwich Bread",
          category: "Bakery",
          provider_name: "Kilimo Pantry",
          quantity: 2,
          unit_price: 4800,
          total: 9600,
          status: "Confirmed",
          delivery_address: "Ohio Street, City Centre",
          delivery_method: "Store dispatch",
        },
      ];

  const providers: Record<string, Provider> = {
    greenBasket: { id: 101, name: "Green Basket Co.", verified: true, location: "Masaki, Dar es Salaam" },
    blueDune: { id: 102, name: "Blue Dune Farms", verified: true, location: "Mikocheni, Dar es Salaam" },
    kilimo: { id: 103, name: "Kilimo Pantry", verified: true, location: "City Centre, Dar es Salaam" },
    farmDirect: { id: 104, name: "Farm Direct Hub", verified: true, location: "Upanga, Dar es Salaam" },
    urbanRoast: { id: 105, name: "Urban Roast Market", verified: true, location: "Oysterbay, Dar es Salaam" },
  };

  const trackedOrders = generatedOrders.map((order) => mapOrderToTrackedOrder(order, userName));

  const addresses: BuyerAddress[] = [
    {
      id: "addr-home",
      label: "Home",
      recipientName: userName || "Customer",
      phone: "+255 710 123 456",
      line1: "Msasani Peninsula",
      line2: "Masaki",
      city: "Dar es Salaam",
      state: "Dar es Salaam",
      country: "Tanzania",
      deliveryNotes: "Security desk drop-off after 6 PM.",
      isDefault: true,
      type: "Home",
    },
    {
      id: "addr-office",
      label: "Office",
      recipientName: userName || "Customer",
      phone: "+255 713 555 221",
      line1: "Ohio Street",
      line2: "City Centre",
      city: "Dar es Salaam",
      state: "Dar es Salaam",
      country: "Tanzania",
      deliveryNotes: "Reception accepts deliveries until 5 PM.",
      type: "Office",
    },
  ];

  const preferences: BuyerPreference[] = [
    { id: "pref-1", key: "delivery-window", label: "Delivery window", value: "Evenings 16:30 - 19:00", category: "Logistics" },
    { id: "pref-2", key: "dietary-focus", label: "Dietary focus", value: "Fresh produce & low sugar", category: "Shopping" },
    { id: "pref-3", key: "budget-watch", label: "Budget watch", value: "Notify when basket exceeds TZS 80,000", category: "Budget" },
    { id: "pref-4", key: "favorite-sellers", label: "Favorite sellers", value: "Green Basket Co., Blue Dune Farms", category: "Marketplace" },
  ];

  const suggestions: BuyerSuggestion[] = [
    {
      id: "sug-1",
      title: "Restock your breakfast basket",
      description: "You bought yoghurt and bread last week. Reorder now to receive a combined delivery window.",
      reason: "Based on your recent dairy and bakery purchases",
      category: "Smart reorder",
      product: { id: 201, name: "Organic Greek Yoghurt", category: "Dairy", price: 6200, provider: providers.blueDune, provider_id: providers.blueDune.id },
      provider: providers.blueDune,
      priceHint: 6200,
      availabilityText: "Available for same-day delivery",
    },
    {
      id: "sug-2",
      title: "Switch to a lower-price avocado seller",
      description: "A nearby verified seller is offering the same grade avocados with a lower minimum order.",
      reason: "Price and distance comparison",
      category: "Savings tip",
      product: { id: 202, name: "Premium Hass Avocados", category: "Fresh Produce", price: 7900, provider: providers.farmDirect, provider_id: providers.farmDirect.id },
      provider: providers.farmDirect,
      priceHint: 7900,
      availabilityText: "7% cheaper for the next 4 hours",
    },
    {
      id: "sug-3",
      title: "Bundle pantry essentials",
      description: "Add honey and oats to qualify for free same-zone delivery this afternoon.",
      reason: "Optimized for your saved address and seller overlap",
      category: "Bundle idea",
      product: { id: 203, name: "Rolled Oats", category: "Pantry", price: 9900, provider: providers.kilimo, provider_id: providers.kilimo.id },
      provider: providers.kilimo,
      priceHint: 9900,
      availabilityText: "Free delivery when bundled",
    },
  ];

  const notifications: BuyerNotification[] = [
    {
      id: "note-1",
      title: "Rider is approaching your address",
      message: "Order #3201 is 18 minutes away. Keep your phone nearby for handoff confirmation.",
      type: "delivery",
      createdAt: new Date().toISOString(),
      isRead: false,
      actionLabel: "Track order",
      actionHref: "/app/customer",
      orderId: 3201,
      severity: "warning",
    },
    {
      id: "note-2",
      title: "Fresh price drop detected",
      message: "Farm Direct Hub lowered avocado pricing by 7% for the next 4 hours.",
      type: "promotion",
      createdAt: new Date(Date.now() - 1000 * 60 * 70).toISOString(),
      isRead: false,
      actionLabel: "View offer",
      actionHref: "/app/customer",
      severity: "success",
    },
    {
      id: "note-3",
      title: "Delivery preference applied",
      message: "Your evening delivery window will be prioritized where available.",
      type: "system",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
      isRead: true,
      severity: "info",
    },
  ];

  const chatThreads: BuyerChatThread[] = [
    {
      id: "thread-seller",
      title: "Avocado order updates",
      participantName: "Green Basket Co.",
      participantRole: "seller",
      unreadCount: 1,
      lastMessageAt: new Date(Date.now() - 1000 * 60 * 54).toISOString(),
      messages: [
        {
          id: "msg-1",
          senderId: "buyer-1",
          senderName: userName || "Customer",
          senderRole: "buyer",
          message: "Please include mostly ready-to-eat avocados if possible.",
          sentAt: new Date(Date.now() - 1000 * 60 * 85).toISOString(),
          isRead: true,
          orderId: 3201,
        },
        {
          id: "msg-2",
          senderId: "seller-101",
          senderName: "Green Basket Co.",
          senderRole: "seller",
          message: "Confirmed. We selected ripe stock and added two firmer pieces for later use.",
          sentAt: new Date(Date.now() - 1000 * 60 * 54).toISOString(),
          isRead: false,
          orderId: 3201,
        },
      ],
    },
    {
      id: "thread-agent",
      title: "Delivery coordination",
      participantName: "Support Agent Amina",
      participantRole: "agent",
      unreadCount: 0,
      lastMessageAt: new Date(Date.now() - 1000 * 60 * 22).toISOString(),
      messages: [
        {
          id: "msg-3",
          senderId: "agent-1",
          senderName: "Amina",
          senderRole: "agent",
          message: "If the rider misses you, we can redirect to reception at no extra cost.",
          sentAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
          isRead: true,
        },
        {
          id: "msg-4",
          senderId: "buyer-1",
          senderName: userName || "Customer",
          senderRole: "buyer",
          message: "Perfect, please use reception after 5 PM.",
          sentAt: new Date(Date.now() - 1000 * 60 * 22).toISOString(),
          isRead: true,
        },
      ],
    },
  ];

  const cartItems: BuyerCartItem[] = [
    {
      id: "cart-1",
      product: { id: 301, name: "Premium Hass Avocados", category: "Fresh Produce", price: 8500, provider: providers.greenBasket, provider_id: providers.greenBasket.id },
      provider: providers.greenBasket,
      quantity: 3,
      unitPrice: 8500,
      subtotal: 25500,
      availabilityStatus: "in_stock",
    },
    {
      id: "cart-2",
      product: { id: 302, name: "Wholegrain Sandwich Bread", category: "Bakery", price: 4800, provider: providers.kilimo, provider_id: providers.kilimo.id },
      provider: providers.kilimo,
      quantity: 2,
      unitPrice: 4800,
      subtotal: 9600,
      availabilityStatus: "in_stock",
    },
    {
      id: "cart-3",
      product: { id: 303, name: "Cold Brew Coffee", category: "Beverages", price: 13500, provider: providers.urbanRoast, provider_id: providers.urbanRoast.id },
      provider: providers.urbanRoast,
      quantity: 1,
      unitPrice: 13500,
      subtotal: 13500,
      availabilityStatus: "limited",
    },
  ];

  return {
    fullName: userName || "Customer",
    addresses,
    preferences,
    suggestions,
    notifications,
    chatThreads,
    trackedOrders,
    cartItems,
    recentOrders: generatedOrders,
  };
}

function getAddressSummary(address?: BuyerAddress | null) {
  if (!address) return "";
  return [address.line1, address.line2, address.city, address.state, address.country].filter(Boolean).join(", ");
}

function getOrderProductName(order: BuyerTrackedOrder) {
  return order.items?.[0]?.product?.name || order.order?.product || "Marketplace order";
}

function getOrderProviderName(order: BuyerTrackedOrder) {
  return order.provider?.name || order.order?.provider_name || "Marketplace seller";
}

function getOrderQuantity(order: BuyerTrackedOrder) {
  return order.items?.reduce((sum, item) => sum + Number(item.quantity || 0), 0) || Number(order.order?.quantity || 0);
}

function getOrderTotal(order: BuyerTrackedOrder) {
  if (order.items?.length) {
    return order.items.reduce((sum, item) => sum + Number(item.subtotal || item.unitPrice || 0), 0);
  }
  return Number(order.order?.total || 0);
}

function getEtaLabel(order: BuyerTrackedOrder) {
  if (order.status === "Delivered") return "Delivered";
  if (order.status === "Cancelled") return "Cancelled";
  return order.estimatedDeliveryAt ? formatDateTime(order.estimatedDeliveryAt) : "Today, 16:30 - 18:00";
}

function getNotificationToneClass(notification: BuyerNotification) {
  if (notification.severity === "success") return "buyer-badge buyer-badge--good";
  if (notification.severity === "warning") return "buyer-badge buyer-badge--warn";
  if (notification.severity === "error") return "buyer-badge buyer-badge--danger";
  return "buyer-badge";
}

export function CustomerDashboardPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState("");
  const [filterKeyword, setFilterKeyword] = useState("");
  const deferredFilterKeyword = useDeferredValue(filterKeyword);
  const [selectedCategory, setSelectedCategory] = useState<(typeof searchableCategories)[number]>("All");
  const [selectedAddressId, setSelectedAddressId] = useState("addr-home");
  const [notifications, setNotifications] = useState<BuyerNotification[]>([]);
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
  const [expandedNotificationId, setExpandedNotificationId] = useState<string | null>(null);
  const [visibleAlertIds, setVisibleAlertIds] = useState<string[]>([]);
  const [historyCleared, setHistoryCleared] = useState(false);

  useEffect(() => {
    if (user?.role === "user") {
      void load();
    }
  }, [user?.role]);

  async function load() {
    try {
      setError("");
      const data = await apiRequest<Order[]>("/orders/");
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      setOrders([]);
      setError(err instanceof Error ? err.message : "Failed to load customer dashboard");
    }
  }

  const snapshot = useMemo(() => createMockSnapshot(user?.name, orders), [orders, user?.name]);

  useEffect(() => {
    setNotifications(snapshot.notifications || []);
  }, [snapshot.notifications]);

  useEffect(() => {
    if (!selectedAddressId && snapshot.addresses?.[0]?.id) {
      setSelectedAddressId(snapshot.addresses[0].id);
      return;
    }
    if (selectedAddressId && !(snapshot.addresses || []).some((address) => address.id === selectedAddressId)) {
      setSelectedAddressId(snapshot.addresses?.[0]?.id || "");
    }
  }, [selectedAddressId, snapshot.addresses]);

  useEffect(() => {
    const unreadIds = notifications.filter((notification) => !notification.isRead).map((notification) => notification.id);
    setVisibleAlertIds((currentIds) => {
      const preserved = currentIds.filter((id) => unreadIds.includes(id));
      const additions = unreadIds.filter((id) => !preserved.includes(id));
      return [...preserved, ...additions];
    });
  }, [notifications]);

  useEffect(() => {
    if (!visibleAlertIds.length) return undefined;
    const timers = visibleAlertIds.map((id, index) =>
      window.setTimeout(() => {
        setVisibleAlertIds((currentIds) => currentIds.filter((currentId) => currentId !== id));
      }, 2600 + index * 500),
    );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [visibleAlertIds]);

  function markNotificationRead(id: string) {
    setNotifications((currentNotifications) =>
      currentNotifications.map((notification) =>
        notification.id === id ? { ...notification, isRead: true } : notification,
      ),
    );
  }

  function markAllNotificationsRead() {
    setNotifications((currentNotifications) =>
      currentNotifications.map((notification) => ({ ...notification, isRead: true })),
    );
  }

  function dismissAlert(id: string) {
    setVisibleAlertIds((currentIds) => currentIds.filter((currentId) => currentId !== id));
  }

  function toggleNotificationCenter() {
    setNotificationCenterOpen((current) => {
      const next = !current;
      if (next) {
        markAllNotificationsRead();
      }
      return next;
    });
  }

  function handleNotificationOpen(id: string) {
    setExpandedNotificationId((current) => (current === id ? null : id));
    markNotificationRead(id);
  }

  const productCatalog = useMemo(() => {
    return [
      {
        id: 1,
        name: "Premium Hass Avocados",
        category: "Fresh Produce",
        provider: "Green Basket Co.",
        price: 8500,
        rating: 4.8,
        imageLabel: "Avocados",
        tags: ["fresh", "fruit", "healthy"],
      },
      {
        id: 2,
        name: "Organic Greek Yoghurt",
        category: "Dairy",
        provider: "Blue Dune Farms",
        price: 6200,
        rating: 4.7,
        imageLabel: "Yoghurt",
        tags: ["protein", "breakfast", "dairy"],
      },
      {
        id: 3,
        name: "Wholegrain Sandwich Bread",
        category: "Bakery",
        provider: "Kilimo Pantry",
        price: 4800,
        rating: 4.5,
        imageLabel: "Bread",
        tags: ["bakery", "fiber", "daily"],
      },
      {
        id: 4,
        name: "Raw Forest Honey",
        category: "Pantry",
        provider: "Savannah Organics",
        price: 14000,
        rating: 4.9,
        imageLabel: "Honey",
        tags: ["pantry", "natural", "sweetener"],
      },
      {
        id: 5,
        name: "Cold Brew Coffee",
        category: "Beverages",
        provider: "Urban Roast Market",
        price: 13500,
        rating: 4.6,
        imageLabel: "Coffee",
        tags: ["coffee", "beverages", "energy"],
      },
      {
        id: 6,
        name: "Rolled Oats",
        category: "Pantry",
        provider: "Kilimo Pantry",
        price: 9900,
        rating: 4.4,
        imageLabel: "Oats",
        tags: ["pantry", "breakfast", "fiber"],
      },
    ];
  }, []);

  const filteredProducts = useMemo(() => {
    const keyword = deferredFilterKeyword.trim().toLowerCase();
    return productCatalog.filter((product) => {
      const matchesCategory = selectedCategory === "All" || product.category === selectedCategory;
      const matchesKeyword =
        !keyword ||
        product.name.toLowerCase().includes(keyword) ||
        product.provider.toLowerCase().includes(keyword) ||
        product.tags.some((tag) => tag.includes(keyword));
      return matchesCategory && matchesKeyword;
    });
  }, [deferredFilterKeyword, productCatalog, selectedCategory]);

  const comparisonRows = useMemo(() => {
    return [
      {
        product: "Premium Hass Avocados",
        offers: [
          { seller: "Green Basket Co.", price: 8500, eta: "Today 18:00", badge: "Fastest" },
          { seller: "Farm Direct Hub", price: 7900, eta: "Tomorrow 10:00", badge: "Best price" },
          { seller: "Harvest Circle", price: 8700, eta: "Today 20:00", badge: "Top rated" },
        ],
      },
      {
        product: "Organic Greek Yoghurt",
        offers: [
          { seller: "Blue Dune Farms", price: 6200, eta: "Today 17:30", badge: "Most reliable" },
          { seller: "Dairy Connect", price: 6000, eta: "Tomorrow 09:00", badge: "Budget" },
          { seller: "Urban Fresh Market", price: 6550, eta: "Today 19:00", badge: "Nearby" },
        ],
      },
      {
        product: "Wholegrain Sandwich Bread",
        offers: [
          { seller: "Kilimo Pantry", price: 4800, eta: "Today 16:45", badge: "Recommended" },
          { seller: "Bake House East", price: 4600, eta: "Tomorrow 08:30", badge: "Lowest price" },
          { seller: "Daily Loaf", price: 5000, eta: "Today 18:10", badge: "Popular" },
        ],
      },
    ];
  }, []);

  const summary = useMemo(() => {
    const trackedOrders = snapshot.trackedOrders || [];
    const activeOrders = orders.filter((order) => {
      const s = String(order.status || "").toLowerCase();
      return s !== "received" && s !== "delivered" && s !== "cancelled";
    }).length;
    const deliveredOrders = orders.filter((order) => {
      const s = String(order.status || "").toLowerCase();
      return s === "received" || s === "delivered";
    }).length;
    const spend = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const cartValue = (snapshot.cartItems || []).reduce((sum, item) => sum + Number(item.subtotal || item.unitPrice || 0), 0);

    return {
      totalOrders: orders.length,
      activeOrders,
      deliveredOrders,
      spend,
      cartValue,
      unreadNotifications: notifications.filter((notification) => !notification.isRead).length,
    };
  }, [notifications, orders, snapshot.cartItems, snapshot.trackedOrders]);

  const currentOrder = useMemo(() => {
    const trackedOrders = snapshot.trackedOrders || [];
    return trackedOrders.find((order) => order.status !== "Delivered" && order.status !== "Cancelled") || trackedOrders[0] || null;
  }, [snapshot.trackedOrders]);

  const selectedAddress = useMemo(() => {
    return (snapshot.addresses || []).find((address) => address.id === selectedAddressId) || snapshot.addresses?.[0] || null;
  }, [selectedAddressId, snapshot.addresses]);

  const liveAlerts = useMemo(() => {
    return visibleAlertIds
      .map((id) => notifications.find((notification) => notification.id === id))
      .filter((notification): notification is BuyerNotification => Boolean(notification));
  }, [notifications, visibleAlertIds]);

  if (user?.role !== "user") {
    return (
      <section className="panel">
        <h1>Customer dashboard</h1>
        <p className="muted">This dashboard is only for customer accounts.</p>
      </section>
    );
  }

  return (
    <section className="panel-stack buyer-dashboard">
      <div className="panel buyer-hero">
        <div className="buyer-hero__grid">
          <div>
            <p className="eyebrow">Buyer account</p>
            <h1>Welcome back, {snapshot.fullName || user?.name || "Customer"}</h1>
            <p className="muted">
              Track orders, compare sellers, manage delivery preferences, and discover better marketplace options from one place.
            </p>
            <div className="stat-grid hero-stats-grid">
              <article className="stat-card hero-stat-card">
                <span className="stat-label">Active Orders</span>
                <strong>{summary.activeOrders}</strong>
              </article>
              <article className="stat-card hero-stat-card">
                <span className="stat-label">Unread Updates</span>
                <strong>{summary.unreadNotifications}</strong>
              </article>
              <article className="stat-card hero-stat-card">
                <span className="stat-label">Cart Value</span>
                <strong>{formatMoney(summary.cartValue)}</strong>
              </article>
            </div>
          </div>

          <div className="buyer-card">
            <div className="buyer-card__header">
              <div>
                <p className="eyebrow">Profile snapshot</p>
                <h2>{user?.name || snapshot.fullName || "Customer"}</h2>
              </div>
              <span className="buyer-pill">{getInitials(user?.name || snapshot.fullName)}</span>
            </div>
            <div className="stat-grid customer-stats-grid">
              <article className="stat-card customer-stat-card">
                <span className="stat-label">Total Orders</span>
                <strong>{summary.totalOrders}</strong>
              </article>
              <article className="stat-card customer-stat-card">
                <span className="stat-label">Delivered</span>
                <strong>{summary.deliveredOrders}</strong>
              </article>
              <article className="stat-card customer-stat-card">
                <span className="stat-label">Total Spend</span>
                <strong>{formatMoney(summary.spend)}</strong>
              </article>
              <article className="stat-card customer-stat-card">
                <span className="stat-label">Active Orders</span>
                <strong>{summary.activeOrders}</strong>
              </article>
            </div>
            <p className="muted">{user?.email || "customer@marketplace.local"}</p>
          </div>
        </div>
      </div>

      {error ? <p className="alert error">Live orders could not be refreshed. {error}</p> : null}

      <div className="buyer-section-grid">
        <article className="panel buyer-card">
          <div className="buyer-card__header">
            <div>
              <p className="eyebrow">Address management</p>
              <h2>Saved delivery points</h2>
            </div>
            <button type="button" className="secondary-button">Add address</button>
          </div>
          <div className="buyer-address-list">
            {snapshot.addresses?.map((address) => (
              <button
                key={address.id}
                type="button"
                className="buyer-address-card"
                onClick={() => setSelectedAddressId(address.id)}
              >
                <div className="buyer-card__header">
                  <strong>{address.label}</strong>
                  {address.isDefault ? <span className="buyer-badge buyer-badge--good">Default</span> : null}
                </div>
                <p>{address.recipientName}</p>
                <p className="muted">{getAddressSummary(address)}</p>
                <p className="muted">{address.phone}</p>
                {address.deliveryNotes ? <p className="muted">{address.deliveryNotes}</p> : null}
              </button>
            ))}
          </div>
          {selectedAddress ? (
            <p className="muted">Current delivery target: {selectedAddress.label} - {getAddressSummary(selectedAddress)}</p>
          ) : (
            <p className="buyer-empty">No saved addresses yet.</p>
          )}
        </article>

        <article className="panel buyer-card">
          <div className="buyer-card__header">
            <div>
              <p className="eyebrow">Price comparison</p>
              <h2>Compare sellers before you buy</h2>
            </div>
          </div>
          <div className="table-scroll">
            <table className="buyer-compare-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Seller</th>
                  <th>Price</th>
                  <th>ETA</th>
                  <th>Signal</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) =>
                  row.offers.map((offer, index) => (
                    <tr key={`${row.product}-${offer.seller}`}>
                      {index === 0 ? <td>{row.product}</td> : <td />}
                      <td>{offer.seller}</td>
                      <td>{formatMoney(offer.price)}</td>
                      <td>{offer.eta}</td>
                      <td><span className="buyer-badge">{offer.badge}</span></td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        </article>
      </div>

      <div className="buyer-section-grid buyer-section-grid--wide">
        <article className="panel buyer-card">
          <div className="buyer-card__header">
            <div>
              <p className="eyebrow">Current order lifecycle</p>
              <h2>Live status and progress</h2>
            </div>
            {currentOrder ? <span className={getStatusTone(currentOrder.status)}>{currentOrder.status}</span> : null}
          </div>

          {currentOrder ? (
            <>
              <p>
                <strong>{getOrderProductName(currentOrder)}</strong> from {getOrderProviderName(currentOrder)}
              </p>
              <div className="buyer-progress-bar" style={{ height: '8px', background: 'var(--surface-soft)', borderRadius: '4px', overflow: 'hidden', margin: '10px 0' }}>
                <div
                  className="buyer-progress-bar__fill"
                  style={{ width: `${currentOrder.progressPercent || getProgressPercent(currentOrder.status)}%`, height: '100%', background: 'var(--brand-blue)', transition: 'width 0.3s ease' }}
                />
              </div>
              <div className="buyer-status-track">
                {lifecycleSteps.map((step) => {
                  const currentIndex = currentOrder.status === "Cancelled" ? -1 : lifecycleSteps.indexOf(currentOrder.status);
                  const done = currentIndex >= 0 && lifecycleSteps.indexOf(step) <= currentIndex;
                  return (
                    <div key={step} className={`buyer-status-step${done ? " buyer-status-step--done" : ""}`}>
                      <strong>{step}</strong>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="buyer-empty">No active order timeline available yet.</p>
          )}
        </article>

        <article className="panel buyer-card">
          <div className="buyer-card__header">
            <div>
              <p className="eyebrow">Delivery coordination</p>
              <h2>ETA and handoff planning</h2>
            </div>
          </div>
          {currentOrder ? (
            <div className="panel-stack">
              <div className="buyer-kpi">
                <span className="muted">Expected arrival</span>
                <strong>{getEtaLabel(currentOrder)}</strong>
              </div>
              <div className="buyer-kpi">
                <span className="muted">Delivery method</span>
                <strong>{currentOrder.order?.delivery_method || "Scheduled delivery"}</strong>
              </div>
              <div className="buyer-kpi">
                <span className="muted">Destination</span>
                <strong>{getAddressSummary(currentOrder.address) || selectedAddress?.label || "Primary address"}</strong>
              </div>
            </div>
          ) : (
            <p className="buyer-empty">No delivery coordination needed right now.</p>
          )}
        </article>
      </div>

      <article className="panel buyer-card">
        <div className="buyer-card__header">
          <div>
            <p className="eyebrow">Order history</p>
            <h2>Recent purchases and repeat actions</h2>
          </div>
          {!historyCleared && snapshot.trackedOrders?.length ? (
            <button 
              type="button" 
              className="secondary-button" 
              style={{ padding: '8px 16px', fontSize: '0.85rem' }}
              onClick={() => setHistoryCleared(true)}
            >
              Clear History
            </button>
          ) : historyCleared ? (
            <button 
              type="button" 
              className="secondary-button" 
              style={{ padding: '8px 16px', fontSize: '0.85rem' }}
              onClick={() => setHistoryCleared(false)}
            >
              Show History
            </button>
          ) : null}
        </div>
        <div className="buyer-history-list">
          {historyCleared ? (
            <p className="buyer-empty">Order history has been cleared. <button type="button" onClick={() => setHistoryCleared(false)} style={{ background: 'none', border: 'none', color: 'var(--brand-blue)', cursor: 'pointer', fontWeight: 600 }}>Show history</button> to view past orders.</p>
          ) : snapshot.trackedOrders?.length ? (
            snapshot.trackedOrders.map((order) => (
              <div key={order.id} className="buyer-history-item" style={{ padding: '20px', borderBottom: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong>#{order.orderNumber || order.id} · {getOrderProductName(order)}</strong>
                    <p className="muted" style={{ margin: '4px 0' }}>
                      {getOrderProviderName(order)} · {formatDate(order.placedAt)} · Qty {getOrderQuantity(order)}
                    </p>
                    <strong style={{ display: 'block', marginTop: '8px' }}>Total {formatMoney(getOrderTotal(order))}</strong>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className={getStatusTone(order.status)} style={{ display: 'inline-block', marginBottom: '10px' }}>{order.status}</span>
                    <div className="buyer-inline-actions" style={{ display: 'flex', gap: '8px' }}>
                      <button type="button" className="secondary-button" style={{ padding: '6px 12px' }}>Reorder</button>
                      {order.status !== "Delivered" && order.status !== "Cancelled" ? (
                        <button type="button" className="secondary-button" style={{ padding: '6px 12px', color: 'var(--danger)' }}>Cancel</button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="buyer-empty">No order history yet.</p>
          )}
        </div>
      </article>
    </section>
  );
}
