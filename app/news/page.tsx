import LatestNewsSection, { NewsItem } from '../../components/LatestNewsSection';

const demoNews: NewsItem[] = [
  {
    id: 1,
    title: 'Tesla unveils new battery tech for extended range',
    date: 'May 1, 2024',
    category: 'Tech',
    imageUrl: 'https://source.unsplash.com/random/800x800?technology,1',
  },
  {
    id: 2,
    title: 'Autopilot update improves highway performance',
    date: 'May 4, 2024',
    category: 'Update',
    imageUrl: 'https://source.unsplash.com/random/800x800?technology,2',
  },
  {
    id: 3,
    title: 'Gigafactory reaches new production milestone',
    date: 'May 6, 2024',
    category: 'News',
    imageUrl: 'https://source.unsplash.com/random/800x800?technology,3',
  },
  {
    id: 4,
    title: 'Model S receives interior design refresh',
    date: 'May 8, 2024',
    category: 'Design',
    imageUrl: 'https://source.unsplash.com/random/800x800?technology,4',
  },
  {
    id: 5,
    title: 'Energy division launches new solar roof tiles',
    date: 'May 10, 2024',
    category: 'Energy',
    imageUrl: 'https://source.unsplash.com/random/800x800?technology,5',
  },
  {
    id: 6,
    title: 'Supercharger network expands across Europe',
    date: 'May 12, 2024',
    category: 'Infrastructure',
    imageUrl: 'https://source.unsplash.com/random/800x800?technology,6',
  },
];

export default function NewsPage() {
  return <LatestNewsSection items={demoNews} />;
}
