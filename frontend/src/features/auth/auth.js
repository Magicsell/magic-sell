// src/auth/auth.js
const USERS = {
  admin:  { password: "admin123",  role: "admin" },
  driver: { password: "driver123", role: "driver" },
};

export function login(username, password) {
  const u = USERS[username?.toLowerCase()];
  if (!u || u.password !== password) return null;
  const user = { username: username.toLowerCase(), role: u.role };
  localStorage.setItem("ms_user", JSON.stringify(user));
  window.dispatchEvent(new Event("ms-auth"));
  return user;
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem("ms_user")) || null;
  } catch {
    return null;
  }
}

export function logout(redirect = true) {
  localStorage.removeItem("ms_user");
  window.dispatchEvent(new Event("ms-auth"));
  if (redirect) {
    // tam ve kesin yönlendirme
    window.location.replace("/login");
  }
}

// İsteyen component bu değişimi dinleyebilsin
export function onAuthChange(cb) {
  const handler = () => cb(getUser());
  window.addEventListener("ms-auth", handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener("ms-auth", handler);
    window.removeEventListener("storage", handler);
  };
}
