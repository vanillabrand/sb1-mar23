import React, { useRef, useState } from 'react';
import emailjs from '@emailjs/browser';
import { Mail, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { logService } from '../lib/log-service';

interface ContactFormProps {
  onSubmit?: () => void;
  onError?: (error: Error) => void;
}

export function ContactForm({ onSubmit, onError }: ContactFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formRef.current) return;
    if (!import.meta.env.VITE_EMAILJS_PUBLIC_KEY) {
      logService.log('error', 'EmailJS public key not configured', null, 'ContactForm');
      setStatus('error');
      onError?.(new Error('Email service not configured'));
      return;
    }

    try {
      setIsSubmitting(true);
      await emailjs.sendForm(
        import.meta.env.VITE_EMAILJS_SERVICE_ID,
        import.meta.env.VITE_EMAILJS_TEMPLATE_ID,
        formRef.current,
        import.meta.env.VITE_EMAILJS_PUBLIC_KEY
      );
      setStatus('success');
      onSubmit?.();
      formRef.current.reset();
    } catch (error) {
      setStatus('error');
      logService.log('error', 'Failed to send email', error, 'ContactForm');
      onError?.(error as Error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-gunmetal-900/90 backdrop-blur-xl rounded-xl p-6 border border-gunmetal-800">
      <div className="flex items-center gap-3 mb-6">
        <MessageSquare className="w-8 h-8 text-neon-turquoise" />
        <h2 className="text-2xl font-bold gradient-text">Contact Us</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Contact Information */}
        <div>
          <p className="text-gray-300 mb-8">
            Have questions about GIGAntic? Our team is here to help. Contact us through any of 
            these channels or fill out the form.
          </p>

          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-neon-turquoise/10 flex items-center justify-center">
                <Phone className="w-6 h-6 text-neon-turquoise" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Phone Support</p>
                <p className="text-lg font-mono text-neon-turquoise">{supportPhone}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-neon-yellow/10 flex items-center justify-center">
                <Mail className="w-6 h-6 text-neon-yellow" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Email</p>
                <p className="text-lg font-mono text-neon-yellow">contact@gigantic.ai</p>
              </div>
            </div>

            <div className="bg-gunmetal-800/50 rounded-xl p-4 mt-8">
              <h3 className="text-lg font-semibold text-gray-200 mb-2">Support Hours</h3>
              <p className="text-gray-400">
                Our support team is available 24/7 to assist you with any questions or concerns.
              </p>
            </div>
          </div>
        </div>

        {/* Contact Form */}
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Your Name
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-gunmetal-800 border border-gunmetal-700 rounded-lg px-4 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-turquoise focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Email Address
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full bg-gunmetal-800 border border-gunmetal-700 rounded-lg px-4 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-turquoise focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Subject
            </label>
            <input
              type="text"
              name="subject"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              className="w-full bg-gunmetal-800 border border-gunmetal-700 rounded-lg px-4 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-turquoise focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Message
            </label>
            <textarea
              name="message"
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              rows={4}
              className="w-full bg-gunmetal-800 border border-gunmetal-700 rounded-lg px-4 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-turquoise focus:border-transparent"
              required
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={status === 'submitting' || status === 'success'}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-neon-turquoise text-gunmetal-950 rounded-lg font-semibold hover:bg-neon-yellow transition-all duration-300 disabled:opacity-50"
          >
            {status === 'submitting' ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Sending...
              </>
            ) : status === 'success' ? (
              <>
                <Check className="w-5 h-5" />
                Message Sent!
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                Send Message
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
