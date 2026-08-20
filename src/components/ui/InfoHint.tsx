import { LiQuestionCircle } from 'solar-icon-react/li';
import { TooltipPill } from './tooltip-pill';

/**
 * The small info icon next to a stat label that reveals an explanatory tooltip on
 * hover or keyboard focus, styled as the design's tooltip pill. The pill inverts with
 * the theme via the tooltip tokens rather than a fixed dark hex, so it stays legible in
 * both modes. Uses Radix Tooltip (not
 * Popover) so it opens and closes with the pointer instead of latching open, and
 * portals into the themed shell so it keeps the design tokens.
 */
export function InfoHint({ text, size = 'md' }: { text: string; size?: 'sm' | 'md' }) {
  return (
    <TooltipPill label={text}>
      <button
        type="button"
        aria-label="More information"
        className="inline-flex shrink-0 text-placeholder transition-colors hover:text-body-alt"
      >
        <LiQuestionCircle className={size === 'sm' ? 'h-2.5 w-2.5' : 'h-4 w-4'} />
      </button>
    </TooltipPill>
  );
}
