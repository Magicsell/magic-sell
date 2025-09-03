import {
  Routes,
  Route,
  Navigate,
  Outlet,
  BrowserRouter,
} from "react-router-dom";
import Guard from "../features/auth/Guard";
import AppShell from "./AppShell";

import AdminHome from "../features/admin/AdminHome";
import Orders from "../features/admin/Orders";
import Customers from "../features/customers/Customers";
import RoutePlanner from "../features/driver/RoutePlanner";
import DriverHome from "../features/driver/DriverHome";
import AdminDriverBoard from "../features/admin/AdminDriverBoard";
import MobileAccess from "../features/admin/MobileAccess";

import Login from "../features/auth/Login";

export default function Router() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />

        {/* Admin */}
        <Route
          path="/admin"
          element={
            <Guard role="admin">
              <AppShell>
                <Outlet />
              </AppShell>
            </Guard>
          }
        >
          <Route path="/admin/mobile" element={<Guard role="admin"><MobileAccess/></Guard>} />
          <Route index element={<AdminHome />} />
          <Route path="orders" element={<Orders />} />
          <Route path="customers" element={<Customers />} />
          <Route path="driver-board" element={<AdminDriverBoard />} />
          
        </Route>

        {/* Driver */}
        <Route
          path="/driver"
          element={
            <Guard role="driver">
              <AppShell>
                <Outlet />
              </AppShell>
            </Guard>
          }
        >
          <Route index element={<DriverHome />} />
          <Route path="route" element={<RoutePlanner />} />
        </Route>
        <Route path="route" element={<RoutePlanner />} />
        <Route path="driver-board" element={<AdminDriverBoard />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
