import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, Pencil, X, Check, ChevronDown, ChevronRight, Bell, Flag, Clock } from 'lucide-react';
import { requestNotificationPermission, getPermissionStatus, scheduleNotification, cancelEventReminder } from '../lib/notifications';

/* ────────── Types ────────── */
type DatabaseTask = {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: string;
  completed: boolean;
  points: number;
  user_id: string;
  created_at: string;
};

type TodayListItem = {
  id: string;
  title: string;
  completed: boolean;
};

type HeadlineMeta = {
  type: string;
  items: TodayListItem[];
};

export default function TodayPage() {
  const [tasks, setTasks] = useState<DatabaseTask[]>([]);
  const [newTask, setNewTask] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [taskTime, setTaskTime] = useState('');
  const [notify, setNotify] = useState(false);
  
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskText, setEditingTaskText] = useState('');
  const [editingPriority, setEditingPriority] = useState('');
  const [editingTime, setEditingTime] = useState('');
  const [editingNotify, setEditingNotify] = useState(false);

  const [loadingTasks, setLoadingTasks] = useState(true);

  const [headlines, setHeadlines] = useState<DatabaseTask[]>([]);
  const [newHeadline, setNewHeadline] = useState('');
  const [newItems, setNewItems] = useState<Record<string, string>>({});
  const [expandedHeadlines, setExpandedHeadlines] = useState<Set<string>>(new Set());

  const taskInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchAllTasks();
  }, []);

  const getUserId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id;
  };

  const fetchAllTasks = async () => {
    try {
      setLoadingTasks(true);
      const userId = await getUserId();
      if (!userId) return;

      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const normalTasks: DatabaseTask[] = [];
      const headlineTasks: DatabaseTask[] = [];
      const expanded = new Set<string>();

      (data || []).forEach(t => {
        if (t.description && t.description.startsWith('{"type":"headline"')) {
          headlineTasks.push(t);
          expanded.add(t.id);
        } else if (!t.description || t.description === 'today_task' || t.description.startsWith('{"type":"today"')) {
          normalTasks.push(t);
          if(t.description && t.description.startsWith('{')) {
              try {
                  const meta = JSON.parse(t.description);
                  if(meta.notify && meta.time && !t.completed) {
                      const today = new Date();
                      const [hours, mins] = meta.time.split(':');
                      today.setHours(Number(hours), Number(mins), 0, 0);
                      if(today.getTime() > Date.now()) {
                          scheduleNotification('Task Reminder', t.title, today, 'task-'+t.id);
                      }
                  } else {
                      cancelEventReminder('task-'+t.id);
                  }
              }catch(e){}
          }
        }
      });

      setTasks(normalTasks);
      setHeadlines(headlineTasks);
      setExpandedHeadlines(expanded);
    } catch (e) {
      console.error('fetchAllTasks', e);
    } finally {
      setLoadingTasks(false);
    }
  };

  const addTask = async () => {
    if (!newTask.trim()) return;
    
    if (notify && taskTime) {
      const perm = getPermissionStatus();
      if (perm === 'default') await requestNotificationPermission();
    }

    const userId = await getUserId();
    if (!userId) return;
    
    const tempId = 'temp-' + Date.now();
    const meta = { type: 'today', time: taskTime, notify: notify && !!taskTime };
    const descString = JSON.stringify(meta);
    
    const optimisticTask: DatabaseTask = {
      id: tempId,
      user_id: userId,
      title: newTask.trim(),
      description: descString,
      completed: false,
      priority: priority,
      points: 10,
      due_date: null,
      created_at: new Date().toISOString()
    };
    
    setTasks(prev => [...prev, optimisticTask]);
    setNewTask('');
    setNotify(false);
    setTaskTime('');
    setPriority('Medium');
    taskInputRef.current?.focus();

    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert({ 
          user_id: userId, 
          title: optimisticTask.title, 
          completed: false,
          description: descString,
          priority: priority,
          points: 10
        })
        .select()
        .single();
        
      if (error) throw error;
      setTasks(prev => prev.map(t => t.id === tempId ? data : t));
      
      if(meta.notify && taskTime) {
          const today = new Date();
          const [hours, mins] = taskTime.split(':');
          today.setHours(Number(hours), Number(mins), 0, 0);
          if(today.getTime() > Date.now()) {
              scheduleNotification('Task Reminder', data.title, today, 'task-'+data.id);
          }
      }
    } catch (e) {
      console.error('addTask', e);
      setTasks(prev => prev.filter(t => t.id !== tempId));
      alert('Unable to add task. Please check your connection.');
    }
  };

  const toggleTask = async (task: DatabaseTask) => {
    const newVal = !task.completed;
    setTasks(tasks.map(t => t.id === task.id ? { ...t, completed: newVal } : t));
    try {
      const { error } = await supabase.from('tasks').update({ completed: newVal }).eq('id', task.id);
      if (error) throw error;
    } catch (e) {
      console.error('toggleTask', e);
      setTasks(tasks.map(t => t.id === task.id ? { ...t, completed: !newVal } : t));
    }
  };

  const deleteTask = async (id: string) => {
    if(id.startsWith('temp-')) return;
    cancelEventReminder('task-'+id);
    setTasks(tasks.filter(t => t.id !== id));
    try {
      await supabase.from('tasks').delete().eq('id', id);
    } catch (e) {
      console.error('deleteTask', e);
      fetchAllTasks();
    }
  };

  const startEditTask = (task: DatabaseTask) => {
    if(task.id.startsWith('temp-')) return;
    setEditingTaskId(task.id);
    setEditingTaskText(task.title);
    setEditingPriority(task.priority);
    
    let tTime = '';
    let tNotify = false;
    try {
      if(task.description && task.description.startsWith('{')) {
         const m = JSON.parse(task.description);
         if(m.time) tTime = m.time;
         if(m.notify) tNotify = m.notify;
      }
    } catch(e) {}
    setEditingTime(tTime);
    setEditingNotify(tNotify);
  };

  const saveEditTask = async () => {
    if (!editingTaskId || !editingTaskText.trim()) return;
    
    const editId = editingTaskId;
    const meta = { type: 'today', time: editingTime, notify: editingNotify && !!editingTime };
    const descString = JSON.stringify(meta);
    
    setTasks(tasks.map(t => t.id === editId ? { ...t, title: editingTaskText.trim(), priority: editingPriority, description: descString } : t));
    setEditingTaskId(null);
    try {
      await supabase.from('tasks').update({ title: editingTaskText.trim(), priority: editingPriority, description: descString }).eq('id', editId);
      
      if (meta.notify && editingTime) {
         const perm = getPermissionStatus();
         if (perm === 'default') await requestNotificationPermission();
         const today = new Date();
         const [hours, mins] = editingTime.split(':');
         today.setHours(Number(hours), Number(mins), 0, 0);
         if(today.getTime() > Date.now()) {
            scheduleNotification('Task Reminder', editingTaskText.trim(), today, 'task-'+editId);
         }
      } else {
         cancelEventReminder('task-'+editId);
      }
    } catch (e) {
      console.error('saveEditTask', e);
      fetchAllTasks();
    }
  };

  const cancelEditTask = () => {
    setEditingTaskId(null);
    setEditingTaskText('');
  };

  const parseHeadlineMeta = (metaString: string | null): HeadlineMeta => {
    try {
      if (!metaString) return { type: 'headline', items: [] };
      return JSON.parse(metaString);
    } catch {
      return { type: 'headline', items: [] };
    }
  };

  const addHeadline = async () => {
    if (!newHeadline.trim()) return;
    const tempId = 'temp-' + Date.now();
    const meta: HeadlineMeta = { type: 'headline', items: [] };
    const userId = await getUserId();
    if(!userId) return;
    
    const optHeadline: DatabaseTask = {
      id: tempId, user_id: userId, title: newHeadline.trim(),
      description: JSON.stringify(meta), completed: false, priority: 'List',
      points: 0, due_date: null, created_at: new Date().toISOString()
    };
    
    setHeadlines([...headlines, optHeadline]);
    setExpandedHeadlines(prev => new Set(prev).add(tempId));
    setNewHeadline('');
    
    try {
      const { data, error } = await supabase.from('tasks').insert({ 
          user_id: userId, title: optHeadline.title, description: optHeadline.description, completed: false, priority: 'List', points: 0
      }).select().single();
      if (error) throw error;
      setHeadlines(prev => prev.map(h => h.id === tempId ? data : h));
      setExpandedHeadlines(prev => { const next = new Set(prev); next.delete(tempId); next.add(data.id); return next; });
    } catch (e) {
      setHeadlines(prev => prev.filter(h => h.id !== tempId));
    }
  };

  const deleteHeadline = async (id: string) => {
    if(id.startsWith('temp-')) return;
    if (!window.confirm('Delete this headline and all its items?')) return;
    setHeadlines(headlines.filter(h => h.id !== id));
    try { await supabase.from('tasks').delete().eq('id', id); } catch (e) { fetchAllTasks(); }
  };

  const addItemToHeadline = async (headlineId: string) => {
    if(headlineId.startsWith('temp-')) return;
    const text = newItems[headlineId]?.trim();
    if (!text) return;
    
    try {
      const headline = headlines.find(h => h.id === headlineId);
      if (!headline) return;
      const meta = parseHeadlineMeta(headline.description);
      const newItem: TodayListItem = { id: Date.now().toString() + Math.random().toString(36).substr(2, 5), title: text, completed: false };
      meta.items.push(newItem);
      const updatedDesc = JSON.stringify(meta);
      
      setHeadlines(headlines.map(h => h.id === headlineId ? { ...h, description: updatedDesc } : h));
      setNewItems({ ...newItems, [headlineId]: '' });
      await supabase.from('tasks').update({ description: updatedDesc }).eq('id', headlineId);
    } catch (e) { fetchAllTasks(); }
  };

  const toggleHeadlineItem = async (headlineId: string, itemId: string) => {
    try {
      const headline = headlines.find(h => h.id === headlineId);
      if (!headline) return;
      const meta = parseHeadlineMeta(headline.description);
      meta.items = meta.items.map(i => i.id === itemId ? { ...i, completed: !i.completed } : i);
      const updatedDesc = JSON.stringify(meta);
      setHeadlines(headlines.map(h => h.id === headlineId ? { ...h, description: updatedDesc } : h));
      await supabase.from('tasks').update({ description: updatedDesc }).eq('id', headlineId);
    } catch (e) { fetchAllTasks(); }
  };

  const deleteHeadlineItem = async (headlineId: string, itemId: string) => {
    try {
      const headline = headlines.find(h => h.id === headlineId);
      if (!headline) return;
      const meta = parseHeadlineMeta(headline.description);
      meta.items = meta.items.filter(i => i.id !== itemId);
      const updatedDesc = JSON.stringify(meta);
      setHeadlines(headlines.map(h => h.id === headlineId ? { ...h, description: updatedDesc } : h));
      await supabase.from('tasks').update({ description: updatedDesc }).eq('id', headlineId);
    } catch (e) { fetchAllTasks(); }
  };

  const toggleExpand = (id: string) => {
    setExpandedHeadlines(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-8 pb-20 animate-fade-in-up">
      <section>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-primary-900">Today</h1>
          <span className="text-xs font-medium text-primary-500 bg-primary-100/60 px-3 py-1 rounded-full">
            {tasks.filter(t => t.completed).length} / {tasks.length} done
          </span>
        </div>

        <div className="glass-card p-3 mb-4">
          <div className="flex items-center gap-2">
            <input
              ref={taskInputRef}
              type="text"
              value={newTask}
              onChange={e => setNewTask(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTask()}
              placeholder="Add a task for today..."
              className="glass-input border-0 flex-1 bg-transparent focus:shadow-none text-sm"
            />
          </div>
          {newTask.trim().length > 0 && (
             <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-primary-200/30 mt-2 animate-fade-in">
               <div className="flex flex-wrap items-center gap-3">
                 <select value={priority} onChange={e => setPriority(e.target.value)} className="glass-input text-xs py-1 px-2 w-auto">
                   <option value="Low">Low</option>
                   <option value="Medium">Medium</option>
                   <option value="High">High</option>
                 </select>
                 
                 <div className="flex items-center gap-2 bg-white/50 px-2 py-1 rounded-lg border border-primary-100">
                   <Clock className="w-3.5 h-3.5 text-primary-500" />
                   <input type="time" title="Task Time (Optional)" value={taskTime} onChange={e => setTaskTime(e.target.value)} className="bg-transparent border-0 text-xs focus:ring-0 p-0 text-primary-700 w-[70px]" />
                 </div>

                 {taskTime && (
                   <label className="flex items-center gap-1.5 text-xs text-primary-700 cursor-pointer hover:bg-white/50 px-2 py-1 rounded-lg transition-colors">
                     <input type="checkbox" checked={notify} onChange={e => setNotify(e.target.checked)} className="task-checkbox w-3.5 h-3.5" />
                     <Bell className="w-3 h-3" /> Notify
                   </label>
                 )}
               </div>
               <button onClick={addTask} className="glass-btn px-4 py-1.5 text-sm shrink-0 uppercase tracking-wider font-semibold">Save Task</button>
             </div>
          )}
        </div>

        {loadingTasks ? (
          <div className="text-center py-8 text-primary-400 text-sm">Loading tasks…</div>
        ) : tasks.length === 0 ? (
          <div className="glass-card p-8 text-center">
            <p className="text-primary-400 text-sm">No tasks yet. Add one above! 🚀</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.map(task => {
              let notifMeta: any = null;
              try { if(task.description && task.description.startsWith('{')) notifMeta = JSON.parse(task.description); } catch(e){}
              
              return (
              <div
                key={task.id}
                className={`glass-card p-3 flex flex-col sm:flex-row sm:items-center gap-3 transition-all duration-200 ${task.completed ? 'opacity-60' : ''}`}
              >
                <div className="flex items-center gap-3 flex-1">
                  <input
                    type="checkbox"
                    checked={task.completed}
                    onChange={() => toggleTask(task)}
                    className="task-checkbox shrink-0"
                  />

                  {editingTaskId === task.id ? (
                    <div className="flex-1 flex flex-col gap-2 min-w-0">
                      <input
                        type="text"
                        value={editingTaskText}
                        onChange={e => setEditingTaskText(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') saveEditTask();
                          if (e.key === 'Escape') cancelEditTask();
                        }}
                        className="glass-input text-sm py-1.5 w-full"
                        autoFocus
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <select value={editingPriority} onChange={e => setEditingPriority(e.target.value)} className="glass-input text-xs py-1 px-2 w-auto">
                          <option value="Low">Low</option>
                          <option value="Medium">Medium</option>
                          <option value="High">High</option>
                        </select>
                        
                        <div className="flex items-center gap-2 bg-white/50 px-2 py-1 rounded-lg border border-primary-100">
                          <Clock className="w-3.5 h-3.5 text-primary-500" />
                          <input type="time" title="Task Time (Optional)" value={editingTime} onChange={e => setEditingTime(e.target.value)} className="bg-transparent border-0 text-xs focus:ring-0 p-0 text-primary-700 w-[70px]" />
                        </div>

                        {editingTime && (
                           <label className="flex items-center gap-1.5 text-xs text-primary-700 cursor-pointer">
                             <input type="checkbox" checked={editingNotify} onChange={e => setEditingNotify(e.target.checked)} className="task-checkbox w-3.5 h-3.5" />
                             <span className="flex items-center gap-1"><Bell className="w-3 h-3" />Notify</span>
                           </label>
                        )}
                        
                        <div className="flex items-center ml-auto gap-1">
                          <button onClick={saveEditTask} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors shrink-0">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={cancelEditTask} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors shrink-0">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1 min-w-0 pt-0.5">
                        <span className={`font-handwriting text-[1.1rem] leading-none block truncate ${task.completed ? 'task-completed' : 'text-gray-800'}`}>
                          {task.title}
                        </span>
                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                          <span className={`text-[0.65rem] font-semibold px-2 py-0.5 rounded-md flex items-center gap-1 ${task.priority === 'High' ? 'bg-red-100 text-red-700 border border-red-200' : task.priority === 'Low' ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-primary-100 text-primary-700 border border-primary-200'}`}>
                             <Flag className="w-2.5 h-2.5" /> {task.priority.toUpperCase()}
                          </span>
                          
                          {notifMeta?.time && (
                            <span className="text-[0.65rem] font-medium px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 border border-gray-200 flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" /> {notifMeta.time}
                            </span>
                          )}

                          {notifMeta?.notify && notifMeta?.time && (
                            <span className="text-[0.65rem] font-semibold px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 border border-amber-200 flex items-center gap-1">
                              <Bell className="w-2.5 h-2.5" /> ON
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => startEditTask(task)}
                          className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deleteTask(task.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )})}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xl font-bold text-primary-900 mb-4">Today List</h2>

        <div className="glass-card p-1 flex items-center mb-4">
          <input
            type="text"
            value={newHeadline}
            onChange={e => setNewHeadline(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addHeadline()}
            placeholder="Add a headline (e.g., Website Work)"
            className="glass-input border-0 flex-1 bg-transparent focus:shadow-none text-sm"
          />
          <button
            onClick={addHeadline}
            disabled={!newHeadline.trim()}
            className="glass-btn ml-1 px-3 py-2 text-sm shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add</span>
          </button>
        </div>

        {loadingTasks ? (
          <div className="text-center py-8 text-primary-400 text-sm">Loading lists…</div>
        ) : headlines.length === 0 ? (
          <div className="glass-card p-8 text-center">
            <p className="text-primary-400 text-sm">No lists yet. Create a headline to organise today's work! 📋</p>
          </div>
        ) : (
          <div className="space-y-4">
            {headlines.map(headline => {
              const meta = parseHeadlineMeta(headline.description);
              const items = meta.items;
              const isExpanded = expandedHeadlines.has(headline.id);
              const doneCount = items.filter((i: TodayListItem) => i.completed).length;
              
              return (
                <div key={headline.id} className="glass-card-solid overflow-hidden">
                  <div
                    className="flex items-center justify-between p-3.5 cursor-pointer hover:bg-white/30 transition-colors"
                    onClick={() => toggleExpand(headline.id)}
                  >
                    <div className="flex items-center gap-2">
                      {isExpanded
                        ? <ChevronDown className="w-4 h-4 text-primary-500" />
                        : <ChevronRight className="w-4 h-4 text-primary-500" />
                      }
                      <h3 className="font-semibold text-primary-800 text-sm">{headline.title}</h3>
                      <span className="text-[0.65rem] font-medium text-primary-400 bg-primary-100/60 px-2 py-0.5 rounded-full">
                        {doneCount}/{items.length}
                      </span>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteHeadline(headline.id); }}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete headline"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="px-3.5 pb-3.5 animate-fade-in">
                      {items.length > 0 && (
                        <div className="space-y-1.5 mb-3">
                          {items.map((item: TodayListItem) => (
                            <div
                              key={item.id}
                              className={`flex items-center gap-3 p-2 rounded-lg transition-all ${item.completed ? 'opacity-55' : 'hover:bg-white/40'}`}
                            >
                              <input
                                type="checkbox"
                                checked={item.completed}
                                onChange={() => toggleHeadlineItem(headline.id, item.id)}
                                className="task-checkbox"
                              />
                              <span className={`flex-1 font-handwriting text-[1.1rem] pt-1 leading-none ${item.completed ? 'task-completed' : 'text-gray-700'}`}>
                                {item.title}
                              </span>
                              <button
                                onClick={() => deleteHeadlineItem(headline.id, item.id)}
                                className="p-1 text-gray-300 hover:text-red-500 rounded transition-colors"
                                title="Remove"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={newItems[headline.id] || ''}
                          onChange={e => setNewItems({ ...newItems, [headline.id]: e.target.value })}
                          onKeyDown={e => e.key === 'Enter' && addItemToHeadline(headline.id)}
                          placeholder="Add checklist item…"
                          className="glass-input text-sm py-1.5 flex-1"
                        />
                        <button
                          onClick={() => addItemToHeadline(headline.id)}
                          disabled={!(newItems[headline.id]?.trim())}
                          className="glass-btn px-2.5 py-1.5 text-xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
