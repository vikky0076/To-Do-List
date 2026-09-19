import { CheckCircle2, ListChecks, CalendarDays, Flame } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../lib/UserContext';

export default function Dashboard() {
  const { displayName: userName } = useUser();
  const [todayTaskCount, setTodayTaskCount] = useState(0);
  const [todayDone, setTodayDone] = useState(0);
  const [upcomingCount, setUpcomingCount] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Today tasks
    const { data: todayTasks } = await supabase
      .from('tasks')
      .select('id, completed, description')
      .eq('user_id', user.id);
    if (todayTasks) {
      const validTasks = todayTasks.filter(t => t.description === 'today_task' || !t.description);
      setTodayTaskCount(validTasks.length);
      setTodayDone(validTasks.filter(t => t.completed).length);
    }

    // Upcoming events  
    const { data: events } = await supabase
      .from('tasks')
      .select('id, description')
      .eq('user_id', user.id)
      .gte('due_date', format(new Date(), 'yyyy-MM-dd'));
      
    if (events) {
      const parsedEvents = events.filter(t => t.description && t.description.startsWith('{"type":"event"'));
      setUpcomingCount(parsedEvents.length);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const progressPercent = todayTaskCount > 0 ? Math.round((todayDone / todayTaskCount) * 100) : 0;

  return (
    <div className="space-y-6 animate-fade-in-up">
      <header>
        <h1 className="text-2xl font-bold text-primary-900">
          {getGreeting()}, {userName ? <span className="capitalize">{userName}</span> : 'User'}
        </h1>
        <p className="text-primary-500 text-sm mt-1">{format(new Date(), 'EEEE, MMMM do, yyyy')}</p>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          title="Today's Tasks"
          value={String(todayTaskCount)}
          subtitle={`${todayTaskCount - todayDone} Pending`}
          icon={<ListChecks className="w-5 h-5 text-primary-500" />}
          onClick={() => navigate('/today')}
        />
        <StatCard
          title="Completed"
          value={`${todayDone} / ${todayTaskCount}`}
          subtitle="Today"
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />}
          onClick={() => navigate('/today')}
        />
        <StatCard
          title="Upcoming"
          value={String(upcomingCount)}
          subtitle="Events"
          icon={<CalendarDays className="w-5 h-5 text-blue-500" />}
          onClick={() => navigate('/upcoming')}
        />
        <StatCard
          title="Streak"
          value="0 Days"
          subtitle="Current"
          icon={<Flame className="w-5 h-5 text-orange-500" />}
          onClick={() => {}}
        />
      </div>

      {/* Progress Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 glass-card-solid p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-primary-800 text-sm">Today's Progress</h3>
            <span className="text-sm text-primary-600 font-bold">{progressPercent}%</span>
          </div>
          <div className="w-full bg-primary-100/50 rounded-full h-2.5 mb-5">
            <div
              className="bg-gradient-to-r from-primary-400 to-primary-600 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          {todayTaskCount === 0 ? (
            <div className="text-center py-6">
              <p className="text-primary-400 text-sm">No tasks for today 🎉</p>
              <button
                onClick={() => navigate('/today')}
                className="mt-3 text-primary-600 font-medium text-sm hover:underline"
              >
                Create your first task →
              </button>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-primary-500 text-sm">
                {todayDone === todayTaskCount
                  ? 'All tasks completed! Great job! 🎉'
                  : `${todayTaskCount - todayDone} task${todayTaskCount - todayDone !== 1 ? 's' : ''} remaining`
                }
              </p>
              <button
                onClick={() => navigate('/today')}
                className="mt-2 text-primary-600 font-medium text-sm hover:underline"
              >
                Go to Today →
              </button>
            </div>
          )}
        </div>

        <div className="glass-card-solid p-5">
          <h3 className="font-semibold text-primary-800 text-sm mb-3">Upcoming</h3>
          {upcomingCount === 0 ? (
            <div className="text-center py-6">
              <p className="text-primary-400 text-xs">No upcoming events.</p>
              <button
                onClick={() => navigate('/upcoming')}
                className="mt-2 text-primary-600 font-medium text-xs hover:underline"
              >
                Schedule an event →
              </button>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-primary-500 text-sm font-medium">{upcomingCount} event{upcomingCount !== 1 ? 's' : ''}</p>
              <button
                onClick={() => navigate('/upcoming')}
                className="mt-2 text-primary-600 font-medium text-xs hover:underline"
              >
                View events →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, subtitle, icon, onClick }: {
  title: string; value: string; subtitle: string; icon: React.ReactNode; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="glass-card-solid p-4 flex flex-col text-left hover:shadow-md transition-all duration-200 cursor-pointer group"
    >
      <div className="flex items-center space-x-2 mb-2">
        <div className="p-1.5 rounded-lg bg-white/60 group-hover:bg-white/80 transition-colors">
          {icon}
        </div>
        <span className="text-xs font-medium text-primary-600">{title}</span>
      </div>
      <h4 className="text-xl font-bold text-primary-900">{value}</h4>
      <p className="text-[0.65rem] text-primary-400 mt-0.5">{subtitle}</p>
    </button>
  );
}
