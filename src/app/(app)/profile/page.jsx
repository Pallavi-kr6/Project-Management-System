"use client";
import { LogOut } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { useCurrentUser } from "@/hooks/use-api";
import { useLogout } from "@/hooks/use-logout";
import { formatDateTime, initials } from "@/lib/utils";
export default function ProfilePage() {
    const { data: user, error, isLoading, mutate } = useCurrentUser();
    const { logout, loading } = useLogout();
    return (<>
      <PageHeader title="Profile" description="Your account details."/>
      {error && !user ? (<ErrorState error={error} onRetry={() => mutate()}/>) : isLoading || !user ? (<Skeleton className="h-52 max-w-xl"/>) : (<Card className="max-w-xl p-6">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">
              {initials(user.fullName || user.email)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold">{user.fullName}</p>
              <p className="truncate text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <dl className="mt-6 grid gap-4 border-t pt-5 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">Full name</dt>
              <dd className="font-medium">{user.fullName}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Email address</dt>
              <dd className="break-all font-medium">{user.email}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Member since</dt>
              <dd className="font-medium">{formatDateTime(user.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Account id</dt>
              <dd className="break-all font-mono text-xs">{user.id}</dd>
            </div>
          </dl>
          <div className="mt-6 border-t pt-5">
            <Button variant="outline" onClick={logout} loading={loading}>
              <LogOut className="h-4 w-4"/> Sign out
            </Button>
          </div>
        </Card>)}
    </>);
}
