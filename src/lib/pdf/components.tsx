import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";

const colors = {
  primary: "#18181b",
  secondary: "#71717a",
  border: "#e4e4e7",
  bgLight: "#f4f4f5",
  green: "#16a34a",
  amber: "#d97706",
  red: "#dc2626",
  white: "#ffffff",
};

export const baseStyles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: colors.primary,
  },
  h1: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  h2: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    marginTop: 20,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  h3: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginTop: 12,
    marginBottom: 6,
  },
  body: {
    fontSize: 10,
    lineHeight: 1.5,
    color: colors.primary,
  },
  muted: {
    fontSize: 9,
    color: colors.secondary,
  },
  bold: {
    fontFamily: "Helvetica-Bold",
  },
});

// ─── Table Component ──────────────────────────────────────────────────────────

const tableStyles = StyleSheet.create({
  table: {
    marginVertical: 8,
  },
  headerRow: {
    flexDirection: "row",
    backgroundColor: colors.primary,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  headerCell: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: colors.white,
    paddingHorizontal: 4,
  },
  row: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  altRow: {
    backgroundColor: colors.bgLight,
  },
  cell: {
    fontSize: 8,
    paddingHorizontal: 4,
  },
});

interface TableProps {
  headers: string[];
  rows: string[][];
  columnWidths?: number[];
}

export function Table({ headers, rows, columnWidths }: TableProps) {
  const defaultWidth = 100 / headers.length;
  const widths = columnWidths || headers.map(() => defaultWidth);

  return (
    <View style={tableStyles.table}>
      <View style={tableStyles.headerRow}>
        {headers.map((h, i) => (
          <Text
            key={i}
            style={[tableStyles.headerCell, { width: `${widths[i]}%` }]}
          >
            {h}
          </Text>
        ))}
      </View>
      {rows.map((row, rowIdx) => (
        <View
          key={rowIdx}
          style={[
            tableStyles.row,
            rowIdx % 2 === 1 ? tableStyles.altRow : {},
          ]}
        >
          {row.map((cell, cellIdx) => (
            <Text
              key={cellIdx}
              style={[tableStyles.cell, { width: `${widths[cellIdx]}%` }]}
            >
              {cell ?? "N/A"}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

// ─── Checkbox Component ──────────────────────────────────────────────────────

export function Checkbox({
  checked,
  label,
}: {
  checked: boolean;
  label: string;
}) {
  return (
    <View style={{ flexDirection: "row", marginBottom: 3 }}>
      <Text style={{ fontSize: 10, marginRight: 6 }}>
        {checked ? "\u2611" : "\u2610"}
      </Text>
      <Text style={{ fontSize: 9 }}>{label}</Text>
    </View>
  );
}

// ─── Key Metric Card ────────────────────────────────────────────────────────

const metricStyles = StyleSheet.create({
  card: {
    padding: 12,
    backgroundColor: colors.bgLight,
    borderRadius: 4,
    width: "30%",
    marginBottom: 8,
  },
  label: {
    fontSize: 8,
    color: colors.secondary,
    marginBottom: 2,
  },
  value: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
  },
});

export function MetricCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <View style={metricStyles.card}>
      <Text style={metricStyles.label}>{label}</Text>
      <Text style={[metricStyles.value, color ? { color } : {}]}>
        {value}
      </Text>
    </View>
  );
}

// ─── Status Badge ────────────────────────────────────────────────────────────

export function StatusBadge({
  status,
}: {
  status: "PASS" | "FAIL" | "PROCEED" | "PROCEED_WITH_CONDITIONS" | "REJECT";
}) {
  const isPositive = status === "PASS" || status === "PROCEED";
  const isNeutral = status === "PROCEED_WITH_CONDITIONS";
  const bgColor = isPositive
    ? "#dcfce7"
    : isNeutral
      ? "#fef9c3"
      : "#fee2e2";
  const textColor = isPositive
    ? colors.green
    : isNeutral
      ? colors.amber
      : colors.red;

  return (
    <View
      style={{
        backgroundColor: bgColor,
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: 10,
        alignSelf: "flex-start",
      }}
    >
      <Text
        style={{
          fontSize: 9,
          fontFamily: "Helvetica-Bold",
          color: textColor,
        }}
      >
        {status.replace(/_/g, " ")}
      </Text>
    </View>
  );
}

// ─── Section Divider ─────────────────────────────────────────────────────────

export function SectionDivider() {
  return (
    <View
      style={{
        borderBottomWidth: 0.5,
        borderBottomColor: colors.border,
        marginVertical: 12,
      }}
    />
  );
}

// ─── Currency / Number Formatters ────────────────────────────────────────────

export function fmtCurrency(amount: number | null | undefined): string {
  if (amount == null) return "N/A";
  return `£${amount.toLocaleString("en-GB")}`;
}

export function fmtPercent(value: number | null | undefined): string {
  if (value == null) return "N/A";
  return `${value.toFixed(1)}%`;
}

export function fmtNumber(value: number | null | undefined): string {
  if (value == null) return "N/A";
  return value.toLocaleString("en-GB");
}
