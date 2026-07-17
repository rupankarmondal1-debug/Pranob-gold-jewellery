import { Routes, Route } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./components/AppLayout";

import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ChangePassword from "./pages/ChangePassword";
import DisabledAccount from "./pages/DisabledAccount";

import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import Orders from "./pages/Orders";
import GoldRate from "./pages/GoldRate";
import GoldConversion from "./pages/GoldConversion";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import AdminPanel from "./pages/AdminPanel";

export default function App() {
  return (
    <Routes>
      {/* Public / auth routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ChangePassword />} />
      <Route path="/disabled" element={<DisabledAccount />} />

      {/* Forced change-password screen, reachable once signed in even if
          mustChangePassword would normally redirect everything else here */}
      <Route
        path="/change-password"
        element={
          <ProtectedRoute>
            <ChangePassword forced />
          </ProtectedRoute>
        }
      />

      {/* Protected app shell */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/gold-rate" element={<GoldRate />} />
        <Route path="/gold-conversion" element={<GoldConversion />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Settings />} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute adminOnly>
              <AdminPanel />
            </ProtectedRoute>
          }
        />
      </Route>
    </Routes>
  );
}
