import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useCart } from "../auth/CartContext";
import { apiRequest } from "../../lib/http";
import type { CartOptimization } from "../../types/domain";

function formatMoney(value?: number) {
  return `TSh ${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function CartSidebar() {
  const { cart, isOpen, removeFromCart, updateQuantity, clearCart, cartCount, cartTotal, setIsOpen } = useCart();
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [optimization, setOptimization] = useState<CartOptimization | null>(null);

  const canShowCartUi =
    location.pathname === "/" ||
    location.pathname.startsWith("/product/") ||
    location.pathname.startsWith("/app/products") ||
    location.pathname.startsWith("/app/orders") ||
    location.pathname.startsWith("/app/customer");

  useEffect(() => {
    let cancelled = false;
    async function loadOptimization() {
      if (!cart.length) {
        setOptimization(null);
        return;
      }
      try {
        const data = await apiRequest<CartOptimization>("/products/cart-optimization", {
          method: "POST",
          auth: false,
          body: {
            items: cart.map((item) => ({
              product_id: item.id,
              quantity: item.qty,
            })),
          },
        });
        if (!cancelled) setOptimization(data);
      } catch {
        if (!cancelled) setOptimization(null);
      }
    }

    void loadOptimization();
    return () => {
      cancelled = true;
    };
  }, [cart]);

  const handleMakeOrder = () => {
    if (!token || !user) {
      navigate("/login");
      return;
    }
    navigate("/app/orders");
    setIsOpen(false);
  };

  const shouldRenderLauncher = canShowCartUi && cartCount > 0;
  const shouldRenderDrawer = canShowCartUi && isOpen;

  return (
    <>
      {shouldRenderLauncher ? (
        <button className="cart-launcher" onClick={() => setIsOpen(true)} aria-label="Open draft cart">
          <span className="cart-launcher__icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 4h2l2.2 10.2a1 1 0 00.98.8h8.84a1 1 0 00.98-.8L21 7H7" />
              <circle cx="10" cy="19" r="1.4" />
              <circle cx="18" cy="19" r="1.4" />
            </svg>
          </span>
          <span className="cart-launcher__copy">
            <strong>Draft Cart</strong>
            <span>{cartCount} item(s)</span>
          </span>
          <span className="cart-launcher__total">{formatMoney(cartTotal)}</span>
        </button>
      ) : null}

      {shouldRenderDrawer ? (
        <>
          <div className="cart-overlay" onClick={() => setIsOpen(false)} />
          <aside className="cart-sidebar" aria-label="Draft cart sidebar">
            <div className="cart-header">
              <div className="cart-header__copy">
                <p className="eyebrow">Draft orders</p>
                <h3>Your draft cart</h3>
                <p className="muted">Products added here stay ready until you move to ordering and delivery details.</p>
              </div>
              <button className="cart-close" onClick={() => setIsOpen(false)} aria-label="Close draft cart">×</button>
            </div>
            
            <div className="cart-items">
              {cart.length === 0 ? (
                <div className="cart-empty">
                  <strong>No draft items yet</strong>
                  <p>When a customer adds a product, it will appear here as a draft order ready for checkout.</p>
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.id} className="cart-item">
                    <img
                      src={item.image_url || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=200&q=80"}
                      alt={item.name}
                      className="cart-item-img"
                    />
                    <div className="cart-item-info">
                      <div className="cart-item-name">{item.name}</div>
                      <div className="cart-item-price">{formatMoney(item.price)}</div>
                      <div className="cart-item-meta">{item.seller_name || "Marketplace seller"}</div>
                      <div className="cart-item-controls">
                        <button className="cart-qty-btn" onClick={() => updateQuantity(item.id, item.qty - 1)} aria-label="Decrease quantity">-</button>
                        <span className="cart-item-qty">Qty {item.qty}</span>
                        <button className="cart-qty-btn" onClick={() => updateQuantity(item.id, item.qty + 1)} aria-label="Increase quantity">+</button>
                      </div>
                    </div>
                    <button className="cart-item-remove" onClick={() => removeFromCart(item.id)} aria-label={`Remove ${item.name}`}>
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>

            {optimization?.recommendations?.length ? (
              <div className="cart-optimization-card">
                <div className="cart-optimization-card__header">
                  <strong>Delivery optimization</strong>
                  <span>{formatMoney(optimization.summary.estimated_savings)}</span>
                </div>
                <p className="muted">
                  Group nearby sellers to reduce delivery spend from {formatMoney(optimization.summary.separate_delivery_fee)} to{" "}
                  {formatMoney(optimization.summary.optimized_delivery_fee)}.
                </p>
                {optimization.recommendations.slice(0, 2).map((group) => (
                  <div key={group.id} className="cart-optimization-group">
                    <strong>{group.title}</strong>
                    <p className="muted">{group.message}</p>
                  </div>
                ))}
              </div>
            ) : null}

            {cart.length > 0 ? (
              <div className="cart-footer">
                <div className="cart-total">
                  <span>Draft total</span>
                  <span className="cart-total-amount">{formatMoney(cartTotal)}</span>
                </div>
                <button className="btn-make-order" onClick={handleMakeOrder}>
                  Continue to order details
                </button>
                <button className="btn-clear-cart" onClick={clearCart}>
                  Clear drafts
                </button>
              </div>
            ) : null}
          </aside>
        </>
      ) : null}
    </>
  );
}
