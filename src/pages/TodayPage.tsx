import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, Pencil, X, Check, ChevronDown, ChevronRight } from 'lucide-react';

/* ────────── Types ────────── */
// Using the existing 'tasks' table schema
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

/* ────────── Component ────────── */
export default function TodayPage() {
  /* ── Today Tasks State ── */
  const [tasks, setTasks] = useState<DatabaseTask[]>([]);
  const [newTask, setNewTask] = useState('');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskText, setEditingTaskText] = useState('');
  const [loadingTasks, setLoadingTasks] = useState(true);

  /* ── Today List (Headlines) State ── */
  const [headlines, setHeadlines] = useState<DatabaseTask[]>([]);
  const [newHeadline, setNewHeadline] = useState('');
  const [newItems, setNewItems] = useState<Record<string, string>>({});
  const [expandedHeadlines, setExpandedHeadlines] = useState<Set<string>>(new Set());

  const taskInputRef = useRef<HTMLInputElement>(null);

  /* ────── Fetch All Tasks ────── */
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

      const allTasks = data || [];
      
      const normalTasks: DatabaseTask[] = [];
      const headlineTasks: DatabaseTask[] = [];
      const expanded = new Set<string>();

      allTasks.forEach(t => {
        if (t.description && t.description.startsWith('{"type":"headline"')) {
          headlineTasks.push(t);
          expanded.add(t.id);
        } else if (t.description === 'today_task' || !t.description) {
          // If it's explicitly a today task, or an old raw task with no description
          normalTasks.push(t);
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

  /* ────── Normal Task Actions ────── */
  const addTask = async () => {
    if (!newTask.trim()) return;
    try {
      const userId = await getUserId();
      if (!userId) return;

      const { data, error } = await supabase
        .from('tasks')
        .insert({ 
          user_id: userId, 
          title: newTask.trim(), 
          completed: false,
          description: 'today_task',
          priority: 'Medium',
          points: 10
        })
        .select()
        .single();
        
      if (error) throw error;
      
      setTasks([...tasks, data]);
      setNewTask('');
      taskInputRef.current?.focus();
    } catch (e) {
      console.error('addTask', e);
      alert('Unable to add task. Please check your connection.');
    }
  };

  const toggleTask = async (task: DatabaseTask) => {
    const newVal = !task.completed;
    setTasks(tasks.map(t => t.id === task.id ? { ...t, completed: newVal } : t));
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ completed: newVal })
        .eq('id', task.id);
      if (error) throw error;
    } catch (e) {
      console.error('toggleTask', e);
      setTasks(tasks.map(t => t.id === task.id ? { ...t, completed: !newVal } : t));
    }
  };

  const deleteTask = async (id: string) => {
    setTasks(tasks.filter(t => t.id !== id));
    try {
      await supabase.from('tasks').delete().eq('id', id);
    } catch (e) {
      console.error('deleteTask', e);
      fetchAllTasks();
    }
  };

  const startEditTask = (task: DatabaseTask) => {
    setEditingTaskId(task.id);
    setEditingTaskText(task.title);
  };

  const saveEditTask = async () => {
    if (!editingTaskId || !editingTaskText.trim()) return;
    setTasks(tasks.map(t => t.id === editingTaskId ? { ...t, title: editingTaskText.trim() } : t));
    setEditingTaskId(null);
    try {
      await supabase.from('tasks').update({ title: editingTaskText.trim() }).eq('id', editingTaskId);
    } catch (e) {
      console.error('saveEditTask', e);
      fetchAllTasks();
    }
  };

  const cancelEditTask = () => {
    setEditingTaskId(null);
    setEditingTaskText('');
  };


  /* ────── Headline & Checklist Actions ────── */
  
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
    try {
      const userId = await getUserId();
      if (!userId) return;
      
      const meta: HeadlineMeta = { type: 'headline', items: [] };
      
      const { data, error } = await supabase
        .from('tasks')
        .insert({ 
          user_id: userId, 
          title: newHeadline.trim(),
          description: JSON.stringify(meta),
          completed: false,
          priority: 'List',
          points: 0
        })
        .select()
        .single();
        
      if (error) throw error;
      
      setHeadlines([...headlines, data]);
      setExpandedHeadlines(prev => new Set(prev).add(data.id));
      setNewHeadline('');
    } catch (e) {
      console.error('addHeadline', e);
      alert('Unable to add headline.');
    }
  };

  const deleteHeadline = async (id: string) => {
    if (!window.confirm('Delete this headline and all its items?')) return;
    setHeadlines(headlines.filter(h => h.id !== id));
    try {
      await supabase.from('tasks').delete().eq('id', id);
    } catch (e) {
      console.error('deleteHeadline', e);
      fetchAllTasks();
    }
  };

  const addItemToHeadline = async (headlineId: string) => {
    const text = newItems[headlineId]?.trim();
    if (!text) return;
    
    try {
      const headline = headlines.find(h => h.id === headlineId);
      if (!headline) return;
      
      const meta = parseHeadlineMeta(headline.description);
      const newItem: TodayListItem = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        title: text,
        completed: false
      };
      
      meta.items.push(newItem);
      const updatedDesc = JSON.stringify(meta);
      
      // Optimistic update
      setHeadlines(headlines.map(h => h.id === headlineId ? { ...h, description: updatedDesc } : h));
      setNewItems({ ...newItems, [headlineId]: '' });
      
      const { error } = await supabase.from('tasks').update({ description: updatedDesc }).eq('id', headlineId);
      if (error) throw error;
      
    } catch (e) {
      console.error('addItemToHeadline', e);
      fetchAllTasks();
    }
  };

  const toggleHeadlineItem = async (headlineId: string, itemId: string) => {
    try {
      const headline = headlines.find(h => h.id === headlineId);
      if (!headline) return;
      
      const meta = parseHeadlineMeta(headline.description);
      let updatedState = false;
      
      meta.items = meta.items.map(i => {
        if (i.id === itemId) {
          updatedState = !i.completed;
          return { ...i, completed: updatedState };
        }
        return i;
      });
      
      const updatedDesc = JSON.stringify(meta);
      
      // Optimistic update
      setHeadlines(headlines.map(h => h.id === headlineId ? { ...h, description: updatedDesc } : h));
      
      await supabase.from('tasks').update({ description: updatedDesc }).eq('id', headlineId);
    } catch (e) {
      console.error('toggleHeadlineItem', e);
      fetchAllTasks();
    }
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
    } catch (e) {
      console.error('deleteHeadlineItem', e);
      fetchAllTasks();
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedHeadlines(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };


  /* ────── Render ────── */
  return (
    <div className="space-y-8 pb-20 animate-fade-in-up">
      {/* ══════════════ SECTION 1: TODAY ══════════════ */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-primary-900">Today</h1>
          <span className="text-xs font-medium text-primary-500 bg-primary-100/60 px-3 py-1 rounded-full">
            {tasks.filter(t => t.completed).length} / {tasks.length} done
          </span>
        </div>

        {/* Add Task */}
        <div className="glass-card p-1 flex items-center mb-4">
          <input
            ref={taskInputRef}
            type="text"
            value={newTask}
            onChange={e => setNewTask(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addTask()}
            placeholder="Add a task for today..."
            className="glass-input border-0 flex-1 bg-transparent focus:shadow-none"
          />
          <button
            onClick={addTask}
            disabled={!newTask.trim()}
            className="glass-btn ml-1 px-3 py-2 text-sm shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add</span>
          </button>
        </div>

        {/* Task List */}
        {loadingTasks ? (
          <div className="text-center py-8 text-primary-400 text-sm">Loading tasks…</div>
        ) : tasks.length === 0 ? (
          <div className="glass-card p-8 text-center">
            <p className="text-primary-400 text-sm">No tasks yet. Add one above! 🚀</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.map(task => (
              <div
                key={task.id}
                className={`glass-card p-3 flex items-center gap-3 transition-all duration-200 ${task.completed ? 'opacity-60' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={task.completed}
                  onChange={() => toggleTask(task)}
                  className="task-checkbox"
                />

                {editingTaskId === task.id ? (
                  <div className="flex-1 flex items-center gap-2">
                    <input
                      type="text"
                      value={editingTaskText}
                      onChange={e => setEditingTaskText(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') saveEditTask();
                        if (e.key === 'Escape') cancelEditTask();
                      }}
                      className="glass-input flex-1 text-sm py-1.5"
                      autoFocus
                    />
                    <button onClick={saveEditTask} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={cancelEditTask} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <span className={`flex-1 text-sm font-medium ${task.completed ? 'task-completed' : 'text-gray-800'}`}>
                      {task.title}
                    </span>
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
            ))}
          </div>
        )}
      </section>

      {/* ══════════════ SECTION 2: TODAY LIST ══════════════ */}
      <section>
        <h2 className="text-xl font-bold text-primary-900 mb-4">Today List</h2>

        {/* Add Headline */}
        <div className="glass-card p-1 flex items-center mb-4">
          <input
            type="text"
            value={newHeadline}
            onChange={e => setNewHeadline(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addHeadline()}
            placeholder="Add a headline (e.g., Website Work)"
            className="glass-input border-0 flex-1 bg-transparent focus:shadow-none"
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
                  {/* Headline Header */}
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

                  {/* Items */}
                  {isExpanded && (
                    <div className="px-3.5 pb-3.5 animate-fade-in">
                      {/* Item list */}
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
                              <span className={`flex-1 text-sm ${item.completed ? 'task-completed' : 'text-gray-700'}`}>
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

                      {/* Add Item */}
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
