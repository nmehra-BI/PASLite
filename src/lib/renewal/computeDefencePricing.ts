/**
 * Defence pricing — three options the underwriter chooses between.
 *
 * Hold:        technical premium (no concession)
 * Defend:      between technical and the sharp competitor's hold floor;
 *              recommended for the demo path.
 * Aggressive:  one tick above the hold floor (chase the deal at thin
 *              margin).
 *
 * Rationale strings cite the hold floor explicitly so the audit story
 * shows WHY each option lands where it lands.
 */

import type { DefencePricingOption } from './types';

export type ComputeDefencePricingInputs = {
  technicalPremium: number;
  /** £ floor — derived from the sharp competitor's demonstrated win
   *  premium on similar profiles (module 6's hold-floor formula). */
  sharpCompetitorHoldFloor: number;
  /** Broker target if quoted; informational. */
  brokerTarget: number | null;
};

export type DefencePricingResult = {
  options: DefencePricingOption[];
  holdFloor: number;
};

export function computeDefencePricing(
  input: ComputeDefencePricingInputs,
): DefencePricingResult {
  const { technicalPremium, sharpCompetitorHoldFloor, brokerTarget } = input;

  // Defend = midpoint between technical and (hold floor + 1.5k buffer);
  // rounded to nearest £500. For Greenline this lands around £52,000.
  const defendBase = Math.round(
    ((technicalPremium + (sharpCompetitorHoldFloor + 1500)) / 2) / 500,
  ) * 500;

  // Aggressive = hold floor (the lowest we'd defend without losing the
  // book). Rounded to nearest £500.
  const aggressive = Math.round(sharpCompetitorHoldFloor / 500) * 500;

  const options: DefencePricingOption[] = [
    {
      id: 'hold',
      premium: technicalPremium,
      rationale: `Hold the technical: £${technicalPremium.toLocaleString('en-GB')} reflects the sealed Tier-2 calculation against year-2 inputs. Risk: the broker walks if RegentMGA quotes near £${(sharpCompetitorHoldFloor / 1000).toFixed(0)}k.`,
      recommended: false,
    },
    {
      id: 'defend',
      premium: defendBase,
      rationale: `Defend at £${defendBase.toLocaleString('en-GB')} — above the £${sharpCompetitorHoldFloor.toLocaleString('en-GB')} sharp-competitor floor, holds margin while signalling commercial willingness. ${brokerTarget !== null ? `Aligns with broker target £${brokerTarget.toLocaleString('en-GB')}.` : 'No broker target on file.'}`,
      recommended: true,
    },
    {
      id: 'aggressive',
      premium: aggressive,
      rationale: `Aggressive at £${aggressive.toLocaleString('en-GB')} — meets the sharp-competitor hold floor head-on. Wins on price but margin is thin; deploy only if relationship retention is strategic.`,
      recommended: false,
    },
  ];

  return {
    options,
    holdFloor: sharpCompetitorHoldFloor,
  };
}
