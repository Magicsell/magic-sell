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
import OrderForm from "../features/admin/OrderForm";
import Products from "../features/admin/Products";
import ProductForm from "../features/admin/ProductForm";
import Customers from "../features/admin/Customers";
import CustomerForm from "../features/admin/CustomerForm";
import Drivers from "../features/admin/Drivers";
import DriverForm from "../features/admin/DriverForm";
import RoutePlanner from "../features/driver/RoutePlanner";
import DriverHome from "../features/driver/DriverHome";
import AdminDriverBoard from "../features/admin/AdminDriverBoard";
import MobileAccess from "../features/admin/MobileAccess";
import CustomerDashboard from "../features/customer/CustomerDashboard";
import CustomerProducts from "../features/customer/CustomerProducts";
import CustomerOrders from "../features/customer/CustomerOrders";
import CustomerCart from "../features/customer/CustomerCart";
import CustomerProductDetail from "../features/customer/CustomerProductDetail";

import Login from "../features/auth/Login";
import Register from "../features/auth/Register";

export default function Router() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

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
          <Route path="orders/new" element={<OrderForm />} />
          <Route path="orders/edit" element={<OrderForm />} />
          <Route path="products" element={<Products />} />
          <Route path="products/new" element={<ProductForm />} />
          <Route path="products/edit" element={<ProductForm />} />
          <Route path="customers" element={<Customers />} />
          <Route path="customers/new" element={<CustomerForm />} />
          <Route path="customers/edit" element={<CustomerForm />} />
          <Route path="drivers" element={<Drivers />} />
          <Route path="drivers/new" element={<DriverForm />} />
          <Route path="drivers/edit" element={<DriverForm />} />
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

        {/* Customer */}
        <Route
          path="/customer"
          element={
            <Guard role="customer">
              <AppShell>
                <Outlet />
              </AppShell>
            </Guard>
          }
        >
          <Route index element={<CustomerDashboard />} />
          <Route path="products" element={<CustomerProducts />} />
          <Route path="products/:id" element={<CustomerProductDetail />} />
          <Route path="cart" element={<CustomerCart />} />
          <Route path="orders" element={<CustomerOrders />} />
        </Route>

        <Route path="route" element={<RoutePlanner />} />
        <Route path="driver-board" element={<AdminDriverBoard />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
