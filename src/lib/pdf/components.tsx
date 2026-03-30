import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";

const colors = {
  primary: "#18181b",
  secondary: "#71717a",
  border: "#e4e4e7",
  bgLight: "#f4f4f5",
  green: "#16a34a",
  greenBg: "#dcfce7",
  amber: "#d97706",
  amberBg: "#fef9c3",
  amberBgDark: "#fef3c7",
  red: "#dc2626",
  redBg: "#fee2e2",
  white: "#ffffff",
  teal: "#0d9488",
  tealDark: "#0f766e",
  blue: "#2563eb",
  blueDark: "#1e3a5f",
  blueBg: "#dbeafe",
  blueBorder: "#93c5fd",
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
    borderBottomColor: colors.teal,
    color: colors.tealDark,
  },
  h3: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginTop: 12,
    marginBottom: 6,
    color: colors.tealDark,
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

// ─── Page Header (Teal bar) ─────────────────────────────────────────────────

export function PageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "flex-end",
        marginBottom: 20,
        paddingBottom: 6,
        borderBottomWidth: 2,
        borderBottomColor: colors.teal,
      }}
    >
      <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: colors.teal }}>
        {title}
      </Text>
      <Text style={{ fontSize: 8, color: colors.secondary, marginLeft: 8 }}>
        | {subtitle}
      </Text>
    </View>
  );
}

// ─── Page Footer ────────────────────────────────────────────────────────────

export function PageFooter({
  address,
  date,
}: {
  address: string;
  date: string;
}) {
  return (
    <View
      style={{
        position: "absolute",
        bottom: 20,
        left: 40,
        right: 40,
        borderTopWidth: 0.5,
        borderTopColor: colors.border,
        paddingTop: 6,
      }}
    >
      <Text style={{ fontSize: 7, color: colors.secondary, textAlign: "center" }}>
        {address} | Confidential | {date}
      </Text>
    </View>
  );
}

// ─── Table Component ────────────────────────────────────────────────────────

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
  boldCell: {
    fontSize: 8,
    paddingHorizontal: 4,
    fontFamily: "Helvetica-Bold",
  },
});

interface TableProps {
  headers: string[];
  rows: string[][];
  columnWidths?: number[];
  boldFirstColumn?: boolean;
  boldLastRow?: boolean;
}

export function Table({ headers, rows, columnWidths, boldFirstColumn, boldLastRow }: TableProps) {
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
      {rows.map((row, rowIdx) => {
        const isLastRow = rowIdx === rows.length - 1;
        const isBoldRow = boldLastRow && isLastRow;
        return (
          <View
            key={rowIdx}
            style={[
              tableStyles.row,
              rowIdx % 2 === 1 ? tableStyles.altRow : {},
              isBoldRow ? { backgroundColor: colors.bgLight } : {},
            ]}
          >
            {row.map((cell, cellIdx) => (
              <Text
                key={cellIdx}
                style={[
                  (boldFirstColumn && cellIdx === 0) || isBoldRow
                    ? tableStyles.boldCell
                    : tableStyles.cell,
                  { width: `${widths[cellIdx]}%` },
                ]}
              >
                {cell ?? "N/A"}
              </Text>
            ))}
          </View>
        );
      })}
    </View>
  );
}

// ─── Two-Column Detail Table (label: value pairs) ──────────────────────────

