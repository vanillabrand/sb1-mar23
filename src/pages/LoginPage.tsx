import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Brain } from 'lucide-react';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    console.log('Attempting to sign in with email:', email);

    try {
      console.log('Calling signIn method...');
      await signIn(email, password);
      console.log('Sign in successful, navigating to dashboard');

      // Add a small delay to allow the auth state to update
      setTimeout(() => {
        console.log('Delayed navigation to dashboard');
        navigate('/dashboard');
      }, 500);
    } catch (error) {
      // Error is handled by AuthContext
      console.error('Login error caught in LoginPage:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gunmetal-900">
      <div className="bg-gunmetal-800/50 p-8 rounded-xl shadow-xl w-full max-w-md border border-gunmetal-700">
        <div className="flex items-center gap-3 mb-8">
          <Brain className="w-8 h-8 text-neon-raspberry" />
          <h1 className="text-2xl font-bold text-gray-200">Sign In</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
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
            disabled={isLoading}
            className="w-full py-2 px-4 bg-neon-raspberry text-white rounded-lg hover:bg-opacity-90 transition-all duration-300 disabled:opacity-50"
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}