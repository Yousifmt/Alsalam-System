// app/dashboard/questions-analyzer/page.tsx
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { motion, type Variants } from "framer-motion";

const container: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { type: "tween", staggerChildren: 0.12, delayChildren: 0.1 } },
};

const itemUp: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { type: "tween", duration: 0.45, ease: [0.22, 0.61, 0.36, 1] } },
};

export default function QuestionsAnalyzerPage() {
  return (
    <motion.div
      className="min-h-[60vh] flex flex-col items-center justify-center text-center space-y-10"
      variants={container}
      initial="hidden"
      animate="visible"
    >
      <motion.h1 className="font-headline text-4xl sm:text-5xl font-extrabold" variants={itemUp}>
        <span className="text-accent">Al-Salam</span>{" "}
        <span className="font-normal text-black dark:text-white">Questions Analyser</span>
      </motion.h1>

      <motion.div variants={itemUp}>
        <Button
          asChild
          className="bg-blue-900 text-white px-6 py-4 text-base rounded-md shadow-md 
                     hover:bg-blue-800 hover:shadow-lg transition-all duration-200"
        >
          <Link href="https://al-salam-questions-analyzer.vercel.app/" target="_blank" rel="noopener noreferrer">
            Go to Questions Analyser
          </Link>
        </Button>
      </motion.div>
    </motion.div>
  );
}
