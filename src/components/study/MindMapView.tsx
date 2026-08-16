import { motion, useReducedMotion } from 'framer-motion';
import { useChartTheme } from '@/lib/chartTheme';

export interface MindMapData {
  root: string;
  children: { label: string; children?: { label: string }[] }[];
}

/**
 * A radial mind map drawn as inline SVG. Branches are laid out on a circle and
 * leaves fan out along each branch's own angle, so the structure is readable
 * without a layout engine. Branch colour is identity only - the label carries
 * the meaning, so colour is never the sole channel.
 */
export function MindMapView({ data }: { data: MindMapData }) {
  const t = useChartTheme();
  const reduceMotion = useReducedMotion();

  const branches = data.children.slice(0, 7);
  const W = 900;
  const H = 620;
  const cx = W / 2;
  const cy = H / 2;
  const branchRadius = 190;
  const leafRadius = 92;

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card p-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-[760px]" role="img" aria-label={`Mind map of ${data.root}`}>
        {branches.map((branch, i) => {
          const angle = (i / branches.length) * Math.PI * 2 - Math.PI / 2;
          const bx = cx + Math.cos(angle) * branchRadius;
          const by = cy + Math.sin(angle) * branchRadius;
          const colour = t.series[i % t.series.length];
          const leaves = (branch.children || []).slice(0, 4);

          return (
            <g key={branch.label}>
              <motion.line
                x1={cx} y1={cy} x2={bx} y2={by}
                stroke={colour} strokeWidth={2} strokeLinecap="round"
                initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ delay: i * 0.08, duration: 0.4 }}
              />

              {leaves.map((leaf, j) => {
                const spread = 0.85;
                const leafAngle = angle + (j - (leaves.length - 1) / 2) * (spread / Math.max(1, leaves.length - 1 || 1));
                const lx = bx + Math.cos(leafAngle) * leafRadius;
                const ly = by + Math.sin(leafAngle) * leafRadius;
                return (
                  <g key={j}>
                    <motion.line
                      x1={bx} y1={by} x2={lx} y2={ly}
                      stroke={colour} strokeWidth={1.5} strokeOpacity={0.45} strokeLinecap="round"
                      initial={reduceMotion ? false : { opacity: 0 }}
                      animate={{ opacity: 0.45 }}
                      transition={{ delay: 0.3 + i * 0.08 + j * 0.05 }}
                    />
                    <motion.foreignObject
                      x={lx - 78} y={ly - 22} width={156} height={52}
                      initial={reduceMotion ? false : { opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.35 + i * 0.08 + j * 0.05 }}
                    >
                      <div
                        className="flex h-full items-center justify-center rounded-md px-2 text-center text-[0.62rem] leading-tight"
                        style={{ background: `${colour}1f`, color: t.text, border: `1px solid ${colour}55` }}
                      >
                        <span className="line-clamp-3">{leaf.label}</span>
                      </div>
                    </motion.foreignObject>
                  </g>
                );
              })}

              <motion.foreignObject
                x={bx - 74} y={by - 20} width={148} height={40}
                initial={reduceMotion ? false : { opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.15 + i * 0.08 }}
              >
                <div
                  className="flex h-full items-center justify-center rounded-lg px-2 text-center text-xs font-semibold leading-tight"
                  style={{ background: colour, color: '#fff' }}
                >
                  <span className="line-clamp-2">{branch.label}</span>
                </div>
              </motion.foreignObject>
            </g>
          );
        })}

        <motion.foreignObject
          x={cx - 92} y={cy - 34} width={184} height={68}
          initial={reduceMotion ? false : { opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <div className="flex h-full items-center justify-center rounded-xl border-2 border-primary bg-primary/10 px-3 text-center">
            <span className="font-display line-clamp-3 text-sm font-semibold" style={{ color: t.text }}>
              {data.root}
            </span>
          </div>
        </motion.foreignObject>
      </svg>
    </div>
  );
}
