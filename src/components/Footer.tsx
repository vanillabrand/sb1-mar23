import React from 'react';
import { 
  Bot, 
  ArrowUpRight, 
  Mail, 
  Phone, 
  MapPin, 
  Facebook, 
  Twitter, 
  Linkedin, 
  Instagram,
  Youtube,
  Globe,
  Shield,
  AlertTriangle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { KilnLogo } from './KilnLogo';

export function Footer() {
  return (
    <footer className="bg-gunmetal-900/90 backdrop-blur-xl border-t border-gunmetal-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Footer Content */}
        <div className="py-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Company Info */}
          <div>
            <KilnLogo className="mb-6" />
            <p className="text-gray-400 mb-6">
              GIGAntic is revolutionizing crypto trading with AI-powered strategies and automated execution.
            </p>
            <div className="space-y-3">
              <a href="mailto:contact@gigantic.ai" className="flex items-center gap-2 text-gray-400 hover:text-neon-raspberry transition-colors">
                <Mail className="w-4 h-4" />
                contact@gigantic.ai
              </a>
              <a href="tel:+18005551234" className="flex items-center gap-2 text-gray-400 hover:text-neon-raspberry transition-colors">
                <Phone className="w-4 h-4" />
                +1 (800) 555-1234
              </a>
              <div className="flex items-center gap-2 text-gray-400">
                <MapPin className="w-4 h-4" />
                San Francisco, CA
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-gray-200 font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/" className="text-gray-400 hover:text-neon-raspberry transition-colors">
                  Dashboard
                </Link>
              </li>
              <li>
                <Link to="/strategy" className="text-gray-400 hover:text-neon-raspberry transition-colors">
                  Strategy Manager
                </Link>
              </li>
              <li>
                <Link to="/backtest" className="text-gray-400 hover:text-neon-raspberry transition-colors">
                  Backtester
                </Link>
              </li>
              <li>
                <Link to="/monitor" className="text-gray-400 hover:text-neon-raspberry transition-colors">
                  Trade Monitor
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-gray-200 font-semibold mb-4">Legal</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/terms" className="text-gray-400 hover:text-neon-raspberry transition-colors">
                  Terms & Conditions
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="text-gray-400 hover:text-neon-raspberry transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/responsible-trading" className="text-gray-400 hover:text-neon-raspberry transition-colors">
                  Risk Disclosure
                </Link>
              </li>
              <li>
                <Link to="/cookies" className="text-gray-400 hover:text-neon-raspberry transition-colors">
                  Cookie Policy
                </Link>
              </li>
            </ul>
          </div>

          {/* Connect */}
          <div>
            <h3 className="text-gray-200 font-semibold mb-4">Connect</h3>
            <div className="grid grid-cols-3 gap-2">
              <a 
                href="https://twitter.com/gigantic_ai" 
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-10 h-10 rounded-lg bg-gunmetal-800/50 text-gray-400 hover:text-neon-raspberry hover:bg-gunmetal-700/50 transition-all duration-300"
              >
                <Twitter className="w-5 h-5" />
              </a>
              <a 
                href="https://linkedin.com/company/gigantic-ai" 
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-10 h-10 rounded-lg bg-gunmetal-800/50 text-gray-400 hover:text-neon-raspberry hover:bg-gunmetal-700/50 transition-all duration-300"
              >
                <Linkedin className="w-5 h-5" />
              </a>
              <a 
                href="https://facebook.com/gigantic.ai" 
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-10 h-10 rounded-lg bg-gunmetal-800/50 text-gray-400 hover:text-neon-raspberry hover:bg-gunmetal-700/50 transition-all duration-300"
              >
                <Facebook className="w-5 h-5" />
              </a>
              <a 
                href="https://instagram.com/gigantic.ai" 
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-10 h-10 rounded-lg bg-gunmetal-800/50 text-gray-400 hover:text-neon-raspberry hover:bg-gunmetal-700/50 transition-all duration-300"
              >
                <Instagram className="w-5 h-5" />
              </a>
              <a 
                href="https://youtube.com/gigantic_ai" 
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-10 h-10 rounded-lg bg-gunmetal-800/50 text-gray-400 hover:text-neon-raspberry hover:bg-gunmetal-700/50 transition-all duration-300"
              >
                <Youtube className="w-5 h-5" />
              </a>
              <a 
                href="https://gigantic.ai/blog" 
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-10 h-10 rounded-lg bg-gunmetal-800/50 text-gray-400 hover:text-neon-raspberry hover:bg-gunmetal-700/50 transition-all duration-300"
              >
                <Globe className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>

        {/* Risk Warning */}
        <div className="py-6 border-t border-gunmetal-800">
          <div className="flex items-start gap-4 bg-gunmetal-800/30 rounded-lg p-4">
            <AlertTriangle className="w-6 h-6 text-neon-yellow flex-shrink-0" />
            <div className="text-sm text-gray-400">
              <p className="font-medium text-neon-yellow mb-2">Risk Warning</p>
              <p>
                Cryptocurrency trading involves substantial risk and is not suitable for all investors. 
                The high degree of leverage can work against you as well as for you. Before deciding 
                to trade cryptocurrencies you should carefully consider your investment objectives, 
                level of experience, and risk appetite. The possibility exists that you could sustain 
                a loss of some or all of your initial investment and therefore you should not invest 
                money that you cannot afford to lose.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="py-6 border-t border-gunmetal-800">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-gray-400 text-sm">
              © {new Date().getFullYear()} GIGAntic AI. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 text-gray-400">
                <Shield className="w-4 h-4" />
                <span className="text-sm">Bank-grade Security</span>
              </div>
              <div className="flex items-center gap-2 text-gray-400">
                <Globe className="w-4 h-4" />
                <span className="text-sm">24/7 Global Support</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}