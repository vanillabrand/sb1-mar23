import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { gsap } from 'gsap';
import {
  Brain,
  Star,
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  User,
  LogIn
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { FeatureCarousel } from './FeatureCarousel';
import { PricingPanel } from './PricingPanel';
import { HygieneLinks } from './HygieneLinks';
import { MarketVisualization } from './MarketVisualization';

import { SpaceWarp } from './SpaceWarp';

import { FluidHero } from './FluidHero';
import { FeatureShowcaseGrid } from './FeatureShowcaseGrid';
import { VisualShowcase } from './VisualShowcase';
import { PerspectiveCTA } from './PerspectiveCTA';
import { AnimatedStats } from './AnimatedStats';
import { TestimonialCarousel } from './TestimonialCarousel';
import { FluidFooter } from './FluidFooter';
import HowItWorksSection from './HowItWorksSection';
import FeaturesSection from './FeaturesSection';
import { supabase } from '../lib/supabase';
import { logService } from '../lib/log-service';
import { useAuth } from '../hooks/useAuth';

export function Hero() {
  const { user } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

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
      navigate('/dashboard');
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

      console.log('Starting signup process...');
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin
        }
      });

      console.log('Signup response:', { data, error: signUpError });

      if (signUpError) throw signUpError;

      // Check if email confirmation is required
      if (data.user && !data.session) {
        setError('Please check your email and click the confirmation link to complete registration.');
        setLoading(false);
        return;
      }

      // If we have a session, user is logged in immediately
      if (data.session) {
        console.log('User logged in immediately after signup');
        navigate('/dashboard');
        return;
      }

      setShowSignup(false);
      setShowLogin(true);
      setError(null);
      setEmail('');
      setPassword('');
      setConfirmPassword('');

      logService.log('info', 'User signed up successfully', null, 'Hero');
    } catch (err) {
      console.error('Signup error:', err);
      setError(err instanceof Error ? err.message : 'Failed to sign up');
      logService.log('error', 'Signup error:', err, 'Hero');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Elegant Glass Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-gunmetal-800/90 via-gunmetal-850/90 to-gunmetal-800/90" />

      {/* Subtle texture overlay */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIiB4PSIwIiB5PSIwIj48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Ii43NSIgc3RpdGNoVGlsZXM9InN0aXRjaCIgdHlwZT0iZnJhY3RhbE5vaXNlIi8+PGZlQ29sb3JNYXRyaXggdHlwZT0ic2F0dXJhdGUiIHZhbHVlcz0iMCIvPjwvZmlsdGVyPjxwYXRoIGQ9Ik0wIDBoMzAwdjMwMEgweiIgZmlsdGVyPSJ1cmwoI2EpIiBvcGFjaXR5PSIuMDUiLz48L3N2Zz4=')] opacity-20" />

      {/* Glass reflections */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      {/* Subtle accent colors */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(45,212,191,0.05),transparent_70%)] animate-pulse-slow" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_70%,rgba(255,20,147,0.05),transparent_70%)] animate-pulse-slow" style={{ animationDelay: '1s' }} />

      {/* Subtle brushed metal lines */}
      <div className="absolute inset-0 overflow-hidden opacity-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="absolute bg-gradient-to-r from-transparent via-white to-transparent"
            style={{
              height: '1px',
              width: `${Math.random() * 100 + 50}%`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              transform: `rotate(${Math.random() * 180}deg)`,
              opacity: Math.random() * 0.3 + 0.1
            }}
          />
        ))}
      </div>

      {/* Animated Market Visualization */}
      <MarketVisualization className="z-0" />

      {/* Space Warp Animation */}
      <SpaceWarp className="z-0" />

      {/* Main Content */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 md:py-24">
        {/* Top Navigation Bar */}
        <div className="absolute top-0 left-0 right-0 z-10 flex justify-between items-center px-4 py-4 backdrop-blur-sm bg-white/[0.01] border-b border-white/5">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
            className="flex items-center"
          >
            <div className="text-2xl gradient-text mr-2">GIGAntic</div>
          </motion.div>

          {/* Login Button */}
          <motion.button
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowLogin(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white/[0.03] hover:bg-white/[0.08] text-white rounded-lg backdrop-blur-md transition-all duration-300 shadow-lg border border-white/10"
          >
            <LogIn className="w-4 h-4" />
            <span>Login</span>
          </motion.button>
        </div>



        {/* Fluid Hero Section */}
        <FluidHero
          onGetStarted={() => setShowSignup(true)}
          onLearnMore={() => {
            const howItWorksSection = document.getElementById('how-it-works');
            if (howItWorksSection) {
              howItWorksSection.scrollIntoView({ behavior: 'smooth' });
            }
          }}
        />

        {/* How It Works Section */}
        <HowItWorksSection />

        {/* Features Section */}
        <FeaturesSection />

        {/* Feature Showcase Grid */}
        <FeatureShowcaseGrid />

        {/* Visual Showcase */}
        <VisualShowcase />

        {/* Animated Stats */}
        <AnimatedStats />

        {/* Testimonial Carousel */}
        <TestimonialCarousel />

        {/* Perspective Call to Action */}
        <PerspectiveCTA onSignUp={() => setShowSignup(true)} />

        {/* Fluid Footer */}
        <FluidFooter />

        {/* Login Modal */}
        {showLogin && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowLogin(false);
                setError(null);
              }
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white/[0.03] backdrop-blur-xl rounded-xl p-6 w-full max-w-md border border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.12)] relative"
            >
              <button
                onClick={() => {
                  setShowLogin(false);
                  setError(null);
                }}
                className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
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

        {/* Debug State Display */}
        <div style={{
          position: 'fixed',
          top: '10px',
          right: '10px',
          backgroundColor: 'yellow',
          color: 'black',
          padding: '10px',
          zIndex: 9999,
          fontSize: '14px',
          fontWeight: 'bold'
        }}>
          showSignup: {showSignup ? 'TRUE' : 'FALSE'}
        </div>

        {/* Simple Signup Modal */}
        {showSignup && (
          <div
            className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
            onClick={() => setShowSignup(false)}
          >
            <div
              className="bg-white rounded-lg p-8 max-w-md w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Create Account</h2>
                <button
                  onClick={() => setShowSignup(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                  {error}
                </div>
              )}

              <form onSubmit={handleSignup} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    placeholder="your@email.com"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    placeholder="Create a password"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    placeholder="Confirm your password"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {loading ? 'Creating Account...' : 'Create Account'}
                </button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setShowSignup(false);
                      setShowLogin(true);
                    }}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Already have an account? Sign in
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}