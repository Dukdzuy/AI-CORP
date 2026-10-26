import { FactoryProvider, Type } from '@nestjs/common';
import { IAgent } from '../../domain/agent/interfaces/IAgent.interface';
import { CeoAgent } from './ceo.agent';
import { PmAgent } from './pm.agent';
import { BaAgent } from './ba.agent';
import { ArchitectAgent } from './architect.agent';
import { DevAgent } from './dev.agent';
import { QcAgent } from './qc.agent';
import { QaAgent } from './qa.agent';
import { MarketingAgent } from './marketing.agent';

/** Injection token for the list of every agent in the roster (IAgent[]) */
export const AGENTS = Symbol('AGENTS');

/**
 * The roster. Adding a role means adding its class here (plus its profile and strategies);
 * the orchestrator and the workflow engine pick it up from the AGENTS token.
 */
export const AGENT_CLASSES: Type<IAgent>[] = [
  CeoAgent,
  BaAgent,
  ArchitectAgent,
  PmAgent,
  DevAgent,
  QcAgent,
  QaAgent,
  MarketingAgent,
];

/**
 * Collects agent instances behind one token, so consumers depend on IAgent[] instead of
 * on every concrete agent class.
 *
 * @pattern Registry (multi-provider), Dependency Inversion
 */
export function agentsProvider(classes: Type<IAgent>[] = AGENT_CLASSES): FactoryProvider<IAgent[]> {
  return {
    provide: AGENTS,
    useFactory: (...agents: IAgent[]) => agents,
    inject: classes,
  };
}
