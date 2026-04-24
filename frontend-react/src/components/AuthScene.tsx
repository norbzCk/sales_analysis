import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { BrandMark } from "./BrandMark";

export function AuthScene({
  eyebrow,
  title,
  description,
  bullets,
  links,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  bullets: string[];
  links: Array<{ to: string; label: string }>;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-surface-bg flex items-center justify-center p-4 md:p-8 selection:bg-brand/20">
      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 bg-white rounded-[40px] shadow-2xl overflow-hidden animate-soft-enter">
        {/* Left Side: Branded Content */}
        <aside className="relative hidden lg:flex flex-col p-12 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 to-brand-strong" />
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)', backgroundSize: '32px 32px' }} />
          
          <div className="relative z-10 flex flex-col h-full">
            <BrandMark subtitle="Powering modern trade" />
            
            <div className="mt-16 space-y-4">
              <span className="inline-block px-3 py-1 rounded-full bg-white/10 text-white text-[10px] font-black uppercase tracking-widest border border-white/10 mb-2">
                {eyebrow}
              </span>
              <h1 className="text-4xl xl:text-5xl font-display font-extrabold text-white leading-tight tracking-tight">
                {title}
              </h1>
              <p className="text-white/70 text-lg font-medium leading-relaxed max-w-md">
                {description}
              </p>
            </div>

            <div className="mt-12 space-y-6">
              <h2 className="text-white font-bold text-sm uppercase tracking-widest opacity-40">Key Advantages</h2>
              <ul className="grid gap-4">
                {bullets.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-white/90 font-bold group">
                    <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center shrink-0 border border-white/10 group-hover:bg-brand transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-auto pt-12 flex flex-wrap gap-6 border-t border-white/10">
              {links.map((item) => (
                <Link 
                  key={item.to} 
                  to={item.to}
                  className="text-xs font-black uppercase tracking-widest text-white/40 hover:text-white transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </aside>

        {/* Right Side: Auth Form */}
        <div className="p-8 md:p-16 lg:p-20 flex flex-col justify-center">
          <div className="lg:hidden mb-12 flex justify-center">
            <div className="px-6 py-3 bg-brand rounded-2xl shadow-xl">
              <BrandMark subtitle="" />
            </div>
          </div>
          <div className="max-w-md mx-auto w-full">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
