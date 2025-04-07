import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Brain,
  Star,
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  User
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { FeatureCarousel } from './FeatureCarousel';
import { PricingPanel } from './PricingPanel';
import { HygieneLinks } from './HygieneLinks';
import { supabase } from '../lib/supabase';
import { logService } from '../lib/log-service';

export function Hero() {
  const [showLogin, setShowLogin] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (signInError) throw signInError;

      logService.log('info', 'User logged in successfully', null, 'Hero');
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in');
      logService.log('error', 'Login error:', err, 'Hero');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin
        }
      });

      if (signUpError) throw signUpError;

      setShowSignup(false);
      setShowLogin(true);
      setError(null);
      setEmail('');
      setPassword('');
      setConfirmPassword('');

      logService.log('info', 'User signed up successfully', null, 'Hero');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign up');
      logService.log('error', 'Signup error:', err, 'Hero');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Enhanced Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-gunmetal-950 via-gunmetal-900 to-gunmetal-950" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(45,212,191,0.15),transparent_70%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_70%,rgba(255,20,147,0.15),transparent_70%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(250,204,21,0.1),transparent_70%)]" />

      {/* Main Content */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        {/* Hero Section */}
        <div className="text-center mb-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-4xl mx-auto"
          >


            {/* Main Headline */}
            <h1 className="text-5xl md:text-7xl font-bold mb-10 leading-tight">
              <span className="gradient-text">Tell GIGAntic Your Goals</span>
              <br />
              <span className="text-white mt-4 block">Let AI Handle the Rest</span>
            </h1>

            <p className="text-2xl md:text-3xl text-gray-300 mb-8 leading-relaxed">
              Your personal AI trading assistant that turns
              <br />
              <span className="text-neon-raspberry">simple instructions</span> into
              <span className="text-neon-yellow"> profitable strategies</span>
            </p>

            <p className="text-xl text-gray-400 mb-12 max-w-3xl mx-auto leading-relaxed">
              No complex charts or trading jargon. Just tell GIGAntic what you want to achieve,
              and our AI will create, execute, and manage your trading strategy 24/7.
              Earn passive income while our AI works tirelessly for you.
            </p>

            <div className="flex items-center justify-center gap-6 mb-16">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowSignup(true)}
                className="group flex items-center gap-3 px-8 py-4 bg-neon-raspberry text-white rounded-xl hover:bg-[#FF69B4] transition-all duration-300 shadow-[0_0_20px_rgba(255,20,147,0.3)] hover:shadow-[0_0_30px_rgba(255,105,180,0.4)]"
              >
                <Brain className="w-6 h-6 group-hover:rotate-12 transition-transform" />
                <span className="text-lg font-medium">Start Your AI Trading Journey</span>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/how-it-works')}
                className="group flex items-center gap-3 px-8 py-4 bg-gunmetal-800/50 text-gray-300 rounded-xl hover:bg-gunmetal-700/50 transition-all duration-300 backdrop-blur-sm"
              >
                <Star className="w-6 h-6 text-neon-yellow group-hover:rotate-45 transition-transform" />
                <span className="text-lg">See How It Works</span>
              </motion.button>
            </div>
          </motion.div>
        </div>

        {/* Features and Partner Section */}
        <FeatureCarousel />

        {/* Pricing Panel */}
        <PricingPanel onSelectPlan={() => setShowSignup(true)} />

        {/* Hygiene Links */}
        <HygieneLinks />

        {/* Login Modal */}
        {showLogin && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-gunmetal-900/90 backdrop-blur-xl rounded-xl p-6 w-full max-w-md border border-gunmetal-800"
            >
              <h2 className="text-2xl font-bold gradient-text mb-2">Welcome Back</h2>
              <p className="text-gray-400 mb-6">Sign in to access your account</p>

              {error && (
                <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  {error}
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-gunmetal-800 border border-gunmetal-700 rounded-lg pl-10 pr-4 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-raspberry focus:border-transparent"
                      placeholder="your@email.com"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-gunmetal-800 border border-gunmetal-700 rounded-lg pl-10 pr-10 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-raspberry focus:border-transparent"
                      placeholder="Enter your password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-neon-raspberry hover:bg-[#FF69B4] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neon-raspberry transition-all duration-300"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    'Sign In'
                  )}
                </motion.button>

                <div className="text-center space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowLogin(false);
                      setShowSignup(true);
                    }}
                    className="text-sm text-gray-400 hover:text-neon-turquoise transition-colors"
                  >
                    Need an account? Sign up
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* Signup Modal */}
        {showSignup && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-gunmetal-900/90 backdrop-blur-xl rounded-xl p-6 w-full max-w-md border border-gunmetal-800"
            >
              <h2 className="text-2xl font-bold gradient-text mb-2">Create Your Account</h2>
              <p className="text-gray-400 mb-6">Join thousands of traders using AI to master the markets</p>

              {error && (
                <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  {error}
                </div>
              )}

              <form onSubmit={handleSignup} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-gunmetal-800 border border-gunmetal-700 rounded-lg pl-10 pr-4 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-raspberry focus:border-transparent"
                      placeholder="your@email.com"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-gunmetal-800 border border-gunmetal-700 rounded-lg pl-10 pr-10 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-raspberry focus:border-transparent"
                      placeholder="Create a strong password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full bg-gunmetal-800 border border-gunmetal-700 rounded-lg pl-10 pr-4 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-raspberry focus:border-transparent"
                      placeholder="Confirm your password"
                      required
                    />
                  </div>
                </div>

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-neon-raspberry hover:bg-[#FF69B4] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neon-raspberry transition-all duration-300"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <User className="w-5 h-5 mr-2" />
                      Create Account
                    </>
                  )}
                </motion.button>

                <div className="text-center space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowSignup(false);
                      setShowLogin(true);
                    }}
                    className="text-sm text-gray-400 hover:text-neon-turquoise transition-colors"
                  >
                    Already have an account? Sign in
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}