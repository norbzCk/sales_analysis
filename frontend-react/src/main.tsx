import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./app/App";
import { GlobalAIAssistant } from "./components/GlobalAIAssistant";
import { AuthProvider } from "./features/auth/AuthContext";
import { AIAssistantProvider } from "./features/ai/AIAssistantContext";
import { CartProvider } from "./features/auth/CartContext";
import { ThemeProvider } from "./features/auth/ThemeContext";
import { CartSidebar } from "./features/cart/CartSidebar";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <AIAssistantProvider>
            <CartProvider>
              <App />
              <CartSidebar />
              <GlobalAIAssistant />
            </CartProvider>
          </AIAssistantProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>,
);
