import React, { useState, useRef } from 'react';
import { Send, Phone, Mail, MessageSquare, Check, Loader2 } from 'lucide-react';
import emailjs from '@emailjs/browser';

// EmailJS configuration
const EMAILJS_SERVICE_ID = 'service_gigantic';
const EMAILJS_TEMPLATE_ID = 'template_gigantic';
const EMAILJS_PUBLIC_KEY = 'your_public_key';

export function ContactForm() {
  const form = useRef<HTMLFormElement>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  // This would be provided by your Twilio integration
  const supportPhone = "+1 (555) 123-4567";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('submitting');
    setError(null);

    try {
      if (!form.current) return;

      // Prepare email subject with GIGAntic prefix
      const emailSubject = `GIGAntic: Customer Enquiry - ${formData.subject}`;
      form.current.querySelector<HTMLInputElement>('[name="subject"]')!.value = emailSubject;

      // Send email using EmailJS
      await emailjs.sendForm(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        form.current,
        EMAILJS_PUBLIC_KEY
      );
      
      setStatus('success');
      setFormData({ name: '', email: '', subject: '', message: '' });
    } catch (err) {
      console.error('Failed to send email:', err);
      setStatus('error');
      setError('Failed to send message. Please try again.');
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
        <form ref={form} onSubmit={handleSubmit} className="space-y-6">
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