import React from 'react';
import { Star, Quote } from 'lucide-react';

const REVIEWS = [
  {
    author: "Michael Chen",
    role: "Hedge Fund Manager",
    company: "Quantum Capital",
    content: "GIGAntic's AI-driven approach has revolutionized our trading strategy. The risk management is particularly impressive.",
    rating: 5,
    image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&h=150&q=80"
  },
  {
    author: "Sarah Williams",
    role: "Director of Trading",
    company: "Alpine Securities",
    content: "The natural language strategy creation is a game-changer. We've seen a 40% improvement in our trading efficiency.",
    rating: 5,
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80"
  },
  {
    author: "David Park",
    role: "Chief Investment Officer",
    company: "Nexus Investments",
    content: "Outstanding platform with exceptional performance. The automated risk management has saved us countless times.",
    rating: 5,
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&h=150&q=80"
  }
];

export function Reviews() {
  return (
    <div className="py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">Trusted by Industry Leaders</h2>
          <p className="text-xl text-gray-400">
            See what professionals are saying about GIGAntic
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {REVIEWS.map((review, index) => (
            <div
              key={index}
              className="relative bg-gunmetal-900/90 backdrop-blur-xl rounded-xl p-6 border border-gunmetal-800"
            >
              <div className="absolute -top-4 -right-4 w-8 h-8 bg-neon-turquoise rounded-full flex items-center justify-center">
                <Quote className="w-4 h-4 text-gunmetal-950" />
              </div>

              <div className="flex items-center gap-4 mb-6">
                <img
                  src={review.image}
                  alt={review.author}
                  className="w-12 h-12 rounded-full object-cover"
                />
                <div>
                  <h3 className="font-semibold text-gray-200">{review.author}</h3>
                  <p className="text-sm text-gray-400">{review.role}</p>
                  <p className="text-sm text-neon-turquoise">{review.company}</p>
                </div>
              </div>

              <div className="flex mb-4">
                {[...Array(review.rating)].map((_, i) => (
                  <Star
                    key={i}
                    className="w-5 h-5 text-neon-yellow fill-current"
                  />
                ))}
              </div>

              <p className="text-gray-300">{review.content}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}