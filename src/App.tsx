import { useEffect } from "react";
import { Routes, Route, useLocation, Navigate } from "react-router";
import { Toaster } from "@/components/ui/sonner";
import Home from "./pages/Home";
import Catalog from "./pages/Catalog";
import BookPage from "./pages/BookPage";
import CartPage from "./pages/CartPage";
import OrderSuccess from "./pages/OrderSuccess";
import Track from "./pages/Track";
import Account from "./pages/Account";
import Favorites from "./pages/Favorites";
import Wholesale from "./pages/Wholesale";
import InfoPage from "./pages/InfoPage";
import Contacts from "./pages/Contacts";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import NotFound from "./pages/NotFound";
import AdminLayout from "./pages/admin/AdminLayout";
import Dashboard from "./pages/admin/Dashboard";
import AdminBooks from "./pages/admin/AdminBooks";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminContent from "./pages/admin/AdminContent";
import AdminSettings from "./pages/admin/AdminSettings";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Toaster position="bottom-center" richColors />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/catalog" element={<Catalog />} />
        <Route path="/book/:slug" element={<BookPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<Navigate to="/cart" replace />} />
        <Route path="/order-success" element={<OrderSuccess />} />
        <Route path="/track" element={<Track />} />
        <Route path="/account" element={<Account />} />
        <Route path="/favorites" element={<Favorites />} />
        <Route path="/wholesale" element={<Wholesale />} />
        <Route path="/delivery" element={<InfoPage pageKey="pageDelivery" />} />
        <Route path="/returns" element={<InfoPage pageKey="pageReturns" />} />
        <Route path="/terms" element={<InfoPage pageKey="pageTerms" />} />
        <Route path="/about" element={<InfoPage pageKey="aboutText" />} />
        <Route path="/contacts" element={<Contacts />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="books" element={<AdminBooks />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="content" element={<AdminContent />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}
