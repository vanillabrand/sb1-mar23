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
    <div className="bg-gunmetal-800/20 backdrop-blur-xl rounded-xl p-8">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-2xl font-bold gradient-text mb-8">Important Information</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {HYGIENE_LINKS.map((link) => (
            <Link
              key={link.title}
              to={link.to}
              className="group bg-gunmetal-900/30 rounded-lg p-4 hover:bg-gunmetal-800/30 transition-all duration-300"
            >
              <div className="flex items-center gap-3">
                {link.icon}
                <span className="text-gray-200 group-hover:text-white transition-colors">
                  {link.title}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}