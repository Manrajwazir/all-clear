import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/layout/LogoutButton";

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="px-6 sm:px-12 pt-12 sm:pt-16 max-w-2xl">
      <div className="text-[10px] tracking-[0.2em] uppercase text-text-tertiary mb-2">
        Account
      </div>
      <h1 className="text-[32px] font-semibold tracking-tight">Signed in</h1>
      <dl className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
        <div>
          <dt className="text-[10px] tracking-[0.08em] uppercase text-text-tertiary mb-1">
            Email
          </dt>
          <dd className="text-[14px] text-text-primary">{user.email}</dd>
        </div>
        <div>
          <dt className="text-[10px] tracking-[0.08em] uppercase text-text-tertiary mb-1">
            User ID
          </dt>
          <dd className="font-mono tabular text-[12px] text-text-primary truncate">
            {user.id.slice(0, 8)}…
          </dd>
        </div>
      </dl>

      <div className="mt-12">
        <LogoutButton />
      </div>
    </div>
  );
}
