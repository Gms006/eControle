import { useEffect, useRef, useState } from "react";
import {
  contarNotificacoesNaoLidas,
  listarNotificacoes,
  marcarNotificacaoComoLida,
} from "@/services/notifications";

const PAGE_SIZE = 100;

export function useNotifications({ onNotificationRouteNavigate } = {}) {
  const [openNotifications, setOpenNotifications] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsLoadingMore, setNotificationsLoadingMore] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [totalUnread, setTotalUnread] = useState(0);
  const [notificationsOffset, setNotificationsOffset] = useState(0);
  const notificationsRef = useRef(null);

  const loadUnreadCount = async () => {
    try {
      const payload = await contarNotificacoesNaoLidas();
      setUnreadCount(Number(payload?.unread_count || 0));
    } catch {
      // no-op
    }
  };

  const loadNotifications = async () => {
    setNotificationsLoading(true);
    setNotificationsOffset(0);
    try {
      const payload = await listarNotificacoes({ limit: PAGE_SIZE, offset: 0 });
      setNotifications(Array.isArray(payload?.items) ? payload.items : []);
      setTotalUnread(Number(payload?.total || 0));
    } catch {
      setNotifications([]);
      setTotalUnread(0);
    } finally {
      setNotificationsLoading(false);
    }
  };

  const loadMoreNotifications = async () => {
    setNotificationsLoadingMore(true);
    try {
      const nextOffset = notificationsOffset + PAGE_SIZE;
      const payload = await listarNotificacoes({ limit: PAGE_SIZE, offset: nextOffset });
      const newItems = Array.isArray(payload?.items) ? payload.items : [];
      setNotifications((prev) => [...prev, ...newItems]);
      setNotificationsOffset(nextOffset);
    } catch {
      // no-op
    } finally {
      setNotificationsLoadingMore(false);
    }
  };

  const handleMarkRead = async (item) => {
    if (!item?.id) return;
    try {
      await marcarNotificacaoComoLida(item.id);
      setNotifications((prev) =>
        prev.map((entry) =>
          entry.id === item.id ? { ...entry, read_at: new Date().toISOString() } : entry,
        ),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // no-op
    }
  };

  const handleOpenNotification = async (item) => {
    if (!item) return;
    if (!item.read_at) {
      await handleMarkRead(item);
    }
    if (item.route_path) {
      onNotificationRouteNavigate?.(item.route_path);
      setOpenNotifications(false);
    }
  };

  useEffect(() => {
    void loadUnreadCount();
    const interval = window.setInterval(() => {
      void loadUnreadCount();
    }, 30000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!openNotifications) return;
    void loadNotifications();
  }, [openNotifications]);

  useEffect(() => {
    const onOpenNotifications = () => setOpenNotifications(true);
    window.addEventListener("econtrole:open-notifications", onOpenNotifications);
    return () => window.removeEventListener("econtrole:open-notifications", onOpenNotifications);
  }, []);

  useEffect(() => {
    if (!openNotifications) return;
    const onDocClick = (event) => {
      const target = event.target;
      if (!notificationsRef.current?.contains(target)) {
        setOpenNotifications(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [openNotifications]);

  return {
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
  };
}
