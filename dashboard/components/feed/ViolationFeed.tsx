"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { createClient } from "@/lib/supabase/client";
import { ViolationCard } from "./ViolationCard";
import { DetailPanel } from "./DetailPanel";
import { StatusHero } from "@/components/hero/StatusHero";
import { ViolationCharts } from "@/components/charts/ViolationCharts";
import { deriveStatus } from "@/lib/status";
import type {
  ResolutionStatus,
  ViolationWithCamera,
} from "@/lib/supabase/types";
import { DemoModeBar } from "./DemoModeBar";

interface ViolationFeedProps {
  initialViolations: ViolationWithCamera[];
  totalCameras: number;
  activeCameras: number;
}

export function ViolationFeed({
  initialViolations,
  totalCameras,
  activeCameras,
}: ViolationFeedProps) {
  const [violations, setViolations] =
    useState<ViolationWithCamera[]>(initialViolations);
  const [selected, setSelected] = useState<ViolationWithCamera | null>(null);

  const fetchOne = useCallback(async (id: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("violations")
      .select("*, cameras(name, sites(name))")
      .eq("id", id)
      .single();
    return (data as ViolationWithCamera | null) ?? null;
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("violations-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "violations" },
        async (payload) => {
          const enriched = await fetchOne(
            (payload.new as { id: string }).id,
          );
          if (enriched) {
            setViolations((prev) => [enriched, ...prev].slice(0, 100));
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "violations" },
        (payload) => {
          const updated = payload.new as ViolationWithCamera;
          setViolations((prev) =>
            prev.map((v) =>
              v.id === updated.id ? { ...v, ...updated } : v,
            ),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchOne]);

  // Re-render every 30s so "Active" pills age out automatically
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const snapshot = useMemo(() => deriveStatus(violations), [violations]);

  const handleResolved = useCallback(
    (id: string, status: ResolutionStatus) => {
      setViolations((prev) =>
        prev.map((v) =>
          v.id === id
            ? {
                ...v,
                resolution_status: status,
                resolved_at: new Date().toISOString(),
              }
            : v,
        ),
      );
    },
    [],
  );

  const handleDemoLoad = useCallback((demos: ViolationWithCamera[]) => {
    setViolations(demos);
  }, []);

  return (
    <>
      <StatusHero
        snapshot={snapshot}
        activeCameras={activeCameras}
        totalCameras={totalCameras}
      />

      <DemoModeBar onLoad={handleDemoLoad} />

      <section className="px-6 sm:px-12 mt-12 sm:mt-16">
        <SectionHeader
          eyebrow="Live feed"
          title="Recent violations"
          count={violations.length}
        />
        {violations.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="mt-6 space-y-2">
            <AnimatePresence initial={false}>
              {violations.map((v) => (
                <motion.div
                  key={v.id}
                  layout
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                >
                  <ViolationCard violation={v} onSelect={setSelected} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </section>

      <section className="px-6 sm:px-12 mt-16 sm:mt-24 pb-16 sm:pb-24">
        <SectionHeader eyebrow="Trends" title="Activity" />
        <ViolationCharts violations={violations} />
      </section>

      <DetailPanel
        violation={selected}
        onClose={() => setSelected(null)}
        onResolved={handleResolved}
      />
    </>
  );
}

function SectionHeader({
  eyebrow,
  title,
  count,
}: {
  eyebrow: string;
  title: string;
  count?: number;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <div>
        <div className="text-[10px] tracking-[0.2em] uppercase text-text-tertiary mb-2">
          {eyebrow}
        </div>
        <h2 className="text-[24px] sm:text-[32px] font-semibold tracking-tight">
          {title}
        </h2>
      </div>
      {count !== undefined && (
        <span className="font-mono tabular text-[12px] text-text-secondary">
          {count}
        </span>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-8 py-16 text-center">
      <div className="inline-block">
        <div className="text-[10px] tracking-[0.2em] uppercase text-text-tertiary mb-2">
          No violations
        </div>
        <p className="text-text-secondary text-[14px]">
          The site is operating clean. New violations will appear here in real
          time.
        </p>
      </div>
    </div>
  );
}
