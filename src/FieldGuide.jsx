import { useState } from "react";
import { CLOUD_GUIDE, NATURE_SIGNS, SIG, TYPE_COLORS } from "./data.js";
import { S } from "./styles.js";

export default function FieldGuide() {
  const [selectedCloud, setSelectedCloud] = useState(null);
  const [selectedSign, setSelectedSign] = useState(null);
  const [filterType, setFilterType] = useState("all");

  const filteredSigns = filterType === "all" ? NATURE_SIGNS : NATURE_SIGNS.filter(s => s.type === filterType);

  return (
    <div>
      <span style={S.sectionTitle}>Cloud Types</span>
      {CLOUD_GUIDE.map(cloud => (
        <div key={cloud.name}
          onClick={() => setSelectedCloud(selectedCloud?.name === cloud.name ? null : cloud)}
          style={{ ...S.card, cursor: "pointer",
            background: selectedCloud?.name === cloud.name ? "#1a3a1a" : "#132013",
            borderColor: selectedCloud?.name === cloud.name ? "#2a6a2a" : "#1e3a1e" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 28, flexShrink: 0 }}>{cloud.emoji}</span>
              <div>
                <div style={{ fontSize: 15, color: "#e8f5e0", fontFamily: "'Playfair Display', serif" }}>{cloud.name}</div>
                <div style={{ fontSize: 12, color: "#6b9e6b", marginTop: 2 }}>{cloud.description}</div>
              </div>
            </div>
            <span style={S.tag(cloud.signal, SIG)}>{cloud.forecast}</span>
          </div>
          {selectedCloud?.name === cloud.name && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #1e3a1e" }}>
              <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 8, lineHeight: 1.6 }}>{cloud.detail}</div>
              <div style={{ fontSize: 12, color: "#4ade80", background: "#0f2010", padding: "9px 12px", borderRadius: 8, lineHeight: 1.5, marginBottom: 8 }}>
                💡 {cloud.tip}
              </div>
              {cloud.why && (
                <div style={{ fontSize: 11, color: "#6b9e6b", background: "#0a160a", padding: "8px 10px", borderRadius: 8, lineHeight: 1.6, fontStyle: "italic" }}>
                  🔬 Why: {cloud.why}
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      <span style={{ ...S.sectionTitle, marginTop: 20 }}>Nature Signs</span>
      <div style={{ fontSize: 11, color: "#4a6a4a", marginBottom: 12, lineHeight: 1.5 }}>
        Tap any sign to learn the science behind it
      </div>
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 14 }}>
        {["all","sky","plants","animals","atmosphere","wind"].map(type => (
          <button key={type} onClick={() => setFilterType(type)} style={{
            padding: "5px 12px", borderRadius: 20, fontSize: 11, cursor: "pointer",
            border: "1px solid #2a4a2a", fontFamily: "inherit",
            background: filterType === type ? "#1a4a1a" : "transparent",
            color: filterType === type ? "#4ade80" : "#6b9e6b"
          }}>{type}</button>
        ))}
      </div>
      {filteredSigns.map(sign => (
        <div key={sign.sign}
          onClick={() => setSelectedSign(selectedSign?.sign === sign.sign ? null : sign)}
          style={{ ...S.card, cursor: "pointer",
            background: selectedSign?.sign === sign.sign ? "#1a3a1a" : "#132013",
            borderColor: selectedSign?.sign === sign.sign ? "#2a6a2a" : "#1e3a1e" }}>
          <div style={{ display: "flex", gap: 10 }}>
            <span style={{ fontSize: 22, flexShrink: 0 }}>{sign.emoji}</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div style={{ fontSize: 14, color: "#e8f5e0" }}>{sign.sign}</div>
                <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, flexShrink: 0,
                  background: `${TYPE_COLORS[sign.type]}22`, color: TYPE_COLORS[sign.type] }}>{sign.type}</span>
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4, lineHeight: 1.5 }}>{sign.meaning}</div>
            </div>
          </div>
          {selectedSign?.sign === sign.sign && sign.why && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #1e3a1e",
              fontSize: 11, color: "#6b9e6b", lineHeight: 1.6, fontStyle: "italic" }}>
              🔬 {sign.why}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
