import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useCart } from "../auth/CartContext";
import { apiRequest } from "../../lib/http";
import type { CartOptimization } from "../../types/domain";

function formatMoney(value?: number) {
  return `TSh ${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function CartSidebar() {
  const { cart, isOpen, removeFromCart, clearCart, cartTotal, setIsOpen } = useCart();
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [optimization, setOptimization] = useState<CartOptimization | null>(null);

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

  if (!isOpen) return null;

  const handleMakeOrder = () => {
    if (!token || !user) {
      navigate("/login");
      return;
    }
    navigate("/app/orders");
    setIsOpen(false);
  };

  return (
    <>
      <div 
        className="cart-overlay"
        onClick={() => setIsOpen(false)}
      />
      <div className="cart-sidebar">
        <div className="cart-header">
          <h3>Shopping Cart ({cart.length})</h3>
          <button className="cart-close" onClick={() => setIsOpen(false)}>×</button>
        </div>
        
        <div className="cart-items">
          {cart.length === 0 ? (
            <p className="cart-empty">Your cart is empty</p>
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
                  <div className="cart-item-qty">Qty: {item.qty}</div>
                </div>
                <button 
                  className="cart-item-remove"
                  onClick={() => removeFromCart(item.id)}
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>

        {optimization?.recommendations?.length ? (
          <div className="cart-optimization-card">
            <div className="cart-optimization-card__header">
              <strong>Cart optimization</strong>
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

        {cart.length > 0 && (
          <div className="cart-footer">
            <div className="cart-total">
              <span>Total:</span>
              <span className="cart-total-amount">{formatMoney(cartTotal)}</span>
            </div>
            <button className="btn-make-order" onClick={handleMakeOrder}>
              Add Delivery Details
            </button>
            <button className="btn-clear-cart" onClick={clearCart}>
              Clear Cart
            </button>
          </div>
        )}
      </div>
    </>
  );
}
