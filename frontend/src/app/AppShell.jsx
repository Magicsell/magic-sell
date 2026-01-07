import NavBar from "../components/NavBar";

export default function AppShell({ children }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <NavBar />
      <main className="mx-auto max-w-6xl px-4 py-4">{children}</main>
    </div>
  );
}
