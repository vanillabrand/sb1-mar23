import { useState } from 'react';
import { supabase } from '../lib/supabase';

export function TestPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      console.log('TestPage: Attempting to sign in with:', { email });
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      console.log('TestPage: Sign in result:', { data, error });
      setResult({ data, error });
    } catch (err) {
      console.error('TestPage: Error during sign in:', err);
      setResult({ error: err });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gunmetal-900 p-4">
      <div className="bg-gunmetal-800 p-8 rounded-xl shadow-xl w-full max-w-md">
        <h1 className="text-2xl font-bold text-white mb-6">Supabase Test Page</h1>

        <form onSubmit={handleSignIn} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 bg-gunmetal-900 border border-gunmetal-700 rounded-lg text-gray-200"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 bg-gunmetal-900 border border-gunmetal-700 rounded-lg text-gray-200"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-all duration-300 disabled:opacity-50"
          >
            {loading ? 'Testing...' : 'Test Sign In'}
          </button>
        </form>

        {result && (
          <div className="mt-6 p-4 bg-gunmetal-900 rounded-lg">
            <h2 className="text-lg font-medium text-white mb-2">Result:</h2>
            <pre className="text-sm text-gray-300 overflow-auto max-h-60">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
