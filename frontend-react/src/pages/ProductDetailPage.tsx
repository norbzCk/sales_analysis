import { useEffect, useState, MouseEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiRequest } from "../lib/http";
import { useAuth } from "../features/auth/AuthContext";
import { Modal } from "../components/Modal";
import type { Product } from "../types/domain";
import { env } from "../config/env";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80";

function formatMoney(value?: number) {
  return `TZS ${Number(value || 0).toLocaleString()}`;
}

function resolveImageUrl(url?: string | null) {
  const raw = String(url || "").trim();
  if (!raw) return FALLBACK_IMAGE;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/")) return `${env.apiBase}${raw}`;
  return `${env.apiBase}/${raw.replace(/^\/+/, "")}`;
}

export function ProductDetailPage() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    void load();
  }, [productId]);

  async function load() {
    if (!productId) return;
    setLoading(true);
    try {
      const data = await apiRequest<Product>(`/products/${productId}`);
      setProduct(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Product not found");
    } finally {
      setLoading(false);
    }
  }

  async function handleOrder() {
    if (!user) {
      navigate("/login", { state: { from: `/product/${productId}` } });
      return;
    }
    
    if (user.role !== "user") {
      alert("Only customers can place orders.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        product_id: product?.id,
        quantity: quantity,
        delivery_address: "Primary delivery address",
        delivery_phone: "0700 000 000",
        delivery_method: "Standard",
        order_date: new Date().toISOString()
      };
      
      await apiRequest("/orders/", { method: "POST", body: payload });
      alert("Order placed successfully! Please proceed to payments once confirmed.");
      navigate("/app/orders");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to place order");
    } finally {
      setSubmitting(false);
    }
  }

  function handleImageMouseMove(e: MouseEvent<HTMLImageElement>) {
    if (!zoom) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setMousePosition({ x, y });
  }

  if (loading) return <div className="panel">Loading product details...</div>;
  if (error || !product) return <div className="panel alert error">{error || "Product not found"}</div>;

  const imageUrl = resolveImageUrl(product.image_url);

  return (
    <div className="product-detail-page">
      <div className="product-detail-image-section">
        <div className="image-zoom-container" onClick={() => setShowLightbox(true)}>
          <img 
            src={imageUrl} 
            alt={product.name} 
            className="product-detail-main-img" 
          />
          <div className="image-zoom-hint">
            <span>Click to enlarge</span>
          </div>
        </div>
      </div>

      <div className="product-detail-info">
        <div className="product-detail-header">
          <p className="eyebrow">{product.category || "General"}</p>
          <h1>{product.name}</h1>
          <div className="product-detail-price">{formatMoney(product.price)}</div>
        </div>

        <p className="product-detail-desc">{product.description || "No detailed description provided."}</p>

        <div className="product-detail-meta">
          <div className="meta-item">
            <label>Seller</label>
            <span>{product.seller_name || "Independent Seller"}</span>
          </div>
          <div className="meta-item">
            <label>Stock</label>
            <span className={product.stock && product.stock > 0 ? "ok" : "danger"}>
              {product.stock && product.stock > 0 ? `${product.stock} available` : "Out of stock"}
            </span>
          </div>
        </div>

        <div className="order-actions">
          <div className="order-quantity-selector">
            <button className="quantity-btn" onClick={() => setQuantity(q => Math.max(1, q - 1))}>−</button>
            <span className="quantity-display">{quantity}</span>
            <button className="quantity-btn" onClick={() => setQuantity(q => Math.min(product.stock || 100, q + 1))}>+</button>
          </div>
          
          <button 
            className="primary-button" 
            style={{ width: '100%', height: '56px' }}
            disabled={submitting || !product.stock || product.stock <= 0}
            onClick={handleOrder}
          >
            {submitting ? "Placing Order..." : "Confirm & Place Order"}
          </button>
          
          <p className="muted" style={{ textAlign: 'center', fontSize: '0.85rem' }}>
            Payments are required once the seller confirms your order.
          </p>
        </div>
      </div>

      <Modal isOpen={showLightbox} onClose={() => setShowLightbox(false)} title={product.name || "Product Image"}>
        <div className="lightbox-container">
          <div 
            className={`lightbox-image-wrapper ${zoom ? 'zoomed' : ''}`}
            onMouseEnter={() => setZoom(true)}
            onMouseLeave={() => setZoom(false)}
            onMouseMove={handleImageMouseMove}
          >
            <img 
              src={imageUrl} 
              alt={product.name}
              className="lightbox-image"
              style={zoom ? { transformOrigin: `${mousePosition.x}% ${mousePosition.y}%` } : undefined}
            />
          </div>
          <div className="lightbox-controls">
            <button 
              className="secondary-button" 
              onClick={() => setZoom(!zoom)}
            >
              {zoom ? "Disable Zoom" : "Enable Zoom"}
            </button>
            <p className="muted">Move your mouse over the image to zoom in</p>
          </div>
        </div>
      </Modal>
    </div>
  );
}