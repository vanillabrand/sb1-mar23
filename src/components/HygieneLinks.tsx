import React from 'react';
import { Shield, Scale, FileText, Heart, Globe, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

interface HygieneLinkProps {
  title: string;
  to: string;
  icon: React.ReactNode;
}

const HYGIENE_LINKS: HygieneLinkProps[] = [
  {
    title: "Privacy Policy",
    to: "/privacy",
    icon: <Shield className="w-5 h-5 text-neon-turquoise" />
  },
  {
    title: "Terms of Service",
    to: "/terms",
    icon: <Scale className="w-5 h-5 text-neon-yellow" />
  },
  {
    title: "Cookie Policy",
    to: "/cookies",
    icon: <FileText className="w-5 h-5 text-neon-orange" />
  },
  {
    title: "Responsible Trading",
    to: "/responsible-trading",
    icon: <Heart className="w-5 h-5 text-neon-pink" />
  },
  {
    title: "Accessibility",
    to: "/accessibility",
    icon: <Globe className="w-5 h-5 text-neon-raspberry" />
  },
  {
    title: "Community Guidelines",
    to: "/community",
    icon: <Users className="w-5 h-5 text-neon-turquoise" />
  }
];

export function HygieneLinks() {
  return (
    <div className="bg-gunmetal-800/30 backdrop-blur-xl rounded-2xl p-8 border border-gunmetal-700/30 shadow-lg relative overflow-hidden">
      {/* Animated background gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-gunmetal-900/50 via-gunmetal-800/50 to-gunmetal-900/50 opacity-50" />

      {/* Subtle animated lines */}
      <div className="absolute inset-0 opacity-10">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="absolute bg-white"
            style={{
              height: '1px',
              width: `${Math.random() * 30 + 20}%`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              opacity: Math.random() * 0.5 + 0.2,
              transform: `rotate(${Math.random() * 360}deg)`
            }}
          />
        ))}
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        <h2 className="text-2xl font-bold gradient-text mb-8 text-center">Important Information</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {HYGIENE_LINKS.map((link, index) => (
            <Link
              key={link.title}
              to={link.to}
              className="group bg-gunmetal-900/40 rounded-xl p-5 hover:bg-gunmetal-800/40 transition-all duration-300 border border-gunmetal-700/20 hover:border-gunmetal-600/30 hover:shadow-[0_0_15px_rgba(0,0,0,0.2)]"
            >
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-full bg-gunmetal-800/50 group-hover:bg-gunmetal-700/50 transition-colors group-hover:text-neon-magenta">
                  {link.icon}
                </div>
                <span className="text-gray-200 group-hover:text-white transition-colors font-medium">
                  {link.title}
                </span>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-12 pt-6 border-t border-gunmetal-700/30 text-center">
          <div className="flex flex-wrap justify-center gap-6 mb-6">
            <a href="#" className="text-sm text-gray-400 hover:text-neon-cyan transition-colors">Contact Us</a>
            <a href="#" className="text-sm text-gray-400 hover:text-neon-cyan transition-colors">Careers</a>
            <a href="#" className="text-sm text-gray-400 hover:text-neon-cyan transition-colors">Blog</a>
            <a href="#" className="text-sm text-gray-400 hover:text-neon-cyan transition-colors">Support</a>
          </div>
          <div className="text-sm text-gray-500">
            © {new Date().getFullYear()} GIGAntic. All rights reserved.
          </div>
        </div>
      </div>
    </div>
  );
}