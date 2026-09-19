import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, CheckCircle2, Circle, Trash2, Calendar, Award, ListTodo } from 'lucide-react';
import { format, isToday, isPast, isFuture, parseISO } from 'date-fns';

type Task = {
  id: string;
  title: string;
  description: string;
  due_date: string | null;
  priority: string;
  completed: boolean;
  points: number;
};

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  
  // Form state
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      setIsSubmitting(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const newTask = {
        user_id: user.id,
        title,
        description,
        due_date: dueDate || null,
        priority,
        points: 100 // default points
      };

      const { data, error } = await supabase.from('tasks').insert(newTask).select().single();
      if (error) throw error;

      setTasks([data, ...tasks]);
      setIsAdding(false);
      setTitle('');
      setDescription('');
      setDueDate('');
      setPriority('Medium');
    } catch (error) {
      console.error(error);
      alert('Failed to create task');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleTaskCompletion = async (task: Task) => {
    const newStatus = !task.completed;
    
    // Optimistic update
    setTasks(tasks.map(t => t.id === task.id ? { ...t, completed: newStatus } : t));

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('tasks')
        .update({ 
          completed: newStatus,
          completed_at: newStatus ? new Date().toISOString() : null
        })
        .eq('id', task.id);

      if (error) throw error;

      // Handle Points Transaction
      if (newStatus) {
        // Award points
        await supabase.from('points_transactions').insert({
          user_id: user.id,
          task_id: task.id,
          type: 'Task Completion',
          points: task.points,
          description: `Completed task: ${task.title}`
        });

        // Update total points in profile using a direct RPC if possible, but for now just let the client do it or trigger
        const { data: profile } = await supabase.from('profiles').select('total_points').eq('id', user.id).single();
        if (profile) {
          await supabase.from('profiles').update({ total_points: profile.total_points + task.points }).eq('id', user.id);
        }
      } else {
        // Remove points (if uncompleted) - simple implementation
        await supabase.from('points_transactions').delete().eq('task_id', task.id);
        const { data: profile } = await supabase.from('profiles').select('total_points').eq('id', user.id).single();
        if (profile) {
          await supabase.from('profiles').update({ total_points: Math.max(0, profile.total_points - task.points) }).eq('id', user.id);
        }
      }

    } catch (error) {
      console.error(error);
      // Revert optimistic update
      setTasks(tasks.map(t => t.id === task.id ? { ...t, completed: !newStatus } : t));
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (!window.confirm('Delete this task?')) return;
    
    setTasks(tasks.filter(t => t.id !== id));
    try {
      await supabase.from('tasks').delete().eq('id', id);
    } catch (error) {
      console.error(error);
      fetchTasks(); // refresh if failed
    }
  };

  // Filtering Logic
  const getFilteredTasks = () => {
    let filtered = tasks;

    // Search filter
    if (search) {
      filtered = filtered.filter(t => t.title.toLowerCase().includes(search.toLowerCase()) || (t.description && t.description.toLowerCase().includes(search.toLowerCase())));
    }

    // Category filter
    switch (filter) {
      case 'Today':
        filtered = filtered.filter(t => t.due_date && isToday(parseISO(t.due_date)));
        break;
      case 'Upcoming':
        filtered = filtered.filter(t => t.due_date && isFuture(parseISO(t.due_date)) && !isToday(parseISO(t.due_date)));
        break;
      case 'Overdue':
        filtered = filtered.filter(t => !t.completed && t.due_date && isPast(parseISO(t.due_date)) && !isToday(parseISO(t.due_date)));
        break;
      case 'Pending':
        filtered = filtered.filter(t => !t.completed);
        break;
      case 'Completed':
        filtered = filtered.filter(t => t.completed);
        break;
      default:
        break;
    }

    return filtered;
  };

  const filteredTasks = getFilteredTasks();

  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'High': return 'text-red-600 bg-red-50 border-red-200';
      case 'Medium': return 'text-amber-600 bg-amber-50 border-amber-200';
      case 'Low': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
          <p className="text-gray-500 mt-1">Manage and track your daily productivity.</p>
        </div>
        {!isAdding && (
          <button 
            onClick={() => setIsAdding(true)}
            className="flex items-center space-x-2 bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-xl transition-colors font-medium shadow-sm"
          >
            <Plus className="w-5 h-5" />
            <span>New Task</span>
          </button>
        )}
      </header>

      {/* Task Creation Form */}
      {isAdding && (
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm animate-in fade-in slide-in-from-top-4">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Create New Task</h2>
          </div>
          <form onSubmit={handleCreateTask} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Task Title <span className="text-red-500">*</span></label>
              <input required value={title} onChange={e => setTitle(e.target.value)} type="text" className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none" placeholder="What needs to be done?" autoFocus />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none min-h-[80px]" placeholder="Add details..."></textarea>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                <input value={dueDate} onChange={e => setDueDate(e.target.value)} type="date" className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <select value={priority} onChange={e => setPriority(e.target.value)} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none bg-white">
                  <option value="Low">Low Priority</option>
                  <option value="Medium">Medium Priority</option>
                  <option value="High">High Priority</option>
                </select>
              </div>
            </div>

            <div className="pt-4 flex items-center space-x-3">
              <button type="submit" disabled={isSubmitting} className="bg-primary-600 text-white font-medium px-6 py-2.5 rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50">
                {isSubmitting ? 'Saving...' : 'Create Task'}
              </button>
              <button type="button" onClick={() => setIsAdding(false)} className="text-gray-600 font-medium px-6 py-2.5 rounded-xl hover:bg-gray-100 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-3 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex overflow-x-auto w-full md:w-auto space-x-2 pb-2 md:pb-0 hide-scrollbar">
          {['All', 'Today', 'Upcoming', 'Pending', 'Completed', 'Overdue'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${filter === f ? 'bg-primary-100 text-primary-700' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="w-full md:w-64 relative">
          <input 
            type="text" 
            placeholder="Search tasks..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-4 pr-10 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none text-sm"
          />
        </div>
      </div>

      {/* Task List */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading tasks...</div>
      ) : filteredTasks.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-gray-100 border-dashed">
          <ListTodo className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-gray-900 font-medium mb-1">No tasks found</h3>
          <p className="text-sm text-gray-500">
            {search ? 'Try adjusting your search.' : filter === 'All' ? "You're all caught up! Add a new task to get started." : `You have no ${filter.toLowerCase()} tasks.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map(task => (
            <div 
              key={task.id} 
              className={`bg-white p-4 md:p-5 rounded-2xl border ${task.completed ? 'border-gray-100 opacity-60' : 'border-gray-200 shadow-sm'} flex items-start gap-4 transition-all`}
            >
              <button 
                onClick={() => toggleTaskCompletion(task)}
                className={`shrink-0 mt-0.5 ${task.completed ? 'text-primary-500' : 'text-gray-300 hover:text-primary-400'} transition-colors`}
              >
                {task.completed ? <CheckCircle2 className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
              </button>
              
              <div className="flex-1 min-w-0">
                <h3 className={`font-semibold text-gray-900 ${task.completed ? 'line-through text-gray-500' : ''}`}>
                  {task.title}
                </h3>
                {task.description && (
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{task.description}</p>
                )}
                
                <div className="flex flex-wrap items-center gap-3 mt-3">
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${getPriorityColor(task.priority)}`}>
                    {task.priority}
                  </span>
                  
                  {task.due_date && (
                    <span className={`flex items-center text-xs font-medium ${isPast(parseISO(task.due_date)) && !isToday(parseISO(task.due_date)) && !task.completed ? 'text-red-600' : 'text-gray-500'}`}>
                      <Calendar className="w-3.5 h-3.5 mr-1.5" />
                      {format(parseISO(task.due_date), 'MMM d, yyyy')}
                    </span>
                  )}
                  
                  <span className="flex items-center text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                    <Award className="w-3.5 h-3.5 mr-1" />
                    +{task.points} pts
                  </span>
                </div>
              </div>
              
              <button 
                onClick={() => handleDeleteTask(task.id)}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors shrink-0"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
