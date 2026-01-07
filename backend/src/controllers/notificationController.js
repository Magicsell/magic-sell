import { Notification } from "../models/Notification.js";

/**
 * GET /api/notifications
 * Get notifications for current user
 */
export async function getNotifications(req, res) {
  try {
    const organizationId = req.organizationId;
    const userId = req.user._id;
    const { unreadOnly = false } = req.query;

    const query = {
      organizationId,
      userId,
    };

    if (unreadOnly === "true") {
      query.isRead = false;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    // Count unread
    const unreadCount = await Notification.countDocuments({
      organizationId,
      userId,
      isRead: false,
    });

    res.json({
      notifications,
      unreadCount,
    });
  } catch (error) {
    console.error("Get notifications error:", error);
    res.status(500).json({ error: "Failed to get notifications" });
  }
}

/**
 * PATCH /api/notifications/:id/read
 * Mark notification as read
 */
export async function markAsRead(req, res) {
  try {
    const { id } = req.params;
    const organizationId = req.organizationId;
    const userId = req.user._id;

    const notification = await Notification.findOneAndUpdate(
      {
        _id: id,
        organizationId,
        userId,
      },
      {
        isRead: true,
        readAt: new Date(),
      },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    res.json({
      success: true,
      notification,
    });
  } catch (error) {
    console.error("Mark as read error:", error);
    res.status(500).json({ error: "Failed to mark notification as read" });
  }
}

/**
 * PATCH /api/notifications/read-all
 * Mark all notifications as read
 */
export async function markAllAsRead(req, res) {
  try {
    const organizationId = req.organizationId;
    const userId = req.user._id;

    await Notification.updateMany(
      {
        organizationId,
        userId,
        isRead: false,
      },
      {
        isRead: true,
        readAt: new Date(),
      }
    );

    res.json({
      success: true,
      message: "All notifications marked as read",
    });
  } catch (error) {
    console.error("Mark all as read error:", error);
    res.status(500).json({ error: "Failed to mark all notifications as read" });
  }
}

/**
 * DELETE /api/notifications/:id
 * Delete notification
 */
export async function deleteNotification(req, res) {
  try {
    const { id } = req.params;
    const organizationId = req.organizationId;
    const userId = req.user._id;

    const notification = await Notification.findOneAndDelete({
      _id: id,
      organizationId,
      userId,
    });

    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    res.json({
      success: true,
      message: "Notification deleted",
    });
  } catch (error) {
    console.error("Delete notification error:", error);
    res.status(500).json({ error: "Failed to delete notification" });
  }
}
