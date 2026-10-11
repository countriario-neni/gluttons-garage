"use client";

import { motion, useReducedMotion, type Transition, type Variants } from "motion/react";
import type { ReactNode } from "react";

const rise: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

const ease = (delay: number): Transition => ({ duration: 0.38, ease: [0.22, 1, 0.36, 1], delay });
const instant: Transition = { duration: 0 };

type Props = { children: ReactNode; className?: string; delay?: number };

/** Fade + rise once when scrolled into view (380ms). Instant under reduced motion. */
export function Reveal({ children, className, delay = 0 }: Props) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      data-reveal
      className={className}
      variants={rise}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.15 }}
      transition={reduce ? instant : ease(delay)}
    >
      {children}
    </motion.div>
  );
}

/** <li> version for rails and grids; `index` staggers siblings (70ms apart, capped). */
export function RevealItem({ children, className, index = 0 }: { children: ReactNode; className?: string; index?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.li
      data-reveal
      className={className}
      variants={rise}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.1 }}
      transition={reduce ? instant : ease(Math.min(index, 5) * 0.07)}
    >
      {children}
    </motion.li>
  );
}
