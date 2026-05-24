import { useMemo } from "react";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";

import worldJson from "../../../public/world.json";
import { EChart } from "./EChart";

// Register the world GeoJSON once for the whole app.
let registered = false;
const ensureWorldMap = () => {
  if (registered) return;
  // world.json is a GeoJSON FeatureCollection, not an echarts-typed shape.
  // @ts-expect-error -- registerMap accepts raw GeoJSON at runtime
  echarts.registerMap("world", worldJson);
  registered = true;
};

export type WorldMapDatum = { name: string; value: number };

export const WorldMapChart = ({
  data,
  height = 320,
}: {
  data: WorldMapDatum[];
  height?: number;
}) => {
  ensureWorldMap();
  const option = useMemo<EChartsOption>(() => {
    const max = Math.max(1, ...data.map((d) => d.value));
    return {
      tooltip: { trigger: "item", formatter: "{b}: {c}" },
      visualMap: {
        show: true,
        left: "left",
        bottom: 8,
        min: 0,
        max,
        calculable: true,
        inRange: { color: ["#eef6f1", "#3d9270", "#255f47"] },
        text: ["More", "Fewer"],
        textStyle: { fontSize: 11, color: "#6b7280" },
      },
      series: [
        {
          type: "map",
          map: "world",
          roam: true,
          scaleLimit: { min: 1, max: 6 },
          itemStyle: { borderColor: "#e5e7eb", areaColor: "#f8fafc" },
          emphasis: {
            label: { show: false },
            itemStyle: { areaColor: "#bfd9cb" },
          },
          data,
        },
      ],
    };
  }, [data]);

  return <EChart option={option} height={height} />;
};
