"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from "@/hooks/useNotifications";
import { toast } from "@/hooks/use-toast";

export default function NotificationsPage() {
  const notificationsQ = useNotifications({ page: 1, limit: 50 });
  const markAll = useMarkAllNotificationsRead();
  const markOne = useMarkNotificationRead();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">Notifications</h1>
          <p className="text-sm text-white/65">Activity from applications, portal health, and email delivery.</p>
        </div>
        <Button
          variant="outline"
          className="border-white/10 bg-transparent text-white hover:bg-white/10"
          disabled={markAll.isPending}
          onClick={async () => {
            await markAll.mutateAsync();
            toast({ title: "Marked read", description: "All notifications have been marked as read." });
          }}
        >
          Mark all read
        </Button>
      </div>

      <div className="space-y-3">
        {(notificationsQ.data?.data ?? []).map((notification: any) => (
          <Card key={notification.id} className="card-cinematic">
            <CardContent className="space-y-3 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="text-base font-semibold text-white">{notification.title}</div>
                    {!notification.isRead ? <Badge className="bg-rose-500/90 text-white">Unread</Badge> : null}
                    {notification.isUrgent ? <Badge className="bg-amber-500/20 text-amber-100">Urgent</Badge> : null}
                  </div>
                  <div className="mt-2 text-sm text-white/70">{notification.body}</div>
                </div>
                <div className="text-xs text-white/45">{new Date(notification.createdAt).toLocaleString()}</div>
              </div>
              <div className="flex justify-end">
                {!notification.isRead ? (
                  <Button
                    variant="outline"
                    className="border-white/10 bg-transparent text-white hover:bg-white/10"
                    onClick={async () => {
                      await markOne.mutateAsync(notification.id);
                      toast({ title: "Notification updated", description: "Marked as read." });
                    }}
                  >
                    Mark read
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
