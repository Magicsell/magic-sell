import { useEffect, useState } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { apiGet, apiPost, apiPatch } from "../../lib/api";
import { User, Mail, Phone, MapPin, Car } from "lucide-react";
import Breadcrumb from "../../components/Breadcrumb";

const INPUT_CLS = `
  w-full rounded-lg border px-3 py-2.5
  bg-slate-800/50 text-slate-100 text-sm border-slate-700 placeholder:text-slate-500
  focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50
  transition-all
`;

function Field({ label, error, children, required, icon: Icon }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
        {Icon && <Icon className="w-3.5 h-3.5" />}
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </span>
      {children}
      <div className="h-4 mt-0.5">
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

export default function DriverForm() {
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
    vehicleInfo: "",
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
            password: "", // Don't pre-fill password
            name: user.driverProfile?.name || "",
            phone: user.driverProfile?.phone || "",
            address: user.driverProfile?.address || "",
            postcode: user.driverProfile?.postcode || "",
            city: user.driverProfile?.city || "",
            vehicleInfo: user.driverProfile?.vehicleInfo || "",
          });
        })
        .catch((e) => {
          setErr(e.message || "Failed to load driver");
        })
        .finally(() => setLoading(false));
    }
  }, [isEdit, userId]);

  function onChange(e) {
    const { name, value } = e.target;
    if (name === "postcode") {
      setForm((prev) => ({ ...prev, [name]: formatUKPostcode(value) }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
    // Clear field error
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
    setErr("");
  }

  function validate() {
    const errors = {};
    if (!form.email.trim()) errors.email = "Email is required";
    if (!isEdit && !form.password) errors.password = "Password is required";
    if (isEdit && form.password && form.password.length < 6) {
      errors.password = "Password must be at least 6 characters";
    }
    if (!isEdit && form.password && form.password.length < 6) {
      errors.password = "Password must be at least 6 characters";
    }
    if (!form.name.trim()) errors.name = "Name is required";
    if (form.phone && !isValidUKPhone(form.phone)) {
      errors.phone = "Invalid UK phone number";
    }
    if (form.postcode && !isValidUKPostcode(form.postcode)) {
      errors.postcode = "Invalid UK postcode";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    if (!validate()) return;

    setBusy(true);
    try {
      const payload = {
        email: form.email.trim(),
        ...(form.password && { password: form.password }),
        driverProfile: {
          name: form.name.trim(),
          phone: form.phone.trim() || null,
          address: form.address.trim() || null,
          postcode: form.postcode.trim() || null,
          city: form.city.trim() || null,
          vehicleInfo: form.vehicleInfo.trim() || null,
        },
      };

      if (isEdit) {
        await apiPatch(`/api/users/${userId}`, payload);
      } else {
        await apiPost("/api/users", {
          ...payload,
          role: "driver",
          isApproved: true, // Admin-created drivers are auto-approved
        });
      }

      navigate("/admin/drivers");
    } catch (error) {
      setErr(error.message || "Failed to save driver");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-slate-400">Loading driver...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <Breadcrumb
        items={[
          { label: "Drivers", path: "/admin/drivers" },
          { label: isEdit ? "Edit Driver" : "New Driver" },
        ]}
      />

      <h1 className="text-2xl font-bold text-slate-100 mb-6">
        {isEdit ? "Edit Driver" : "New Driver"}
      </h1>

      <form onSubmit={onSubmit} className="space-y-6">
        {err && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/15 text-red-300 px-4 py-3 text-sm">
            {err}
          </div>
        )}

        <Section title="Account Information" icon={User}>
          <Field label="Email Address" error={fieldErrors.email} required icon={Mail}>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={onChange}
              className={INPUT_CLS}
              placeholder="driver@example.com"
              disabled={isEdit}
              required
            />
          </Field>

          <Field label="Password" error={fieldErrors.password} required={!isEdit} icon={Mail}>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={onChange}
              className={INPUT_CLS}
              placeholder={isEdit ? "Leave blank to keep current password" : "At least 6 characters"}
              required={!isEdit}
            />
          </Field>
        </Section>

        <Section title="Driver Information" icon={User}>
          <Field label="Full Name" error={fieldErrors.name} required icon={User}>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={onChange}
              className={INPUT_CLS}
              placeholder="Driver full name"
              required
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

          <Field label="Vehicle Information" error={fieldErrors.vehicleInfo} icon={Car}>
            <input
              type="text"
              name="vehicleInfo"
              value={form.vehicleInfo}
              onChange={onChange}
              className={INPUT_CLS}
              placeholder="e.g., Ford Transit, License Plate: AB12 CDE"
            />
          </Field>
        </Section>

        <Section title="Address Information" icon={MapPin}>
          <Field label="Address" error={fieldErrors.address} icon={MapPin}>
            <input
              type="text"
              name="address"
              value={form.address}
              onChange={onChange}
              className={INPUT_CLS}
              placeholder="Street address"
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Postcode" error={fieldErrors.postcode} icon={MapPin}>
              <input
                type="text"
                name="postcode"
                value={form.postcode}
                onChange={onChange}
                className={INPUT_CLS}
                placeholder="BH13 7EX"
                maxLength={8}
              />
            </Field>

            <Field label="City" error={fieldErrors.city} icon={MapPin}>
              <input
                type="text"
                name="city"
                value={form.city}
                onChange={onChange}
                className={INPUT_CLS}
                placeholder="Bournemouth"
              />
            </Field>
          </div>
        </Section>

        {/* Buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={() => navigate("/admin/drivers")}
            className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800/50 text-slate-300 text-sm font-medium hover:bg-slate-800 transition-colors"
          >
            Discard
          </button>
          <button
            type="submit"
            disabled={busy}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
          >
            {busy ? "Saving..." : isEdit ? "Save Changes" : "Save Driver"}
          </button>
        </div>
      </form>
    </div>
  );
}
