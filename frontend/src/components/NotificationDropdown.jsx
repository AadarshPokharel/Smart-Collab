import React from 'react';

const NotificationDropdown = ({
  notifications,
  onMarkAllRead,
  onClearAll,
  onMarkRead,
  onDelete,
  emptyLabel = 'No new notifications',
  panelClassName = 'absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl p-4',
}) => {
  return (
    <div className={panelClassName}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold">Notifications</p>
        <div className="flex items-center gap-3 text-xs font-medium">
          <button className="text-violet-600 hover:text-violet-700" onClick={onMarkAllRead}>
            Mark all as read
          </button>
          <button className="text-slate-500 hover:text-slate-700" onClick={onClearAll}>
            Clear all
          </button>
        </div>
      </div>

      <div className="space-y-3 max-h-80 overflow-auto">
        {notifications.length === 0 ? (
          <div className="text-center text-sm text-slate-500 py-6">{emptyLabel}</div>
        ) : (
          notifications.map((note, index) => {
            const isRead = !!note?.read;
            const text = note?.text || note?.message || note?.title || 'Notification';
            const time =
              note?.time ||
              (note?.createdAt
                ? new Date(note.createdAt).toLocaleString()
                : note?.timestamp
                  ? new Date(note.timestamp).toLocaleString()
                  : '');

            return (
              <div
                key={note?.id || note?._id || index}
                className={`group p-3 rounded-lg border text-sm transition-all duration-200 ${
                  isRead ? 'border-slate-200 bg-slate-50' : 'border-violet-200 bg-violet-50'
                }`}
                onClick={() => onMarkRead(note)}
                role="button"
                tabIndex={0}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-slate-700 font-medium">{text}</p>
                    {time && <p className="text-xs text-slate-500 mt-2">{time}</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!isRead && <span className="w-2 h-2 bg-violet-500 rounded-full mt-1 transition-all duration-200" />}
                    <button
                      className="text-slate-400 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-all"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDelete(note, event);
                      }}
                      aria-label="Delete notification"
                    >
                      ×
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default NotificationDropdown;