import { useMemo } from "react";
import type { EChartsOption } from "echarts";

import { EChart } from "./EChart";

export type Slice = { name: string; value: number; color?: string };

// Donut — customer status / risk breakdown.
export const DonutChart = ({
  data,
  height = 200,
}: {
  data: Slice[];
  height?: number;
}) => {
  const option = useMemo<EChartsOption>(
    () => ({
      tooltip: { show: false },
      legend: {
        bottom: 0,
        icon: "circle",
        itemWidth: 8,
        itemHeight: 8,
        textStyle: { fontSize: 11, color: "#6b7280" },
      },
      series: [
        {
          type: "pie",
          radius: ["48%", "70%"],
          center: ["50%", "44%"],
          avoidLabelOverlap: false,
          itemStyle: { borderColor: "#fff", borderWidth: 2 },
          labelLine: { show: false },
          // Hidden by default; on hover the slice's name + value render in the
          // middle of the donut.
          label: { show: false, position: "center" },
          emphasis: {
            label: {
              show: true,
              formatter: (p) => `{name|${p.name}}\n{val|${String(p.value)}}`,
              rich: {
                name: { fontSize: 12, color: "#6b7280", padding: [0, 0, 6, 0] },
                val: { fontSize: 24, fontWeight: "bold", color: "#111827" },
              },
            },
          },
          data: data.map((d) => ({
            name: d.name,
            value: d.value,
            ...(d.color ? { itemStyle: { color: d.color } } : {}),
          })),
        },
      ],
    }),
    [data],
  );
  return <EChart option={option} height={height} />;
};

// Horizontal bar — top countries by customer count.
export const BarChart = ({
  data,
  height = 200,
}: {
  data: Slice[];
  height?: number;
}) => {
  const option = useMemo<EChartsOption>(
    () => ({
      grid: { left: 8, right: 24, top: 8, bottom: 8, containLabel: true },
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      xAxis: {
        type: "value",
        minInterval: 1,
        splitLine: { lineStyle: { color: "#f1f5f9" } },
      },
      yAxis: {
        type: "category",
        inverse: true,
        data: data.map((d) => d.name),
        axisTick: { show: false },
        axisLine: { show: false },
        axisLabel: { color: "#6b7280", fontSize: 11 },
      },
      series: [
        {
          type: "bar",
          data: data.map((d) => d.value),
          barWidth: "58%",
          itemStyle: { color: "#3d9270", borderRadius: [0, 4, 4, 0] },
        },
      ],
    }),
    [data],
  );
  return <EChart option={option} height={height} />;
};

// Area line — new customers over time.
export const AreaChart = ({
  data,
  height = 200,
}: {
  data: { day: string; value: number }[];
  height?: number;
}) => {
  const shortDate = (v: string) => {
    const d = new Date(v);
    return Number.isNaN(d.getTime())
      ? v
      : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  };
  const option = useMemo<EChartsOption>(
    () => ({
      grid: { left: 4, right: 12, top: 16, bottom: 4, containLabel: true },
      tooltip: {
        trigger: "axis",
        borderWidth: 0,
        backgroundColor: "rgba(17,24,39,0.9)",
        padding: [6, 10],
        textStyle: { color: "#fff", fontSize: 12 },
        axisPointer: {
          type: "line",
          lineStyle: { color: "#3d9270", width: 1, type: "dashed" },
        },
        formatter: (params) => {
          const list = params as unknown as Array<{
            axisValue: string;
            data: number;
          }>;
          const p = list[0];
          if (!p) return "";
          const d = new Date(p.axisValue);
          const label = Number.isNaN(d.getTime())
            ? p.axisValue
            : d.toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              });
          const n = p.data;
          return `${label}<br/><b>${n}</b> new customer${n === 1 ? "" : "s"}`;
        },
      },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: data.map((d) => d.day),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: "#9ca3af",
          fontSize: 10,
          hideOverlap: true,
          formatter: shortDate,
        },
      },
      yAxis: {
        type: "value",
        minInterval: 1,
        splitLine: { lineStyle: { color: "#f1f5f9" } },
        axisLabel: { color: "#9ca3af", fontSize: 10 },
      },
      series: [
        {
          type: "line",
          smooth: 0.4,
          showSymbol: false,
          symbol: "circle",
          symbolSize: 7,
          data: data.map((d) => d.value),
          lineStyle: {
            color: "#3d9270",
            width: 2.5,
            cap: "round",
            shadowColor: "rgba(61,146,112,0.35)",
            shadowBlur: 8,
            shadowOffsetY: 4,
          },
          itemStyle: {
            color: "#3d9270",
            borderColor: "#fff",
            borderWidth: 2,
          },
          emphasis: { scale: 1.3 },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(61,146,112,0.35)" },
                { offset: 1, color: "rgba(61,146,112,0)" },
              ],
            },
          },
        },
      ],
    }),
    [data],
  );
  return <EChart option={option} height={height} />;
};