export function DetailTable({
  rows,
}: {
  rows: Array<[string, string]>;
}) {
  return (
    <View style={{ marginVertical: 8 }}>
      {rows.map(([label, value], i) => (
        <View
          key={i}
          style={[
            {
              flexDirection: "row",
              paddingVertical: 5,
              paddingHorizontal: 4,
              borderBottomWidth: 0.5,
              borderBottomColor: colors.border,
            },
            i % 2 === 1 ? { backgroundColor: colors.bgLight } : {},
          ]}
        >
          <Text
            style={{
              fontSize: 8,
              fontFamily: "Helvetica-Bold",
              width: "35%",
              paddingHorizontal: 4,
            }}
          >
            {label}
          </Text>
          <Text style={{ fontSize: 8, width: "65%", paddingHorizontal: 4 }}>
            {value}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ─── Narrative Table (for comparable analysis, unit rationale) ──────────────

export function NarrativeTable({
  headers,
  rows,
  columnWidths,
}: {
  headers: string[];
  rows: Array<string[]>;
  columnWidths?: number[];
}) {
  const widths = columnWidths || [25, 75];
  return (
    <View style={{ marginVertical: 8 }}>
      <View style={{ flexDirection: "row", backgroundColor: colors.primary, paddingVertical: 6, paddingHorizontal: 4 }}>
        {headers.map((h, i) => (
          <Text key={i} style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: colors.white, width: `${widths[i]}%`, paddingHorizontal: 4 }}>
            {h}
          </Text>
        ))}
      </View>
      {rows.map((row, rowIdx) => (
        <View key={rowIdx} style={[{ flexDirection: "row", paddingVertical: 6, paddingHorizontal: 4, borderBottomWidth: 0.5, borderBottomColor: colors.border }, rowIdx % 2 === 1 ? { backgroundColor: colors.bgLight } : {}]}>
          {row.map((cell, cellIdx) => (
            <Text key={cellIdx} style={[{ fontSize: 8, width: `${widths[cellIdx]}%`, paddingHorizontal: 4 }, cellIdx === 0 ? { fontFamily: "Helvetica-Bold" } : {}]}>
              {cell}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

// ─── Checkbox Component ─────────────────────────────────────────────────────

export function Checkbox({
  checked,
  label,
}: {
  checked: boolean;
  label: string;
}) {
  return (
    <View style={{ flexDirection: "row", marginBottom: 3 }}>
      <Text style={{ fontSize: 10, marginRight: 6, color: checked ? colors.green : colors.secondary }}>
        {checked ? "\u2611" : "\u2610"}
      </Text>
      <Text style={{ fontSize: 9 }}>{label}</Text>
    </View>
  );
}

// ─── Key Metric Card ────────────────────────────────────────────────────────

export function MetricCard({
  label,
  value,
  color,
  small,
}: {
  label: string;
  value: string;
  color?: string;
  small?: boolean;
}) {
  return (
    <View
      style={{
        padding: small ? 8 : 12,
        backgroundColor: colors.bgLight,
        borderRadius: 4,
        width: small ? "16%" : "30%",
        marginBottom: 8,
        borderLeftWidth: color ? 3 : 0,
        borderLeftColor: color || "transparent",
      }}
    >
      <Text style={{ fontSize: small ? 12 : 16, fontFamily: "Helvetica-Bold", color: color || colors.primary }}>
        {value}
      </Text>
      <Text style={{ fontSize: 7, color: colors.secondary, marginTop: 2 }}>
        {label}
      </Text>
    </View>
  );
}

// ─── Status Badge ───────────────────────────────────────────────────────────

export function StatusBadge({
  status,
}: {
  status: string;
}) {
  const upper = (status || "").toUpperCase().replace(/_/g, " ");
  const isPositive = ["PASS", "PROCEED", "LIKELY PASS"].includes(upper);
  const isNeutral = ["PROCEED WITH CONDITIONS", "UNVERIFIED", "LIKELY", "CHECK"].includes(upper);

  const bgColor = isPositive ? colors.greenBg : isNeutral ? colors.amberBg : colors.redBg;
  const textColor = isPositive ? colors.green : isNeutral ? colors.amber : colors.red;

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
      <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", color: textColor }}>
        {upper}
      </Text>
    </View>
  );
}

// ─── Critical Note Box (amber warning) ──────────────────────────────────────

export function CriticalNoteBox({ text }: { text: string }) {
  if (!text) return <View />;
  return (
    <View
      style={{
        backgroundColor: colors.amberBgDark,
        padding: 12,
        borderRadius: 4,
        marginVertical: 8,
        borderLeftWidth: 4,
        borderLeftColor: colors.amber,
      }}
    >
      <Text style={{ fontSize: 9, color: colors.primary }}>
        <Text style={{ fontFamily: "Helvetica-Bold" }}>WARNING: </Text>
        {text}
      </Text>
    </View>
  );
}

// ─── Summary Box (blue bordered, for valuation summaries) ───────────────────

export function SummaryBox({
  title,
  rows,
  highlightLast,
}: {
  title: string;
  rows: Array<[string, string]>;
  highlightLast?: boolean;
}) {
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: colors.blueBorder,
        backgroundColor: colors.blueBg,
        borderRadius: 4,
        padding: 16,
        marginVertical: 12,
      }}
    >
      <Text
        style={{
          fontSize: 12,
          fontFamily: "Helvetica-Bold",
          color: colors.blueDark,
          textAlign: "center",
          marginBottom: 12,
        }}
      >
        {title}
      </Text>
      {rows.map(([label, value], i) => {
        const isLast = i === rows.length - 1;
        const shouldHighlight = highlightLast && isLast;
        return (
          <View
            key={i}
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              paddingVertical: 6,
              paddingHorizontal: 8,
              borderBottomWidth: isLast ? 0 : 0.5,
              borderBottomColor: colors.blueBorder,
            }}
          >
            <Text
              style={{
                fontSize: shouldHighlight ? 11 : 10,
                fontFamily: shouldHighlight ? "Helvetica-Bold" : "Helvetica",
                color: colors.primary,
              }}
            >
              {label}
            </Text>
            <Text
              style={{
                fontSize: shouldHighlight ? 14 : 12,
                fontFamily: "Helvetica-Bold",
                color: shouldHighlight ? colors.green : colors.primary,
              }}
            >
              {value}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ─── Recommendation Box ─────────────────────────────────────────────────────

export function RecommendationBox({
  status,
  rationale,
}: {
  status: string;
  rationale: string;
}) {
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 4,
        padding: 14,
        marginVertical: 12,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
        <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold", marginRight: 8 }}>
          RECOMMENDATION:
        </Text>
        <StatusBadge status={status} />
      </View>
      <Text style={{ fontSize: 9, color: "#52525b", lineHeight: 1.5 }}>
        <Text style={{ fontFamily: "Helvetica-Bold" }}>Rationale: </Text>
        {rationale}
      </Text>
    </View>
  );
}

// ─── Decision Box ───────────────────────────────────────────────────────────

export function DecisionBox({
  status,
  conditions,
  analystNote,
}: {
  status: string;
  conditions: string[];
  analystNote: string;
}) {
  return (
    <View
      style={{
        borderWidth: 1.5,
        borderColor: colors.border,
        borderRadius: 4,
        padding: 16,
        marginVertical: 12,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
        <Text style={{ fontSize: 12, fontFamily: "Helvetica-Bold", marginRight: 8 }}>
          DECISION:
        </Text>
        <StatusBadge status={status} />
      </View>
      {conditions.length > 0 ? (
        <View>
          <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", marginBottom: 6 }}>
            Conditions for proceeding:
          </Text>
          {conditions.map((c, i) => (
            <Text key={i} style={{ fontSize: 9, color: "#52525b", marginBottom: 3 }}>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>{i + 1}. </Text>
              {c}
            </Text>
          ))}
        </View>
      ) : (
        <View />
      )}
      {analystNote ? (
        <Text style={{ fontSize: 8, color: colors.secondary, marginTop: 8, fontStyle: "italic" }}>
          {analystNote}
        </Text>
      ) : (
        <View />
      )}
    </View>
  );
}

// ─── Bullet List ────────────────────────────────────────────────────────────

export function BulletList({ items }: { items: string[] }) {
  return (
    <View style={{ marginVertical: 4 }}>
      {items.map((item, i) => (
        <View key={i} style={{ flexDirection: "row", marginBottom: 3, paddingLeft: 8 }}>
          <Text style={{ fontSize: 9, marginRight: 6 }}>{"\u2022"}</Text>
          <Text style={{ fontSize: 9, flex: 1 }}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Section Divider ────────────────────────────────────────────────────────

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

// ─── Currency / Number Formatters ───────────────────────────────────────────

export function fmtCurrency(amount: number | null | undefined): string {
  if (amount == null) return "N/A";
  return `\u00A3${amount.toLocaleString("en-GB")}`;
}

export function fmtPercent(value: number | null | undefined): string {
  if (value == null) return "N/A";
  return `${value.toFixed(1)}%`;
}

export function fmtNumber(value: number | null | undefined): string {
  if (value == null) return "N/A";
  return value.toLocaleString("en-GB");
}
