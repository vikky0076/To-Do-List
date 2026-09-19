import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useVault } from '../../lib/VaultContext';
import { encryptData, decryptData } from '../../lib/crypto';
import { Plus, Trash2, Eye, EyeOff, ArrowLeft, Lock, X, Image as ImageIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

type VaultEntry = {
  id: string;
  headline: string;
  content: string;
  image?: string;
};

export default function VaultPasswords() {
  const { vaultKey } = useVault();
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);

  // Simple form: Headline + Content
  const [headline, setHeadline] = useState('');
  const [content, setContent] = useState('');
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Visibility
  const [visibleContent, setVisibleContent] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchEntries();
  }, []);

  const fetchEntries = async () => {
    if (!vaultKey) return;
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user?.id)
        .eq('priority', 'Vault')
        .order('created_at', { ascending: false });
      if (error) throw error;

      const decrypted: VaultEntry[] = [];
      for (const item of data || []) {
        try {
          let encData = item.description;
          if (encData && encData.startsWith('{')) {
            encData = JSON.parse(encData).encrypted;
          }
          const d = await decryptData(vaultKey, encData);
          decrypted.push({ id: item.id, headline: d.headline || d.title || 'Untitled', content: d.content || d.password || '', image: d.image });
        } catch {
          // Decryption failed, skip
        }
      }
      setEntries(decrypted);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vaultKey || !headline.trim()) return;
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const itemData = { headline: headline.trim(), content: content, image: imageBase64 };
      const encrypted = await encryptData(vaultKey, itemData);

      const { data, error } = await supabase.from('tasks').insert({
        user_id: user.id,
        title: 'Vault Secret',
        priority: 'Vault',
        completed: false,
        points: 0,
        description: JSON.stringify({ type: 'vault_secret', encrypted: encrypted }),
      }).select().single();

      if (error) throw error;
      setEntries([{ id: data.id, ...itemData }, ...entries]);
      setIsAdding(false);
      setHeadline('');
      setContent('');
      setImageBase64(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this entry permanently?')) return;
    setEntries(entries.filter(e => e.id !== id));
    try {
      await supabase.from('tasks').delete().eq('id', id);
    } catch (e) {
      console.error(e);
    }
  };

  const toggleVis = (id: string) => {
    setVisibleContent(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-20 animate-fade-in-up">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/vault" className="p-2 -ml-2 text-primary-500 hover:bg-white/50 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold text-primary-900 flex items-center gap-2">
            <Lock className="w-5 h-5 text-primary-600" /> Private Storage
          </h1>
        </div>
        {!isAdding && (
          <button onClick={() => setIsAdding(true)} className="glass-btn px-3 py-2 text-sm">
            <Plus className="w-4 h-4" /> Add
          </button>
        )}
      </header>

      {/* Add Form — Just Headline + Content */}
      {isAdding && (
        <div className="glass-card-solid p-5 animate-scale-in">
          <h2 className="font-semibold text-primary-800 mb-4">New Entry</h2>
          <form onSubmit={handleSave} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-primary-700 mb-1">Headline</label>
              <input
                required
                value={headline}
                onChange={e => setHeadline(e.target.value)}
                className="glass-input"
                placeholder="e.g., My Important Password"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-primary-700 mb-1">Content (Optional)</label>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                className="glass-input min-h-[80px]"
                placeholder="Your secret text content…"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-primary-700 mb-1">Image (Optional)</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    if (ev.target?.result) setImageBase64(ev.target.result as string);
                  };
                  reader.readAsDataURL(file);
                }}
                className="glass-input file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
              />
              {imageBase64 && (
                <div className="mt-2 relative inline-block">
                  <img src={imageBase64} alt="Preview" className="h-24 rounded-lg border border-primary-200 object-cover" />
                  <button type="button" onClick={() => setImageBase64(null)} className="absolute -top-2 -right-2 bg-red-100 text-red-600 rounded-full p-1 shadow-sm hover:bg-red-200"><X className="w-3 h-3" /></button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button type="submit" disabled={isSubmitting} className="glass-btn px-5 py-2 text-sm">
                {isSubmitting ? 'Saving…' : 'Save'}
              </button>
              <button type="button" onClick={() => setIsAdding(false)} className="glass-btn-secondary px-4 py-2 text-sm">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Entries List */}
      {loading ? (
        <div className="text-center py-12 text-primary-400 text-sm">Decrypting…</div>
      ) : entries.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Lock className="w-10 h-10 text-primary-300 mx-auto mb-3" />
          <p className="text-primary-500 text-sm">No entries yet. Add your first secret.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map(entry => (
            <div key={entry.id} className="glass-card p-4 flex items-center gap-4">
              <div className="w-10 h-10 bg-primary-100/60 rounded-xl flex items-center justify-center text-primary-600 font-bold text-sm shrink-0">
                {entry.headline.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-800 text-sm">{entry.headline}</h3>
                {entry.content && (
                  <p className="text-xs text-gray-500 font-mono mt-1 break-all whitespace-pre-wrap">
                    {visibleContent[entry.id] ? entry.content : '••••••••••••'}
                  </p>
                )}
                {entry.image && visibleContent[entry.id] && (
                  <img src={entry.image} alt={entry.headline} className="mt-3 max-h-48 rounded-lg border border-primary-200 object-contain bg-white/50" />
                )}
                {entry.image && !visibleContent[entry.id] && (
                  <p className="text-xs text-primary-400 font-medium mt-1 flex items-center gap-1">
                    <ImageIcon className="w-3 h-3" /> [Image Hidden]
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => toggleVis(entry.id)}
                  className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                  title={visibleContent[entry.id] ? 'Hide' : 'Show'}
                >
                  {visibleContent[entry.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => handleDelete(entry.id)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
