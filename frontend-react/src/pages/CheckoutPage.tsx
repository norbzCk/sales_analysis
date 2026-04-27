import { useEffect, useState, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  ShoppingBag, 
  Truck, 
  CreditCard, 
  ShieldCheck, 
  ArrowLeft,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { apiRequest } from "../lib/http";
import { useAuth } from "../features/auth/AuthContext";
import { PageIntro, SectionCard, InlineNotice } from "../components/ui/PageSections";
import type { Product, PaymentMethod } from "../types/domain";

function formatMoney(value?: number) {
  return `TZS ${Number(value || 0).toLocaleString()}`;
}

export function CheckoutPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const productId = params.get("product");
  const quantity = Number(params.get("quantity") || 1);
  
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  
  const [formData, setFormData] = useState({
    delivery_address: user?.address || "",
    delivery_phone: user?.phone || "",
    delivery_notes: "",
    delivery_method: "Standard",
    payment_method: "",
    payment_phone: user?.phone || "",
  });

  const [success, setSuccess] = useState<{orderId: number; transactionId?: string} | null>(null);

  useEffect(() => {
    if (!productId) {
      navigate("/");
      return;
    }
    void load();
  }, [productId]);

  async function load() {
    try {
      const [productData, methodsData] = await Promise.all([
        apiRequest<Product>(`/products/${productId}`),
        apiRequest<{ payment_methods: PaymentMethod[] }>("/payments/methods/public"),
      ]);
      setProduct(productData);
      setMethods(methodsData.payment_methods || []);
      if (methodsData.payment_methods?.length) {
        setFormData(prev => ({ ...prev, payment_method: methodsData.payment_methods[0].id }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load checkout data");
    } finally {
      setLoading(false);
    }
  }

  const total = useMemo(() => {
    if (!product) return 0;
    return (product.price || 0) * quantity;
  }, [product, quantity]);

  async function handleConfirmOrder() {
    if (!product) return;
    setSubmitting(true);
    setError("");
    
    try {
      // 1. Create Order
      const order = await apiRequest<{ id: number }>("/orders/", {
        method: "POST",
        body: {
          product_id: product.id,
          quantity,
          delivery_address: formData.delivery_address,
          delivery_phone: formData.delivery_phone,
          delivery_notes: formData.delivery_notes,
          delivery_method: formData.delivery_method,
        }
      });

      // 2. Initiate Payment
      let transactionId = "";
      if (["mpesa", "airtel_money", "tigopesa"].includes(formData.payment_method)) {
        const payResponse = await apiRequest<{ transaction_id: string }>(
          `/payments/mobile-money/stk-push?phone_number=${encodeURIComponent(formData.payment_phone)}&amount=${total}&order_id=${order.id}&provider=${encodeURIComponent(formData.payment_method)}`,
          { method: "POST" }
        );
        transactionId = payResponse.transaction_id;
      } else {
        const payResponse = await apiRequest<{ transaction_id: string }>("/payments/initiate", {
          method: "POST",
          body: {
            order_id: order.id,
            amount: total,
            payment_method: formData.payment_method,
            phone_number: formData.payment_phone || null,
          }
        });
        transactionId = payResponse.transaction_id;
      }

      setSuccess({ orderId: order.id, transactionId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process order. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6">
      <div className="w-12 h-12 border-4 border-brand/20 border-t-brand rounded-full animate-spin" />
      <p className="text-xs font-black uppercase tracking-widest text-text-muted">Preparing Checkout...</p>
    </div>
  );

  if (success) {
    return (
      <div className="max-w-2xl mx-auto py-20 px-4 text-center space-y-8">
        <div className="w-24 h-24 bg-emerald-500/10 text-emerald-500 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-xl">
          <CheckCircle2 size={48} />
        </div>
        <div className="space-y-4">
          <h1 className="text-4xl font-display font-black text-text tracking-tight uppercase">Order Confirmed</h1>
          <p className="text-text-muted font-medium text-lg">
            Your order <span className="text-text font-black">#{success.orderId}</span> has been successfully placed.
          </p>
          {success.transactionId && (
            <p className="text-sm text-text-muted">
              Transaction ID: <span className="font-mono font-bold text-brand">{success.transactionId}</span>
            </p>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-8">
          <button onClick={() => navigate("/app/orders")} className="btn-primary h-14">Track My Orders</button>
          <button onClick={() => navigate("/")} className="btn-secondary h-14">Return to Home</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-12 px-4 space-y-12">
      <div className="flex items-center justify-between">
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm font-bold text-text-muted hover:text-brand transition-colors group"
        >
          <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
          Back to Product
        </button>
      </div>

      <PageIntro
        eyebrow="Checkout"
        title="Complete Your Order"
        description="Verify your delivery details and choose a payment method to proceed with your purchase."
      />

      {error && <InlineNotice tone="error">{error}</InlineNotice>}

      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr,1fr] gap-12 items-start">
        <div className="space-y-8">
          <SectionCard title="Delivery Details" description="Where should we send your items?">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <label className="col-span-full space-y-2">
                <span className="text-[11px] font-black uppercase tracking-widest text-text-muted">Shipping Address</span>
                <input 
                  className="modern-input h-14" 
                  value={formData.delivery_address}
                  onChange={e => setFormData(p => ({...p, delivery_address: e.target.value}))}
                  placeholder="Street, Building, Area, City"
                  required
                />
              </label>
              <label className="space-y-2">
                <span className="text-[11px] font-black uppercase tracking-widest text-text-muted">Contact Phone</span>
                <input 
                  className="modern-input h-14" 
                  value={formData.delivery_phone}
                  onChange={e => setFormData(p => ({...p, delivery_phone: e.target.value}))}
                  placeholder="+255..."
                  required
                />
              </label>
              <label className="space-y-2">
                <span className="text-[11px] font-black uppercase tracking-widest text-text-muted">Delivery Method</span>
                <select 
                  className="modern-input h-14 appearance-none"
                  value={formData.delivery_method}
                  onChange={e => setFormData(p => ({...p, delivery_method: e.target.value}))}
                >
                  <option value="Standard">Standard Delivery (2-3 days)</option>
                  <option value="Express">Express Delivery (Next Day)</option>
                  <option value="Pickup">Store Pickup (Free)</option>
                </select>
              </label>
              <label className="col-span-full space-y-2">
                <span className="text-[11px] font-black uppercase tracking-widest text-text-muted">Additional Notes (Optional)</span>
                <textarea 
                  className="modern-input py-4 min-h-[100px] resize-none"
                  value={formData.delivery_notes}
                  onChange={e => setFormData(p => ({...p, delivery_notes: e.target.value}))}
                  placeholder="Special instructions for delivery..."
                />
              </label>
            </div>
          </SectionCard>

          <SectionCard title="Payment Method" description="Choose how you would like to pay.">
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {methods.map(method => (
                  <button
                    key={method.id}
                    onClick={() => setFormData(p => ({...p, payment_method: method.id}))}
                    className={`flex items-center gap-4 p-5 rounded-2xl border-2 transition-all text-left ${
                      formData.payment_method === method.id 
                        ? 'border-brand bg-brand/5 ring-1 ring-brand/20' 
                        : 'border-border bg-surface hover:border-brand/30'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${formData.payment_method === method.id ? 'bg-brand text-white' : 'bg-surface-soft text-text-muted'}`}>
                      {method.type === 'mobile_money' ? <ShoppingBag size={20} /> : <CreditCard size={20} />}
                    </div>
                    <div>
                      <p className="font-black text-sm text-text">{method.name}</p>
                      <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{method.type.replace('_', ' ')}</p>
                    </div>
                  </button>
                ))}
              </div>

              {["mpesa", "airtel_money", "tigopesa"].includes(formData.payment_method) && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-6 bg-brand/5 rounded-2xl border border-brand/10 space-y-4"
                >
                  <div className="flex items-center gap-2 text-brand">
                    <ShieldCheck size={18} />
                    <span className="text-xs font-black uppercase tracking-widest">Mobile Money Secure Checkout</span>
                  </div>
                  <label className="block space-y-2">
                    <span className="text-[11px] font-black uppercase tracking-widest text-text-muted">Enter {formData.payment_method.toUpperCase()} Number</span>
                    <input 
                      className="modern-input h-12 bg-white" 
                      value={formData.payment_phone}
                      onChange={e => setFormData(p => ({...p, payment_phone: e.target.value}))}
                      placeholder="+255..."
                    />
                  </label>
                  <p className="text-[10px] font-medium text-text-muted italic">You will receive a prompt on your phone to authorize the payment of {formatMoney(total)}.</p>
                </motion.div>
              )}
            </div>
          </SectionCard>
        </div>

        <div className="space-y-8 lg:sticky lg:top-24">
          <SectionCard title="Order Summary">
            <div className="space-y-6">
              <div className="flex gap-4 p-4 rounded-2xl bg-surface-soft border border-border">
                <div className="w-20 h-20 rounded-xl overflow-hidden bg-white shrink-0">
                  <img 
                    src={product ? (product.image_url?.startsWith('http') ? product.image_url : `${env.apiBase}${product.image_url}`) : ''} 
                    alt={product?.name} 
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <h4 className="font-black text-sm text-text truncate">{product?.name}</h4>
                  <p className="text-xs font-bold text-text-muted mt-1">{quantity} x {formatMoney(product?.price)}</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-brand mt-2">{product?.category}</p>
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t border-border">
                <div className="flex justify-between text-sm font-medium text-text-muted">
                  <span>Subtotal</span>
                  <span>{formatMoney(total)}</span>
                </div>
                <div className="flex justify-between text-sm font-medium text-text-muted">
                  <span>Delivery Fee</span>
                  <span>{formData.delivery_method === 'Express' ? formatMoney(5000) : formatMoney(2000)}</span>
                </div>
                <div className="flex justify-between pt-4 border-t border-border">
                  <span className="text-lg font-black text-text uppercase tracking-tight">Total</span>
                  <span className="text-2xl font-display font-black text-brand tracking-tight">
                    {formatMoney(total + (formData.delivery_method === 'Express' ? 5000 : 2000))}
                  </span>
                </div>
              </div>

              <button 
                onClick={handleConfirmOrder}
                disabled={submitting || !formData.payment_method || !formData.delivery_address}
                className="btn-primary w-full h-16 shadow-brand/40 group active:scale-95 disabled:opacity-50"
              >
                {submitting ? (
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    Processing...
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    Confirm & Pay
                    <ArrowLeft size={18} className="rotate-180 group-hover:translate-x-1 transition-transform" />
                  </div>
                )}
              </button>

              <div className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-text-muted">
                <ShieldCheck size={14} className="text-emerald-500" />
                Secure Escrow Protection Enabled
              </div>
            </div>
          </SectionCard>

          <div className="p-6 bg-amber-500/5 rounded-[2rem] border border-amber-500/10 flex gap-4">
            <AlertCircle className="text-amber-500 shrink-0" size={20} />
            <div className="space-y-1">
              <p className="text-xs font-black text-text uppercase tracking-tight">Buyer Protection</p>
              <p className="text-[10px] font-medium text-text-muted leading-relaxed">
                Your payment is held in escrow until you confirm receipt of the item. Verified sellers only.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
