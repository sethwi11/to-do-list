import { Link } from 'react-router';
import { EmptyState } from '../ui/states';

export default function NotFoundPage() {
  return (
    <div className="max-w-[960px]">
      <h1 className="mb-6 font-display text-page">Not found</h1>
      <EmptyState message="There's nothing at this address.">
        <Link to="/" className="inline-flex h-8 items-center rounded-control px-3 text-body font-medium text-ink hover:bg-accent-soft">
          Go to Today
        </Link>
      </EmptyState>
    </div>
  );
}
