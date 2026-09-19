export type HoverTrigger = 'annotation' | 'line';

export function shouldProvideBlameHover(
  trigger: HoverTrigger,
  character: number,
  eol: number,
): boolean {
  if (trigger === 'annotation' && character < eol) return false;
  return true;
}
