import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  Plus, Trash2, X, CalendarDays, Clock, Bell, ChevronLeft, ChevronRight
} from 'lucide-react';
import {
  format, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  eachDayOfInterval, isSameDay, addWeeks, addMonths, parseISO,
  isWithinInterval
} from 'date-fns';
import {
  requestNotificationPermission, getPermissionStatus,
  scheduleEventReminder, getNotificationSupport
} from '../lib/notifications';

type UpcomingEvent = {
  id: string;
  user_id: string;
  title: string;
  event_date: string; // ISO date
  event_time: string | null; // HH:mm
  reminder_minutes: number | null;
  created_at: string;
};

const REMINDER_OPTIONS = [
  { label: 'None', value: 0 },
  { label: '5 min before', value: 5 },
  { label: '15 min before', value: 15 },
  { label: '30 min before', value: 30 },
  { label: '1 hour before', value: 60 },
  { label: '1 day before', value: 1440 },
];

export default function UpcomingEventsPage() {
  const [events, setEvents] = useState<UpcomingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'week' | 'month'>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isAdding, setIsAdding] = useState(false);

  // Add form
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [reminder, setReminder] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, []);

  // Schedule reminders when events load
  useEffect(() => {
    events.forEach(ev => {
      if (ev.reminder_minutes && ev.reminder_minutes > 0 && ev.event_time) {
        const eventDateTime = new Date(`${ev.event_date}T${ev.event_time}`);
        if (eventDateTime.getTime() > Date.now()) {
          scheduleEventReminder(ev.id, ev.title, eventDateTime, ev.reminder_minutes);
        }
      }
    });
  }, [events]);

  const getUserId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id;
  };

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const userId = await getUserId();
      if (!userId) return;
      
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .order('due_date', { ascending: true });
        
      if (error) throw error;
      
      const mappedEvents: UpcomingEvent[] = [];
      data?.forEach(t => {
        if (t.description && t.description.startsWith('{"type":"event"')) {
          try {
            const meta = JSON.parse(t.description);
            mappedEvents.push({
              id: t.id,
              user_id: t.user_id,
              title: t.title,
              event_date: t.due_date,
              event_time: meta.event_time,
              reminder_minutes: meta.reminder_minutes,
              created_at: t.created_at
            });
          } catch(e) {}
        }
      });
      
      setEvents(mappedEvents);
    } catch (e) {
      console.error('fetchEvents', e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !eventDate) return;
    setIsSubmitting(true);
    try {
      // Request notification permission if reminder is set
      if (reminder > 0) {
        const perm = getPermissionStatus();
        if (perm === 'default') {
          await requestNotificationPermission();
        }
      }

      const userId = await getUserId();
      if (!userId) return;

      const meta = { type: 'event', event_time: eventTime || null, reminder_minutes: reminder || null };

      const { data, error } = await supabase
        .from('tasks')
        .insert({
          user_id: userId,
          title: title.trim(),
          due_date: eventDate,
          description: JSON.stringify(meta),
          completed: false,
          priority: 'Medium',
          points: 50
        })
        .select()
        .single();

      if (error) throw error;
      
      const newEv: UpcomingEvent = {
        id: data.id,
        user_id: data.user_id,
        title: data.title,
        event_date: data.due_date,
        event_time: meta.event_time,
        reminder_minutes: meta.reminder_minutes,
        created_at: data.created_at
      };
      
      setEvents([...events, newEv].sort((a,b) => a.event_date.localeCompare(b.event_date)));
      setIsAdding(false);
      setTitle('');
      setEventDate('');
      setEventTime('');
      setReminder(0);
    } catch (e) {
      console.error('handleAddEvent', e);
      alert('Failed to save event. Check connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteEvent = async (id: string) => {
    if (!window.confirm('Delete this event?')) return;
    setEvents(events.filter(ev => ev.id !== id));
    try {
      await supabase.from('tasks').delete().eq('id', id);
    } catch (e) {
      console.error('deleteEvent', e);
      fetchEvents();
    }
  };

  /* ── Navigation ── */
  const goBack = () => {
    if (view === 'week') setCurrentDate(addWeeks(currentDate, -1));
    else setCurrentDate(addMonths(currentDate, -1));
  };
  const goForward = () => {
    if (view === 'week') setCurrentDate(addWeeks(currentDate, 1));
    else setCurrentDate(addMonths(currentDate, 1));
  };

  /* ── Filtered events ── */
  const getRange = () => {
    if (view === 'week') {
      return { start: startOfWeek(currentDate, { weekStartsOn: 1 }), end: endOfWeek(currentDate, { weekStartsOn: 1 }) };
    }
    return { start: startOfMonth(currentDate), end: endOfMonth(currentDate) };
  };

  const range = getRange();
  const eventsInRange = events.filter(ev => {
    if(!ev.event_date) return false;
    try {
      const d = parseISO(ev.event_date);
      return isWithinInterval(d, { start: range.start, end: range.end });
    } catch(e) {
      return false;
    }
  });

  const daysInRange = eachDayOfInterval({ start: range.start, end: range.end });
  const notifSupport = getNotificationSupport();

  return (
    <div className="space-y-6 pb-20 animate-fade-in-up">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-primary-900">Upcoming Events</h1>
          <p className="text-primary-500 text-sm mt-0.5">Schedule future programs and events.</p>
        </div>
        {!isAdding && (
          <button onClick={() => setIsAdding(true)} className="glass-btn px-4 py-2.5 text-sm">
            <Plus className="w-4 h-4" /> Add Event
          </button>
        )}
      </header>

      {/* Add Event Form */}
      {isAdding && (
        <div className="glass-card-solid p-5 animate-scale-in">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-primary-800">New Event</h2>
            <button onClick={() => setIsAdding(false)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg">
              <X className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={handleAddEvent} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-primary-700 mb-1">Event Name *</label>
              <input
                required
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="glass-input"
                placeholder="e.g., Java Seminar"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-primary-700 mb-1">
                  <CalendarDays className="w-3.5 h-3.5 inline mr-1" />Date *
                </label>
                <input
                  type="date"
                  required
                  value={eventDate}
                  onChange={e => setEventDate(e.target.value)}
                  className="glass-input"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-primary-700 mb-1">
                  <Clock className="w-3.5 h-3.5 inline mr-1" />Time
                </label>
                <input
                  type="time"
                  value={eventTime}
                  onChange={e => setEventTime(e.target.value)}
                  className="glass-input"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-primary-700 mb-1">
                <Bell className="w-3.5 h-3.5 inline mr-1" />Reminder
              </label>
              <select
                value={reminder}
                onChange={e => setReminder(Number(e.target.value))}
                className="glass-input"
              >
                {REMINDER_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              {!notifSupport.supported && reminder > 0 && (
                <p className="text-xs text-amber-600 mt-1">{notifSupport.reason}</p>
              )}
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button type="submit" disabled={isSubmitting} className="glass-btn px-5 py-2 text-sm">
                {isSubmitting ? 'Saving…' : 'Save Event'}
              </button>
              <button type="button" onClick={() => setIsAdding(false)} className="glass-btn-secondary px-4 py-2 text-sm">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* View Toggle + Navigation */}
      <div className="glass-card p-2 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setView('week')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              view === 'week' ? 'bg-primary-500 text-white shadow-sm' : 'text-primary-600 hover:bg-white/50'
            }`}
          >
            Week
          </button>
          <button
            onClick={() => setView('month')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              view === 'month' ? 'bg-primary-500 text-white shadow-sm' : 'text-primary-600 hover:bg-white/50'
            }`}
          >
            Month
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={goBack} className="p-1.5 text-primary-600 hover:bg-white/50 rounded-lg transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-primary-800 px-2 min-w-[130px] text-center">
            {view === 'week'
              ? `${format(range.start, 'MMM d')} — ${format(range.end, 'MMM d, yyyy')}`
              : format(currentDate, 'MMMM yyyy')
            }
          </span>
          <button onClick={goForward} className="p-1.5 text-primary-600 hover:bg-white/50 rounded-lg transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Events Display */}
      {loading ? (
        <div className="text-center py-12 text-primary-400 text-sm">Loading events…</div>
      ) : eventsInRange.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <CalendarDays className="w-10 h-10 text-primary-300 mx-auto mb-3" />
          <p className="text-primary-500 text-sm">No events scheduled for this {view}.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {view === 'week' ? (
            /* Week view: group by day */
            daysInRange.map(day => {
              const dayEvents = eventsInRange.filter(ev => {
                  try { return isSameDay(parseISO(ev.event_date), day); }
                  catch { return false; }
              });
              if (dayEvents.length === 0) return null;
              return (
                <div key={day.toISOString()} className="glass-card-solid p-3.5">
                  <h3 className="font-semibold text-primary-700 text-sm mb-2">
                    {format(day, 'EEEE, MMM d')}
                  </h3>
                  <div className="space-y-2">
                    {dayEvents.map(ev => (
                      <EventCard key={ev.id} event={ev} onDelete={deleteEvent} />
                    ))}
                  </div>
                </div>
              );
            })
          ) : (
            /* Month view: simple list */
            <div className="space-y-2">
              {eventsInRange.map(ev => (
                <EventCard key={ev.id} event={ev} onDelete={deleteEvent} showDate />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Event Card ── */
function EventCard({ event, onDelete, showDate = false }: { event: UpcomingEvent; onDelete: (id: string) => void; showDate?: boolean }) {
  const reminderLabel = REMINDER_OPTIONS.find(o => o.value === event.reminder_minutes)?.label;

  return (
    <div className="glass-card flex items-center justify-between p-3 gap-3">
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-gray-800 text-sm truncate">{event.title}</h4>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          {showDate && event.event_date && (
            <span className="text-xs font-medium text-primary-600 flex items-center gap-1">
              <CalendarDays className="w-3 h-3" />
              {format(parseISO(event.event_date), 'MMM d')}
            </span>
          )}
          {event.event_time && (
            <span className="text-xs text-primary-500 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {event.event_time}
            </span>
          )}
          {event.reminder_minutes && event.reminder_minutes > 0 && (
            <span className="text-xs text-amber-600 flex items-center gap-1 bg-amber-50 px-1.5 py-0.5 rounded">
              <Bell className="w-3 h-3" />
              {reminderLabel}
            </span>
          )}
        </div>
      </div>
      <button
        onClick={() => onDelete(event.id)}
        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
        title="Delete event"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}
