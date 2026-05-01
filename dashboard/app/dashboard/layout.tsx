import { NavRail } from "@/components/layout/NavRail";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-surface-base">
      <NavRail />
      <main className="md:pl-[60px] pb-16 md:pb-0">{children}</main>
    </div>
  );
}
