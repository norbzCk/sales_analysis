import { useEffect, useState, MouseEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiRequest } from "../lib/http";
import { useAuth } from "../features/auth/AuthContext";
import { useCart } from "../features/auth/CartContext";
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
  const { addToCart, setIsOpen } = useCart();
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
    navigate(`/app/orders?product=${product?.id || productId}&quantity=${quantity}`);
  }

  function handleImageMouseMove(e: MouseEvent<HTMLImageElement>) {
    if (!zoom) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setMousePosition({ x, y });
  }

  if (loading) return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center space-y-4">
      <div className="w-12 h-12 border-4 border-brand/20 border-t-brand rounded-full animate-spin" />
      <p className="font-bold text-slate-400 italic text-lg uppercase tracking-widest">Loading Premium Specs...</p>
    </div>
  );

  if (error || !product) return (
    <div className="min-h-[60vh] flex items-center justify-center p-8">
      <div className="max-w-md w-full glass-card p-12 text-center space-y-6">
        <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mx-auto">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-2xl font-display font-black text-slate-900 uppercase tracking-tight">Product Not Found</h2>
        <p className="text-slate-500 font-medium">The item you're looking for might have been moved or is no longer available.</p>
        <button onClick={() => navigate('/app/products')} className="btn-primary w-full">Back to Marketplace</button>
      </div>
    </div>
  );

  const imageUrl = resolveImageUrl(product.image_url);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 lg:p-12 animate-soft-enter">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 lg:gap-20 items-start">
        {/* Left: Premium Image Showcase */}
        <div className="space-y-6 group">
          <div 
            className="relative aspect-square md:aspect-[4/5] rounded-[24px] md:rounded-[48px] overflow-hidden bg-white shadow-2xl border border-slate-100 cursor-zoom-in group-hover:shadow-brand/10 transition-shadow duration-500"
            onClick={() => setShowLightbox(true)}
          >
            <img 
              src={imageUrl} 
              alt={product.name} 
              className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" 
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <div className="absolute bottom-6 md:bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3 px-5 md:px-6 py-2.5 md:py-3 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-4 group-hover:translate-y-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 md:h-5 md:w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="text-xs md:text-sm font-bold text-white uppercase tracking-widest">Click to Zoom</span>
            </div>
            
            <div className="absolute top-6 md:top-8 left-6 md:left-8">
              <span className="px-4 md:px-5 py-1.5 md:py-2 bg-brand/90 backdrop-blur-md text-white rounded-xl md:rounded-2xl text-[10px] md:text-xs font-black uppercase tracking-widest border border-white/20 shadow-lg">
                {product.category || "Premium Listing"}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Immersive Product Info */}
        <div className="space-y-8 md:space-y-12 py-2 md:py-4">
          <div className="space-y-4 md:space-y-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-brand/10 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 md:h-3.5 md:w-3.5 text-brand" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-[9px] md:text-[11px] font-black uppercase tracking-[0.2em] text-brand">Verified SokoLnk Listing</span>
              </div>
              <h1 className="text-3xl md:text-5xl lg:text-6xl font-display font-black text-slate-900 leading-tight tracking-tight">
                {product.name}
              </h1>
            </div>

            <div className="flex items-center gap-4 md:gap-6">
              <span className="text-2xl md:text-3xl lg:text-4xl font-display font-black text-slate-900 tracking-tight">
                {formatMoney(product.price)}
              </span>
              <div className="h-6 md:h-8 w-px bg-slate-200" />
              <div className="space-y-0.5">
                <span className={`text-[9px] md:text-[10px] font-black uppercase tracking-widest block ${product.stock && product.stock > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {product.stock && product.stock > 0 ? 'In Stock' : 'Out of Stock'}
                </span>
                <span className="text-xs md:text-sm font-bold text-slate-400">{product.stock || 0} Units</span>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">About this Product</h3>
            <p className="text-lg text-slate-600 font-medium leading-relaxed max-w-2xl">
              {product.description || "Crafted for quality and reliability, this premium marketplace offering meets all standard specifications for modern trade."}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-8 border-y border-slate-100">
            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Merchant Details</h4>
              <div className="flex items-center gap-4 group">
                <div className="w-14 h-14 rounded-2xl bg-brand/5 flex items-center justify-center text-brand font-black text-xl border border-brand/10 transition-colors group-hover:bg-brand group-hover:text-white">
                  {(product.seller_name || "S")[0].toUpperCase()}
                </div>
                <div>
                  <p className="font-display font-black text-slate-900 group-hover:text-brand transition-colors">{product.seller_name || "Independent Seller"}</p>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Verified Supplier</p>
                </div>
              </div>
              {product.seller?.badges?.length ? (
                <div className="flex flex-wrap gap-2 pt-2">
                  {product.seller.badges.map((badge) => (
                    <span key={badge.id} className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-[9px] font-black uppercase tracking-widest border border-emerald-100">
                      {badge.label}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Fulfillment Model</h4>
              <ul className="space-y-3">
                {[
                  "Secure Escrow Payments",
                  "Verified Carrier Routing",
                  "Direct Sourcing Verification"
                ].map((item, idx) => (
                  <li key={idx} className="flex items-center gap-3 text-sm font-bold text-slate-700">
                    <div className="w-5 h-5 rounded-full bg-brand/10 flex items-center justify-center shrink-0 text-brand">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="space-y-8 pt-4">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="flex items-center bg-slate-100 rounded-[20px] p-1 border-2 border-transparent focus-within:border-brand/20 transition-all">
                <button 
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  className="w-12 h-12 flex items-center justify-center text-slate-500 hover:text-brand transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" />
                  </svg>
                </button>
                <div className="w-16 text-center font-display font-black text-xl text-slate-900">{quantity}</div>
                <button 
                  onClick={() => setQuantity(q => Math.min(product.stock || 100, q + 1))}
                  className="w-12 h-12 flex items-center justify-center text-slate-500 hover:text-brand transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>

              <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button 
                  className="btn-primary !py-5 shadow-brand/30 w-full"
                  disabled={submitting || !product.stock || product.stock <= 0}
                  onClick={handleOrder}
                >
                  {submitting ? "Processing..." : "Express Checkout"}
                </button>
                <button 
                  className="px-8 py-5 bg-slate-900 text-white font-bold rounded-2xl hover:bg-brand transition-all shadow-xl active:scale-95 disabled:opacity-30 w-full"
                  disabled={!product.stock || product.stock <= 0}
                  onClick={() => {
                    addToCart({
                      id: product.id,
                      name: product.name || "Product",
                      price: product.price || 0,
                      image_url: product.image_url,
                      seller_id: product.seller_id,
                      seller_name: product.seller_name || product.seller?.business_name || null,
                      seller_area: product.seller?.area || null,
                      seller_region: product.seller?.region || null,
                    });
                    setIsOpen(true);
                  }}
                >
                  Add to Cart
                </button>
              </div>
            </div>
            
            <div className="flex items-center justify-center gap-4 text-slate-400 font-bold text-xs uppercase tracking-[0.1em]">
              <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.954 0 0112 2.944a11.955 11.954 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Secure Fulfillment
              </div>
              <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
              <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Real-time Tracking
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox / Zoom Overlay */}
      <Modal isOpen={showLightbox} onClose={() => setShowLightbox(false)} title={product.name}>
        <div className="space-y-8 p-4">
          <div 
            className={`relative overflow-hidden rounded-[32px] bg-slate-50 cursor-crosshair group ${zoom ? 'h-[70vh]' : 'h-auto'}`}
            onMouseEnter={() => setZoom(true)}
            onMouseLeave={() => setZoom(false)}
            onMouseMove={handleImageMouseMove}
          >
            <img 
              src={imageUrl} 
              alt={product.name}
              className={`w-full h-full object-contain transition-transform duration-200 ${zoom ? 'scale-[2.5]' : 'scale-100'}`}
              style={zoom ? { transformOrigin: `${mousePosition.x}% ${mousePosition.y}%` } : undefined}
            />
            {!zoom && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900/5 transition-opacity opacity-0 group-hover:opacity-100">
                <span className="px-6 py-3 bg-white/90 backdrop-blur-md rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl">Move Mouse to Zoom</span>
              </div>
            )}
          </div>
          <div className="flex justify-between items-center px-4">
            <div className="space-y-1">
              <h4 className="font-display font-black text-slate-900 uppercase tracking-tight">{product.name}</h4>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none">Ultra-High Definition Asset View</p>
            </div>
            <button onClick={() => setShowLightbox(false)} className="px-8 py-3 bg-slate-100 text-slate-900 font-bold rounded-xl hover:bg-slate-200 transition-all">Close Viewer</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
