import type {AuthFixture,CardOverviewFixture,MountedCardContinuation} from '../peanut-addon-ui-spec/adapter-contract';
export type VerificationContext={status:'open'|'checking';generation:string;entryScope:string}|{status:'none'|'unavailable'};
export type Overview=CardOverviewFixture & {verificationContext?:VerificationContext};
export interface ContinuityView extends MountedCardContinuation {
  publishOverview(overview:Overview):Promise<void>;
  /** Replace GET fixture only. No invalidation, callback, prop or local-state assignment. */
  setOverviewResponse(overview:Overview):void;
  /** Advance renderer's fake timers, flushing actual scheduled product callbacks. */
  advanceTime(ms:number):Promise<void>;
  /** Dispatch real blur/hidden then visible/focus events; no query callback invocation. */
  focusWindow():Promise<void>;
}
export type MountCardContinuity=(options:{session:AuthFixture;overview:Overview})=>Promise<ContinuityView>;
