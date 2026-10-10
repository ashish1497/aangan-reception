import { routeFor } from '../../../lib/nextAdapter';
import handler from '../../../lib/handlers/vaani-webhook';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const { GET, POST, PUT, PATCH, DELETE } = routeFor(handler);
