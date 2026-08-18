import type { AgentSlotWireId, ResolutionSource } from '@crypto-trader/shared';
import { MODEL_SLOT_IDS } from './agent-identity';
import type { ResolutionSource as ResolutionSourceApi } from './agent-config-resolver.service';

const _slotsMatchWire: readonly AgentSlotWireId[] = MODEL_SLOT_IDS;
const _sourcesMatchWire: ResolutionSource = '' as ResolutionSourceApi;
