import { notFound } from 'next/navigation';
import { DesignCatalog } from './design-catalog';

export const dynamic = 'force-dynamic';

export default function DesignPage() {
  // Excluded from production: dev-only design catalog
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_DESIGN_PAGE !== 'true') {
    notFound();
  }

  return <DesignCatalog />;
}
