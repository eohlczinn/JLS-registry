import { createBrowserRouter } from "react-router-dom";
import MainLayout from "../layouts/MainLayout";
import Home from "../pages/Home";
import Explore from "../pages/Explore";
import Package from "../pages/Package";
import Login from "../pages/Login";
import Publish from "../pages/Publish";
import Dashboard from "../pages/Dashboard";
import Support from "../pages/Support";
import SupportSettings from "../pages/SupportSettings";
import Settings from "../pages/Settings";
const NotFound = () => (
  <section className="panel">
    <h1>Página não encontrada</h1>
    <p className="muted">Volte para o início do JL Registry.</p>
  </section>
);
export const router = createBrowserRouter([
  {
    element: <MainLayout />,
    children: [
      { path: "/", element: <Home /> },
      { path: "/explore", element: <Explore /> },
      { path: "/search", element: <Explore /> },
      { path: "/packages/:name", element: <Package /> },
      { path: "/login", element: <Login /> },
      { path: "/publish", element: <Publish /> },
      { path: "/dashboard", element: <Dashboard /> },
      { path: "/settings", element: <Settings /> },
      { path: "/support", element: <Support /> },
      { path: "*", element: <NotFound /> },
      { path: "/support-settings", element: <SupportSettings /> },
    ],
  },
]);
