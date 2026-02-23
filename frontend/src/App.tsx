import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import Login from "./pages/auth/Login";
import ResetPassword from "./pages/auth/ResetPassword";
import SetPassword from "./pages/auth/SetPassword";
import MainApp from "./pages/MainApp";

function ProtectedApp() {
  const { accessToken, loading } = useAuth();
  if (loading) return null;
  if (!accessToken) return <Navigate to="/login" replace />;
  return <MainApp />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/set-password" element={<SetPassword />} />

        {/* app protegida */}
        <Route path="/painel" element={<ProtectedApp />} />
        <Route path="/*" element={<Navigate to="/painel" replace />} />
      </Routes>
    </AuthProvider>
  );
}
