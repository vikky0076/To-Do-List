import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, X, CalendarDays, Clock, Bell, ChevronLeft, ChevronRight, Repeat, Pencil } from 'lucide-react';
import {
  format, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  eachDayOfInterval, isSameDay, addWeeks, addMonths, parseISO,
  isWithinInterval, addDays, addYears, startOfDay, endOfDay
} from 'date-fns';
import {
  requestNotificationPermission, getPermissionStatus,
  scheduleEventReminder, getNotificationSupport, cancelEventReminder
} from '../lib/notifications';

type UpcomingEvent = {
  id: string;
  user_id: string;
  title: string;
  event_date: string; // ISO date
  event_time: string | null; // HH:mm
  reminder_minutes: number | null;
  repeat: string;
  created_at: string;
  generated_date?: string; // used for occurrences mapping
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
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  // Add/Edit form state
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [reminder, setReminder] = useState(0);
  const [repeat, setRepeat] = useState('NONE');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, []);

  // Set up event reminders for the NEXT upcoming occurrence
  useEffect(() => {
    events.forEach(ev => {
      if (ev.reminder_minutes && ev.reminder_minutes > 0 && ev.event_time) {
        try {
          const startDate = startOfDay(parseISO(ev.event_date));
          let current = startDate;
          let foundNext = false;
          let occurrenceCount = 0;
          
          while (occurrenceCount < 365) {
            const evDateTime = new Date(`${format(current, 'yyyy-MM-dd')}T${ev.event_time}`);
            if (evDateTime.getTime() > Date.now()) {
              scheduleEventReminder(ev.id, ev.title, evDateTime, ev.reminder_minutes);
              foundNext = true;
              break;
            }
            if (!ev.repeat || ev.repeat === 'NONE') break;
            
            // Generate next occurrence.
            if (ev.repeat === 'DAILY') current = addDays(current, 1);
            else if (ev.repeat === 'WEEKLY') current = addWeeks(current, 1);
            else if (ev.repeat === 'MONTHLY') current = addMonths(current, 1);
            else if (ev.repeat === 'YEARLY') current = addYears(current, 1);
            else break;
            occurrenceCount++;
          }
          if (!foundNext) cancelEventReminder(ev.id);
        } catch(e) {}
      } else {
        cancelEventReminder(ev.id);
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
              event_date: t.due_date || '',
              event_time: meta.event_time,
              reminder_minutes: meta.reminder_minutes,
              repeat: meta.repeat || 'NONE',
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

  const startEditEvent = (ev: UpcomingEvent) => {
    setEditingEventId(ev.id);
    setTitle(ev.title);
    setEventDate(ev.event_date);
    setEventTime(ev.event_time || '');
    setReminder(ev.reminder_minutes || 0);
    setRepeat(ev.repeat || 'NONE');
    setIsAdding(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const startAddEvent = () => {
    setEditingEventId(null);
    setTitle('');
    setEventDate('');
    setEventTime('');
    setReminder(0);
    setRepeat('NONE');
    setIsAdding(true);
  };

  const cancelForm = () => {
    setIsAdding(false);
    setEditingEventId(null);
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !eventDate) return;
    setIsSubmitting(true);
    
    try {
      if (reminder > 0) {
        const perm = getPermissionStatus();
        if (perm === 'default') await requestNotificationPermission();
      }

      const userId = await getUserId();
      if (!userId) return;

      const meta = { type: 'event', event_time: eventTime || null, reminder_minutes: reminder || null, repeat };

      if (editingEventId) {
        // Edit flow
        const updatedEvent: UpcomingEvent = {
          id: editingEventId,
          user_id: userId,
          title: title.trim(),
          event_date: eventDate,
          event_time: eventTime || null,
          reminder_minutes: reminder || null,
          repeat,
          created_at: events.find(e => e.id === editingEventId)?.created_at || new Date().toISOString()
        };
        
        setEvents(prev => prev.map(ev => ev.id === editingEventId ? updatedEvent : ev).sort((a,b) => a.event_date.localeCompare(b.event_date)));
        
        await supabase
          .from('tasks')
          .update({
            title: updatedEvent.title,
            due_date: updatedEvent.event_date,
            description: JSON.stringify(meta)
          })
          .eq('id', editingEventId);

      } else {
        // Add flow
        const tempId = 'temp-' + Date.now();
        const optEvent: UpcomingEvent = {
          id: tempId,
          user_id: userId,
          title: title.trim(),
          event_date: eventDate,
          event_time: eventTime || null,
          reminder_minutes: reminder || null,
          repeat,
          created_at: new Date().toISOString()
        };

        setEvents(prev => [...prev, optEvent].sort((a,b) => a.event_date.localeCompare(b.event_date)));

        const { data, error } = await supabase
          .from('tasks')
          .insert({
            user_id: userId,
            title: optEvent.title,
            due_date: eventDate,
            description: JSON.stringify(meta),
            completed: false,
            priority: 'Medium',
            points: 50
          })
          .select()
          .single();

        if (error) throw error;
        setEvents(prev => prev.map(ev => ev.id === tempId ? { ...optEvent, id: data.id } : ev));
      }
      
      cancelForm();
    } catch (e) {
      console.error('handleSaveEvent', e);
      fetchEvents();
      alert('Failed to save event. Check connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteEvent = async (id: string) => {
    if (id.startsWith('temp-')) return;
    if (!window.confirm('Delete this event? If it is a recurring event, all future occurrences will be removed.')) return;
    cancelEventReminder(id);
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

  /* ── View Range ── */
  const getRange = () => {
    if (view === 'week') {
      return { start: startOfWeek(currentDate, { weekStartsOn: 1 }), end: endOfWeek(currentDate, { weekStartsOn: 1 }) };
    }
    return { start: startOfMonth(currentDate), end: endOfMonth(currentDate) };
  };

  const range = getRange();
  
  /* ── Generate Occurrences within the Date Range ── */
  const generatedEvents: UpcomingEvent[] = [];
  events.forEach(ev => {
    if (!ev.event_date) return;
    try {
      const startDate = startOfDay(parseISO(ev.event_date));
      const rangeEnd = endOfDay(range.end);
      const rangeStart = startOfDay(range.start);
      
      if (!ev.repeat || ev.repeat === 'NONE') {
        if (isWithinInterval(startDate, { start: rangeStart, end: rangeEnd })) {
           generatedEvents.push({ ...ev, generated_date: ev.event_date });
        }
        return;
      }
      
      let current = startDate;
      let occurrenceCount = 0;
      
      while (current <= rangeEnd && occurrenceCount < 5000) {
        if (current >= rangeStart) {
          generatedEvents.push({ ...ev, generated_date: current.toISOString().slice(0, 10) });
        }
        
        if (ev.repeat === 'DAILY') current = addDays(current, 1);
        else if (ev.repeat === 'WEEKLY') current = addWeeks(current, 1);
        else if (ev.repeat === 'MONTHLY') current = addMonths(current, 1);
        else if (ev.repeat === 'YEARLY') current = addYears(current, 1);
        else break;
        
        occurrenceCount++;
      }
    } catch(e) { }
  });

  const daysInRange = eachDayOfInterval({ start: range.start, end: range.end });
  const notifSupport = getNotificationSupport();

  return (
    <div className="space-y-6 pb-20 animate-fade-in-up">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-primary-900">Upcoming Events</h1>
          <p className="text-primary-500 text-sm mt-0.5">Schedule future programs, tasks, and recurring events.</p>
        </div>
        {!isAdding && (
          <button onClick={startAddEvent} className="glass-btn px-4 py-2.5 text-sm shrink-0">
            <Plus className="w-4 h-4" /> Add Event
          </button>
        )}
      </header>

      {/* Add / Edit Event Form */}
      {isAdding && (
        <div className="glass-card-solid p-5 animate-scale-in border border-primary-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-primary-800">
              {editingEventId ? 'Edit Event' : 'New Event'}
            </h2>
            <button onClick={cancelForm} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg">
              <X className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={handleSaveEvent} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-primary-700 mb-1">Event Name *</label>
              <input
                required
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="glass-input"
                placeholder="e.g., College Fee Payment"
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              <div>
                <label className="block text-xs font-medium text-primary-700 mb-1">
                  <Repeat className="w-3.5 h-3.5 inline mr-1" />Repeat
                </label>
                <select
                  value={repeat}
                  onChange={e => setRepeat(e.target.value)}
                  className="glass-input"
                >
                  <option value="NONE">Does not repeat</option>
                  <option value="DAILY">Daily</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                  <option value="YEARLY">Yearly</option>
                </select>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <button type="submit" disabled={isSubmitting} className="glass-btn px-5 py-2 text-sm w-full sm:w-auto text-center">
                {isSubmitting ? 'Saving…' : 'Save Changes'}
              </button>
              <button type="button" onClick={cancelForm} className="glass-btn-secondary px-4 py-2 text-sm w-full sm:w-auto text-center">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* View Toggle + Navigation */}
      <div className="glass-card p-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setView('week')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              view === 'week' ? 'bg-primary-500 text-white shadow-sm' : 'text-primary-600 hover:bg-white/50'
            }`}
          >
            Week
          </button>
          <button
            onClick={() => setView('month')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
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
          <span className="text-sm font-semibold text-primary-800 px-1 min-w-[120px] text-center">
            {view === 'week'
              ? `${format(range.start, 'MMM d')} - ${format(range.end, 'MMM d')}`
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
      ) : generatedEvents.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <CalendarDays className="w-10 h-10 text-primary-300 mx-auto mb-3" />
          <p className="text-primary-500 text-sm">No events scheduled.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {view === 'week' ? (
            daysInRange.map(day => {
              const dayEvents = generatedEvents.filter(ev => {
                  try { return isSameDay(parseISO(ev.generated_date!), day); }
                  catch { return false; }
              });
              if (dayEvents.length === 0) return null;
              return (
                <div key={day.toISOString()} className="glass-card-solid p-3.5">
                  <h3 className="font-semibold text-primary-700 text-sm mb-2">
                    {format(day, 'EEEE, MMM d')}
                  </h3>
                  <div className="space-y-2">
                    {dayEvents.map((ev, idx) => (
                      <EventCard key={`${ev.id}-${idx}-${ev.generated_date}`} event={ev} onEdit={() => startEditEvent(ev)} onDelete={deleteEvent} />
                    ))}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="space-y-2">
              {generatedEvents.map((ev, idx) => (
                <EventCard key={`${ev.id}-${idx}-${ev.generated_date}`} event={ev} onEdit={() => startEditEvent(ev)} onDelete={deleteEvent} showDate />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EventCard({ event, onEdit, onDelete, showDate = false }: { event: UpcomingEvent; onEdit: () => void; onDelete: (id: string) => void; showDate?: boolean }) {
  const reminderLabel = REMINDER_OPTIONS.find(o => o.value === event.reminder_minutes)?.label;

  return (
    <div className="glass-card flex items-center justify-between p-3 gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 pt-0.5">
          <h4 className="font-handwriting text-[1.15rem] leading-none text-gray-800 truncate">
            {event.title}
          </h4>
          {event.repeat && event.repeat !== 'NONE' && (
             <span title={`Recurs ${event.repeat}`} className="shrink-0"><Repeat className="w-3 h-3 text-primary-400" /></span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          {showDate && event.generated_date && (
            <span className="text-xs font-medium text-primary-600 flex items-center gap-1">
              <CalendarDays className="w-3 h-3" />
              {format(parseISO(event.generated_date), 'MMM d, yyyy')}
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
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onEdit}
          className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors border border-transparent hover:border-primary-100"
          title="Edit event"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          onClick={() => onDelete(event.id)}
          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
          title="Delete event"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
