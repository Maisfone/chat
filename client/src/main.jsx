import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import App from "./App.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Chat from "./pages/Chat.jsx";
import Conversations from "./pages/Conversations.jsx";
import Phone from "./pages/Phone.jsx";
import Meetings from "./pages/Meetings.jsx";
import MeetingDetails from "./pages/MeetingDetails.jsx";
import MeetingInvite from "./pages/MeetingInvite.jsx";
import Contacts from "./pages/Contacts.jsx";
import Admin from "./pages/Admin.jsx";
import Profile from "./pages/Profile.jsx";
import { getToken, getUser } from "./state/auth.js";
import "./index.css";

function RequireAuth({ children }) {
  const token = getToken();
  return token ? children : <Navigate to="/login" replace />;
}

function AdminOnly({ children }) {
  const token = getToken();
  const user = getUser();
  if (!token) return <Navigate to="/login" replace />;
  return user?.isAdmin ? children : <Navigate to="/" replace />;
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/join/:token" element={<MeetingInvite />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <App />
            </RequireAuth>
          }
        >
          <Route index element={<Chat />} />
          <Route path="conversas" element={<Conversations />} />
          <Route path="telefonia" element={<Phone />} />
          <Route path="reunioes" element={<Meetings />} />
          <Route path="reunioes/:id" element={<MeetingDetails />} />
          <Route path="contatos" element={<Contacts />} />
          <Route path="admin" element={<AdminOnly><Admin /></AdminOnly>} />
          <Route path="profile" element={<Profile />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
// Registra o Service Worker apenas em produção para evitar conflitos durante o desenvolvimento.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    try {
      navigator.serviceWorker.register('/sw.js');
    } catch (err) {
      console.error('Falha ao registrar o Service Worker', err);
    }
  });
}
// Em desenvolvimento, garantimos que nenhum Service Worker legado continue ativo.
if (!import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then((regs) => regs.forEach((reg) => reg.unregister()))
    .catch(() => {});
  if (window.caches?.keys) {
    window.caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => window.caches.delete(key))))
      .catch(() => {});
  }
}
