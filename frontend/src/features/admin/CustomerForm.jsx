import { useEffect, useState } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { apiGet, apiPost, apiPatch } from "../../lib/api";
import { User, Mail, Phone, MapPin, FileText } from "lucide-react";
import Breadcrumb from "../../components/Breadcrumb";

const INPUT_CLS = `
  w-full rounded-lg border px-3 py-2.5
  bg-slate-800/50 text-slate-100 text-sm border-slate-700 placeholder:text-slate-500
  focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50
  transition-all
`;

function Field({ label, error, children, required, icon: Icon, className = "" }) {
  return (
    <label className={`grid gap-1.5 ${className}`}>
      <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
        {Icon && <Icon className="w-3.5 h-3.5" />}
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </span>
      {children}
      <div className="min-h-[1rem] mt-0.5">
        {error && (
          <span className="text-xs text-red-400">{error}</span>
        )}
      </div>
    </label>
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
        {Icon && <Icon className="w-4 h-4 text-slate-400" />}
        <h3 className="text-sm font-semibold text-slate-300">{title}</h3>
      </div>
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
}

/* ==== UK validators & formatters ==== */
const UK_POSTCODE_RE =
  /^(GIR 0AA|((([A-PR-UWYZ][0-9][0-9]?)|([A-PR-UWYZ][A-HK-Y][0-9][0-9]?)|([A-PR-UWYZ][0-9][A-HJKSTUW])|([A-PR-UWYZ][A-HK-Y][0-9][ABEHMNPRV-Y]))\s?[0-9][ABD-HJLNP-UW-Z]{2}))$/i;

function formatUKPostcode(v) {
  if (!v) return "";
  const s = v.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (s.length < 5) return v.toUpperCase();
  return `${s.slice(0, -3)} ${s.slice(-3)}`;
}

function isValidUKPostcode(v) {
  if (!v) return true;
  return UK_POSTCODE_RE.test(v.trim().toUpperCase());
}

function normalizeUKPhone(v) {
  if (!v) return "";
  const s = v.replace(/[^\d+]/g, "");
  if (/^0\d{10}$/.test(s)) return "+44" + s.slice(1);
  if (/^\+?44\d{9,10}$/.test(s)) return s.startsWith("+") ? s : "+" + s;
  return null;
}

function isValidUKPhone(v) {
  if (!v) return true;
  return normalizeUKPhone(v) !== null;
}

export default function CustomerForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const userId = searchParams.get("id");
  const isEdit = !!userId;

  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({
    email: "",
    password: "",
    name: "",
    phone: "",
    address: "",
    postcode: "",
    city: "",
    balance: "0",
  });
  const [fieldErrors, setFieldErrors] = useState({});

  // Load user data if editing
  useEffect(() => {
    if (isEdit && userId) {
      setLoading(true);
      apiGet(`/api/users/${userId}`)
        .then((data) => {
          const user = data.user;
          setForm({
            email: user.email || "",
            password: "", // Don't load password
            name: user.customerProfile?.name || "",
            phone: user.customerProfile?.phone || "",
            address: user.customerProfile?.address || "",
            postcode: user.customerProfile?.postcode || "",
            city: user.customerProfile?.city || "",
            balance: String(user.customerProfile?.balance || 0),
          });
        })
        .catch((e) => {
          setErr(e.message || "Failed to load user");
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [isEdit, userId]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: name === "postcode" ? formatUKPostcode(value) : value,
    }));
    // Clear field error
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
    setErr("");
  };

  const validate = () => {
    const errors = {};
    if (!form.email.trim()) errors.email = "Email is required";
    if (!isEdit && !form.password) errors.password = "Password is required";
    if (form.password && form.password.length < 6) errors.password = "Password must be at least 6 characters";
    if (!form.name.trim()) errors.name = "Name is required";
    if (form.phone && !isValidUKPhone(form.phone)) errors.phone = "Enter a valid UK phone (+44… or 07…)";
    if (form.postcode && !isValidUKPostcode(form.postcode)) errors.postcode = "Enter a valid UK postcode";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!validate()) return;

    try {
      setBusy(true);
      const payload = {
        email: form.email.trim(),
        customerProfile: {
          name: form.name.trim(),
          phone: form.phone ? normalizeUKPhone(form.phone) : null,
          address: form.address.trim() || null,
          postcode: form.postcode ? formatUKPostcode(form.postcode) : null,
          city: form.city.trim() || null,
          balance: Number(form.balance) || 0,
          // Don't include geo field - it will be preserved on backend if not provided
        },
      };

      if (!isEdit && form.password) {
        payload.password = form.password;
      }

      if (isEdit) {
        // Only include password if provided
        if (form.password) {
          payload.password = form.password;
        }
        console.log("[CustomerForm] Updating user:", userId, payload);
        const response = await apiPatch(`/api/users/${userId}`, payload);
        console.log("[CustomerForm] Update response:", response);
      } else {
        // Create user via user API (admin creates user directly, no approval needed)
        payload.role = "customer"; // Always customer for this form
        payload.isApproved = true; // Admin-created users are auto-approved
        await apiPost("/api/users", payload);
      }
      navigate("/admin/customers");
    } catch (e) {
      console.error("[CustomerForm] Error:", e);
      // Try to extract detailed error message
      let errorMessage = e.message || (isEdit ? "Failed to update user" : "Failed to create user");
      if (e.data) {
        if (e.data.details && Array.isArray(e.data.details)) {
          errorMessage = e.data.details.join(", ");
        } else if (e.data.message) {
          errorMessage = e.data.message;
        } else if (e.data.error) {
          errorMessage = e.data.error;
        }
      }
      setErr(errorMessage);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="text-center text-slate-400 py-8">Loading user...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <Breadcrumb
        items={[
          { label: "Customers", path: "/admin/customers" },
          { label: isEdit ? "Edit Customer" : "New Customer", path: location.pathname },
        ]}
      />
      <h1 className="text-2xl font-bold text-slate-100 mb-6">
        {isEdit ? "Edit Customer" : "Add New Customer"}
      </h1>

      <form id="customer-form" onSubmit={onSubmit} className="space-y-6">
        {err && (
          <div className="rounded-lg px-4 py-3 text-sm border bg-red-500/15 text-red-300 border-red-500/30">
            {err}
          </div>
        )}

        {/* User Information */}
        <Section title="User Information" icon={User}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Email Address" error={fieldErrors.email} required icon={Mail}>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={onChange}
                className={INPUT_CLS}
                placeholder="customer@example.com"
                disabled={isEdit}
              />
            </Field>

            <Field label={isEdit ? "New Password (leave empty to keep current)" : "Password"} error={fieldErrors.password} required={!isEdit} icon={User}>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={onChange}
                className={INPUT_CLS}
                placeholder={isEdit ? "Leave empty to keep current password" : "At least 6 characters"}
              />
            </Field>

          </div>
        </Section>

        {/* Customer Details */}
        <Section title="Customer Details" icon={FileText}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
            <Field label="Full Name" error={fieldErrors.name} required icon={User}>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={onChange}
                className={INPUT_CLS}
                placeholder="John Doe"
              />
            </Field>

            <Field label="Phone Number" error={fieldErrors.phone} icon={Phone}>
              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={onChange}
                className={INPUT_CLS}
                placeholder="+44 7xxx xxxxxx"
              />
            </Field>

            <Field label="Postcode" error={fieldErrors.postcode} icon={MapPin}>
              <input
                type="text"
                name="postcode"
                value={form.postcode}
                onChange={onChange}
                className={INPUT_CLS}
                placeholder="BH13 7EX"
              />
            </Field>

            <Field label="City" icon={MapPin}>
              <input
                type="text"
                name="city"
                value={form.city}
                onChange={onChange}
                className={INPUT_CLS}
                placeholder="Bournemouth"
              />
            </Field>

            <Field label="Address" icon={MapPin}>
              <input
                type="text"
                name="address"
                value={form.address}
                onChange={onChange}
                className={INPUT_CLS}
                placeholder="Street address"
              />
            </Field>

            <Field label="Account Balance (£)" icon={FileText}>
              <div>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  name="balance"
                  value={form.balance}
                  onChange={onChange}
                  className={INPUT_CLS}
                  placeholder="0.00"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Set the customer's account balance. This can be used for payments.
                </p>
              </div>
            </Field>
          </div>
        </Section>

        {/* Form Actions */}
        <div className="flex gap-3 pt-4 border-t border-slate-700">
          <button
            type="submit"
            disabled={busy}
            className="px-6 py-3 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {busy ? "Saving…" : isEdit ? "Save Changes" : "Create Customer"}
          </button>
          <button
            type="button"
            onClick={() => navigate("/admin/customers")}
            className="px-6 py-3 rounded-lg border border-slate-700 bg-slate-800/50 text-slate-200 hover:bg-slate-800 hover:border-slate-600 transition-colors ml-auto"
          >
            Discard
          </button>
        </div>
      </form>
    </div>
  );
}
