import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import "./App.css";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { AppProviders } from "./contexts/AppContext";
import { Toaster } from "sonner";

import Login from "./pages/Login";
import Signup from "./pages/Signup";
import AuthCallback from "./pages/AuthCallback";
import Dashboard from "./pages/Dashboard";
import Leads from "./pages/Leads";
import Opportunities from "./pages/Opportunities";
import Contacts from "./pages/Contacts";
import Activities from "./pages/Activities";
import Settings from "./pages/Settings";
import Forms from "./pages/Forms";
import PublicForm from "./pages/PublicForm";
import Sales from "./pages/Sales";
import CalendarPage from "./pages/Calendar";
import FleetHQ from "./pages/FleetHQ";
import LiveMap from "./pages/LiveMap";
import Vehicles from "./pages/Vehicles";
import Drivers from "./pages/Drivers";
import Trips from "./pages/Trips";
import AppShell from "./components/layout/AppShell";

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="h-screen flex items-center justify-center text-sm text-zinc-500">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function PublicOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="h-screen flex items-center justify-center text-sm text-zinc-500">Loading…</div>;
  if (user) return <Navigate to="/fleet" replace />;
  return children;
}

function AppRouter() {
  const location = useLocation();
  // Synchronous check before any route renders — handles #session_id=
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }
  return (
    <Routes>
      <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
      <Route path="/signup" element={<PublicOnly><Signup /></PublicOnly>} />
      <Route path="/f/:formId" element={<PublicForm />} />
      <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
        <Route path="/fleet" element={<FleetHQ />} />
        <Route path="/map" element={<LiveMap />} />
        <Route path="/vehicles" element={<Vehicles />} />
        <Route path="/drivers" element={<Drivers />} />
        <Route path="/trips" element={<Trips />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/leads" element={<Leads />} />
        <Route path="/pipeline" element={<Opportunities />} />
        <Route path="/contacts" element={<Contacts />} />
        <Route path="/activities" element={<Activities />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/sales" element={<Sales />} />
        <Route path="/forms" element={<Forms />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/fleet" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AppProviders>
          <AuthProvider>
            <AppRouter />
            <Toaster position="top-right" richColors closeButton />
          </AuthProvider>
        </AppProviders>
      </BrowserRouter>
    </div>
  );
}
