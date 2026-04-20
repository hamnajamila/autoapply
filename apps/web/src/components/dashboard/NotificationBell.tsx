"use client";

import Link from "next/link";
import { Bell, CircleAlert, Mail, Rocket } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications, useUnreadNotificationCount } from "@/hooks/useNotifications";

function iconForType(type: string) {
  if (type === "email") return Mail;
  if (type === "system") return CircleAlert;
  return Rocket;
}

export function NotificationBell() {
  const notificationsQ = useNotifications({ page: 1, limit: 5 });
  const unreadQ = useUnreadNotificationCount();
  const markOne = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const items = notificationsQ.data?.data ?? [];
  const count = Number(unreadQ.data?.count ?? 0);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="relative border-white/10 bg-white/5 text-white hover:bg-white/10">
          <Bell className="mr-2 h-4 w-4" />
          Notifications
          {count > 0 ? (
            <Badge className="ml-2 bg-rose-500/90 text-white">{count}</Badge>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 border-white/10 bg-[#0b1224] p-2 text-white">
        <div className="mb-2 flex items-center justify-between px-2 py-1">
          <div className="text-sm font-semibold">Recent notifications</div>
          <button className="text-xs text-indigo-300 hover:text-indigo-200" onClick={() => markAll.mutate()}>
            Mark all read
          </button>
        </div>
        {items.length ? (
          items.map((notification: any) => {
            const Icon = iconForType(notification.type);
            return (
              <DropdownMenuItem
                key={notification.id}
                className="mb-1 flex items-start gap-3 rounded-lg px-3 py-3 focus:bg-white/10"
                onClick={() => {
                  if (!notification.isRead) {
                    markOne.mutate(notification.id);
                  }
                }}
              >
                <Icon className="mt-0.5 h-4 w-4 text-indigo-300" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="truncate text-sm font-medium">{notification.title}</div>
                    {!notification.isRead ? <span className="h-2 w-2 rounded-full bg-rose-400" /> : null}
                  </div>
                  <div className="mt-1 line-clamp-2 text-xs text-white/65">{notification.body}</div>
                </div>
              </DropdownMenuItem>
            );
          })
        ) : (
          <div className="px-3 py-6 text-center text-sm text-white/60">No notifications yet.</div>
        )}
        <div className="px-2 pt-2">
          <Link href="/dashboard/notifications" className="block rounded-md px-2 py-2 text-center text-sm text-indigo-300 hover:bg-white/5">
            View all notifications
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
