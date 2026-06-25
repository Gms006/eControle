import React from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import NotificationPanel from "@/components/notifications/NotificationPanel";
import { useNotifications } from "@/hooks/notifications/useNotifications";

export default function NotificationsButton({ onNotificationRouteNavigate }) {
  const {
    openNotifications,
    setOpenNotifications,
    notificationsLoading,
    notificationsLoadingMore,
    notifications,
    unreadCount,
    totalUnread,
    notificationsRef,
    loadMoreNotifications,
    handleMarkRead,
    handleOpenNotification,
  } = useNotifications({ onNotificationRouteNavigate });

  return (
    <div className="relative" ref={notificationsRef}>
      <Button
        size="icon"
        variant="secondary"
        title="Notificações"
        className="relative border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
        onClick={() => setOpenNotifications((prev) => !prev)}
        data-testid="topbar-notifications-button"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span
            className="absolute -right-2 -top-2 flex h-[21px] min-w-[21px] items-center justify-center rounded-full border border-white bg-rose-600 px-1 text-[11px] font-bold text-white"
            data-testid="topbar-notifications-unread"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </Button>
      <NotificationPanel
        open={openNotifications}
        loading={notificationsLoading}
        notifications={notifications}
        unreadCount={unreadCount}
        onMarkRead={handleMarkRead}
        onNavigate={handleOpenNotification}
        onLoadMore={loadMoreNotifications}
        hasMore={notifications.length < totalUnread}
        loadingMore={notificationsLoadingMore}
        totalUnread={totalUnread}
      />
    </div>
  );
}
