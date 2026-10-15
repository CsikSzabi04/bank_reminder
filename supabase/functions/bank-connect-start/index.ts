// A-47: bank-connect-start — szerződés: docs/CONTRACT_CHANGES.md „B-41: a bank-hívások…". A hitelesítés és a hibakezelés a közös burokban van.
import { startConnection } from '../_shared/bank-connect.ts';
import { serveBank } from '../_shared/bank-runtime.ts';

Deno.serve((req) => serveBank(req, startConnection));
