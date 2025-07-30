import React from 'react';

export type NewsItem = {
  id: number;
  title: string;
  date: string;
  category: string;
  imageUrl: string;
};

interface LatestNewsSectionProps {
  items: NewsItem[];
}

export default function LatestNewsSection({ items }: LatestNewsSectionProps) {
  return (
    <section className="py-8" style={{ backgroundColor: 'var(--bg-color)' }}>
      <div className="max-w-6xl mx-auto px-4">
        <header className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-semibold">Latest news</h2>
          <a href="#" className="text-sm">View all</a>
        </header>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          {items.map((item) => (
            <article
              key={item.id}
              className="bg-[var(--card-bg-color)] rounded shadow-lg overflow-hidden transform transition-transform hover:-translate-y-1 hover:shadow-xl"
            >
              <div className="aspect-square overflow-hidden">
                <img
                  src={item.imageUrl}
                  alt="thumbnail"
                  className="w-full h-full object-cover brightness-90 transition hover:brightness-110"
                  style={{ filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.2))' }}
                />
              </div>
              <div className="p-4 space-y-2">
                <h3 className="text-lg font-medium leading-tight line-clamp-2">
                  {item.title}
                </h3>
                <div className="flex items-center gap-2 text-sm text-[var(--muted-color)]">
                  <span className="px-2 py-1 bg-[var(--category-bg)] rounded-full text-xs font-semibold text-[var(--text-color)]">
                    {item.category}
                  </span>
                  <span>{item.date}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
