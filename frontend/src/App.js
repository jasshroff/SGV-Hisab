import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import Entries from "@/pages/Entries";
import Parties from "@/pages/Parties";
import PartyLedger from "@/pages/PartyLedger";
import Reports from "@/pages/Reports";
import Admin from "@/pages/Admin";
import Backup from "@/pages/Backup";

const Shell = ({ children }) => (
  <ProtectedRoute>
    <Layout>{children}</Layout>
  </ProtectedRoute>
);

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/" element={<Shell><Dashboard /></Shell>} />
            <Route path="/entries" element={<Shell><Entries /></Shell>} />
            <Route path="/parties" element={<Shell><Parties /></Shell>} />
            <Route path="/parties/:id" element={<Shell><PartyLedger /></Shell>} />
            <Route path="/reports" element={<Shell><Reports /></Shell>} />
            <Route path="/backup" element={<ProtectedRoute adminOnly><Layout><Backup /></Layout></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute adminOnly><Layout><Admin /></Layout></ProtectedRoute>} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </div>
  );
}

export default App;
