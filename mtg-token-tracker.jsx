const { useState, useCallback, useRef } = React;

const COLORS = {
  bg: "#0a0c10",
  surface: "#12161e",
  card: "#1a1f2e",
  border: "#2a3050",
  gold: "#c9a84c",
  goldLight: "#e8c96a",
  teal: "#3db8a8",
  red: "#c94c4c",
  text: "#d4d8e8",
  muted: "#6b7494",
  tap: "#c97c3d",
  artifact: "#a0a8c0",
  eot: "#b06de8",
};

const ARTIFACT_TOKENS = ["Treasure", "Clue", "Food", "Blood", "Map", "Shard"];

const CREATURE_TOKENS = [
  "Saproling", "Goblin", "Soldier", "Zombie", "Spirit", "Dragon",
  "Wolf", "Elemental", "Human", "Insect", "Thopter",
  "Angel", "Vampire", "Merfolk", "Elf", "Cat", "Bird",
];

const COUNTER_TYPES = ["+1/+1", "-1/-1", "loyalty", "poison", "charge", "fade", "time", "custom"];

const EVERGREEN_KEYWORDS = [
  "Flying", "Trample", "Haste", "Vigilance",
  "Lifelink", "Deathtouch", "First Strike", "Menace",
];

// Symbol display: label shown on button, inserted text in ability box
const MANA_SYMBOLS = [
  // Generic
  { label: "1", text: "{1}" }, { label: "2", text: "{2}" }, { label: "3", text: "{3}" },
  { label: "4", text: "{4}" }, { label: "5", text: "{5}" }, { label: "6", text: "{6}" },
  { label: "X", text: "{X}" },
  // Colored
  { label: "W", text: "{W}", color: "#f9ffd4", bg: "#7a7040" },
  { label: "U", text: "{U}", color: "#aaddff", bg: "#2a4a70" },
  { label: "B", text: "{B}", color: "#c8b8d8", bg: "#2a1a3a" },
  { label: "R", text: "{R}", color: "#ffbbaa", bg: "#6a2a1a" },
  { label: "G", text: "{G}", color: "#aaffcc", bg: "#1a4a2a" },
  // Colorless
  { label: "C", text: "{C}", color: "#d8eeff", bg: "#2a3a50" },
  // Hybrid
  { label: "W/U", text: "{W/U}", color: "#d4eeff", bg: "#4a5a60" },
  { label: "W/B", text: "{W/B}", color: "#d8c8e8", bg: "#4a3a50" },
  { label: "U/B", text: "{U/B}", color: "#b8b0d8", bg: "#222040" },
  { label: "U/R", text: "{U/R}", color: "#ffccbb", bg: "#3a3060" },
  { label: "B/R", text: "{B/R}", color: "#ffaaaa", bg: "#3a1a2a" },
  { label: "B/G", text: "{B/G}", color: "#aaddbb", bg: "#1a2a20" },
  { label: "R/G", text: "{R/G}", color: "#ccffaa", bg: "#3a3a10" },
  { label: "R/W", text: "{R/W}", color: "#ffeebb", bg: "#5a3a20" },
  { label: "G/W", text: "{G/W}", color: "#eeffcc", bg: "#3a4a20" },
  { label: "G/U", text: "{G/U}", color: "#aaffee", bg: "#1a3a3a" },
  // Phyrexian
  { label: "P/W", text: "{W/P}", color: "#fff8d4", bg: "#6a6030" },
  { label: "P/U", text: "{U/P}", color: "#aaccff", bg: "#203a60" },
  { label: "P/B", text: "{B/P}", color: "#ccaaee", bg: "#28103a" },
  { label: "P/R", text: "{R/P}", color: "#ffaa88", bg: "#60200a" },
  { label: "P/G", text: "{G/P}", color: "#88ffaa", bg: "#0a3a1a" },
];

// Tap symbol inserted as text
const TAP_SYMBOL = "{T}";

// MTG color identities
const MTG_COLORS = [
  { id: "C", label: "Colorless", hex: "#a0a8c0", solo: true },
  { id: "W", label: "White",     hex: "#f0e88a" },
  { id: "U", label: "Blue",      hex: "#4a90d9" },
  { id: "B", label: "Black",     hex: "#9a7abf" },
  { id: "R", label: "Red",       hex: "#d95540" },
  { id: "G", label: "Green",     hex: "#4aaa6a" },
];

function cardAccent(colors) {
  if (!colors || colors.length === 0) return "#a0a8c0";
  return MTG_COLORS.find(c => c.id === colors[0])?.hex || "#a0a8c0";
}

function cardGradient(colors) {
  if (!colors || colors.length === 0) return "#a0a8c0";
  if (colors.length === 1) return MTG_COLORS.find(c => c.id === colors[0])?.hex || "#a0a8c0";
  const hexes = colors.map(id => MTG_COLORS.find(c => c.id === id)?.hex || "#888");
  const step = 100 / (hexes.length - 1);
  const stops = hexes.map((h, i) => `${h} ${Math.round(i * step)}%`).join(", ");
  return `linear-gradient(135deg, ${stops})`;
}

const initialDraft = () => ({
  id: Date.now() + Math.random(),
  category: "creature",
  type: "Saproling",
  customType: "",
  quantity: 1,
  basePower: 1,
  baseToughness: 1,
  powerMod: 0,
  toughnessMod: 0,
  eotPowerMod: 0,
  eotToughnessMod: 0,
  counters: [],
  tappedCount: 0,
  isCreature: false,
  colors: ["G"],
  keywords: [],
  abilityText: "",
  artUrl: null,        // Scryfall card art URL
  artUrls: [],         // All available printings for this token
  scryfallId: null,    // Selected Scryfall card ID
});

// ── Scryfall helpers ──────────────────────────────────────────────────────────
const SCRYFALL_CACHE = {};

function scryfallSearch(query, category) {
  if (!query || query.length < 2) return Promise.resolve({ results: [], error: null });
  var isCopy = category === "copy";
  const cacheKey = (category || "creature") + ":" + query.toLowerCase().trim();
  if (SCRYFALL_CACHE[cacheKey]) return Promise.resolve(SCRYFALL_CACHE[cacheKey]);
  var qStr = isCopy ? ("-t:token name:" + query.toLowerCase().trim()) : ("t:token name:" + query.toLowerCase().trim());
  var unique = isCopy ? "art" : "prints";
  const q = encodeURIComponent(qStr);
  return fetch("https://api.scryfall.com/cards/search?q=" + q + "&unique=" + unique + "&order=released", {
    headers: { "User-Agent": "MTGBattlefield/1.0" }
  }).then(function(res) {
    if (res.status === 404) return { results: [], error: null };
    if (!res.ok) {
      return res.json().catch(function() { return {}; }).then(function(err) {
        return { results: [], error: err.details || ("API error " + res.status) };
      });
    }
    return res.json().then(function(data) {
      const groups = {};
      (data.data || []).forEach(function(card) {
        const gk = card.name + "|" + (card.colors||[]).join("") + "|" + (card.power||"") + "|" + (card.toughness||"");
        if (!groups[gk]) groups[gk] = { card: card, printings: [] };
        const imgUri = (card.image_uris && card.image_uris.art_crop)
          || (card.card_faces && card.card_faces[0] && card.card_faces[0].image_uris && card.card_faces[0].image_uris.art_crop)
          || null;
        const imgNormal = (card.image_uris && card.image_uris.normal)
          || (card.card_faces && card.card_faces[0] && card.card_faces[0].image_uris && card.card_faces[0].image_uris.normal)
          || null;
        if (imgUri) groups[gk].printings.push({ id: card.id, artUrl: imgUri, setName: card.set_name, artFull: imgNormal });
      });
      const results = Object.values(groups).map(function(g) {
        const card = g.card, printings = g.printings;
        const face0 = card.card_faces && card.card_faces[0];
        return {
          name: card.name,
          colors: card.colors || (face0 && face0.colors) || [],
          power: card.power != null ? card.power : (face0 ? face0.power : null),
          toughness: card.toughness != null ? card.toughness : (face0 ? face0.toughness : null),
          keywords: card.keywords || [],
          oracleText: card.oracle_text || (face0 && face0.oracle_text) || "",
          artUrl: printings[0] ? printings[0].artUrl : null,
          artUrls: printings,
          scryfallId: printings[0] ? printings[0].id : null,
          typeLine: card.type_line || "",
        };
      });
      const out = { results: results, error: null };
      SCRYFALL_CACHE[cacheKey] = out;
      return out;
    });
  }).catch(function(e) {
    return { results: [], error: e.message || "Network error" };
  });
}

// Map Scryfall color strings to our MTG_COLORS ids
function sfColorToId(c) {
  return { W:"W", U:"U", B:"B", R:"R", G:"G" }[c] || "C";
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Hub App ───────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

const styleTag = document.createElement("style");
styleTag.textContent = `
  @keyframes slideUp   { from{transform:translateY(100%)} to{transform:translateY(0)} }
  @keyframes slideDown { from{transform:translateY(0)}    to{transform:translateY(100%)} }
  @keyframes fadeIn    { from{opacity:0}                  to{opacity:1} }
  @keyframes resultPop { 0%{transform:scale(0.5);opacity:0} 70%{transform:scale(1.15)} 100%{transform:scale(1);opacity:1} }
  @keyframes diceRoll {
    0%   { transform: rotate(0deg)   scale(1);   }
    20%  { transform: rotate(72deg)  scale(1.25); }
    45%  { transform: rotate(200deg) scale(0.85); }
    65%  { transform: rotate(310deg) scale(1.2); }
    85%  { transform: rotate(380deg) scale(0.95); }
    100% { transform: rotate(720deg) scale(1);   }
  }
  @keyframes coinFlip {
    0%   { transform: rotateY(0deg); }
    50%  { transform: rotateY(900deg); }
    100% { transform: rotateY(1800deg); }
  }
  @keyframes modalSlideUp   { from{transform:translateY(100%);opacity:0.6} to{transform:translateY(0);opacity:1} }
  @keyframes modalSlideDown { from{transform:translateY(0);opacity:1} to{transform:translateY(100%);opacity:0.6} }
  @keyframes formSlideUp    { from{transform:translateY(100%)} to{transform:translateY(0)} }
  @keyframes formSlideDown  { from{transform:translateY(0)} to{transform:translateY(100%)} }
  @keyframes cardSettle     { from{transform:translateY(-18px);opacity:0.4} to{transform:translateY(0);opacity:1} }
  @keyframes cardSettleDown { from{transform:translateY(18px);opacity:0.4}  to{transform:translateY(0);opacity:1} }
`;
if (!document.head.querySelector("#bf-styles")) {
  styleTag.id = "bf-styles";
  document.head.appendChild(styleTag);
}

function App() {
  const [screen, setScreen]     = useState("hub");
  const [animDir, setAnimDir]   = useState(null);
  const [diceState, setDiceState] = useState("closed");
  const [rulingsOpen, setRulingsOpen] = useState(false);
  const [rulingsClosing, setRulingsClosing] = useState(false);
  const playersRef = useRef([]);

  // Token form state lifted here so FAB + sheet render outside the scroll container
  const [showAdd, setShowAdd]       = useState(false);
  const [formClosing, setFormClosing] = useState(false);
  const [draft, setDraft]           = useState(null);
  const [tokens, setTokens]         = useState([]);
  const ttScrollRef = useRef(null);

  const goTo = (dest) => {
    setAnimDir("up");
    setTimeout(() => { setScreen(dest); setAnimDir(null); }, 340);
  };
  const goBack = () => {
    setAnimDir("down");
    setTimeout(() => { setScreen("hub"); setAnimDir(null); }, 340);
  };

  const openRulings  = () => { setRulingsOpen(true); setRulingsClosing(false); };
  const closeRulings = () => {
    setRulingsClosing(true);
    setTimeout(() => { setRulingsOpen(false); setRulingsClosing(false); }, 320);
  };

  const openDice  = () => setDiceState("open");
  const closeDice = () => {
    setDiceState("closing");
    setTimeout(() => setDiceState("closed"), 320);
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      if (ttScrollRef.current) ttScrollRef.current.scrollTop = ttScrollRef.current.scrollHeight;
    }, 60);
  };

  const openForm  = () => { setDraft(initialDraft()); setShowAdd(true); setFormClosing(false); };
  const closeForm = () => {
    setFormClosing(true);
    setTimeout(() => { setShowAdd(false); setFormClosing(false); setDraft(null); scrollToBottom(); }, 340);
  };

  const addTokenFromForm = () => {
    if (!draft) return;
    const name = draft.category === "artifact"
      ? draft.type
      : (draft.type === "Custom…" ? draft.customType || "Custom" : draft.type);
    if (!name) return;
    setTokens(t => [...t, {
      ...draft,
      id: Date.now() + Math.random(),
      isCreature: draft.category === "creature",
      colors: draft.colors || ["C"],
    }]);
  };

  const onTokenAdded = () => { scrollToBottom(); };

  const onScreen = screen === "tokens";

  return (
    <div style={{ position:"relative", minHeight:"100vh", background:COLORS.bg }}>
      <HubScreen onNav={goTo} onDice={openDice} onRulings={openRulings} playersRef={playersRef} />

      {(onScreen || animDir) && (
        <div ref={ttScrollRef} data-scroll="tt" style={{
          position:"fixed", inset:0, zIndex:50,
          overflowY:"auto", WebkitOverflowScrolling:"touch",
          animation: animDir === "down"
            ? "slideDown 0.34s cubic-bezier(0.4,0,0.2,1) forwards"
            : "slideUp 0.34s cubic-bezier(0.4,0,0.2,1) forwards",
        }}>
          <TokenTrackerScreen onBack={goBack}
            tokens={tokens} setTokens={setTokens} />
        </div>
      )}

      {/* FAB — true viewport-fixed, outside scroll container */}
      {onScreen && !showAdd && (
        <button onClick={openForm} style={{
          position: "fixed", bottom: 24, right: 20, zIndex: 55,
          background: `linear-gradient(135deg, ${COLORS.gold}, #9a6e1a)`,
          color: "#1a1508", border: "none", borderRadius: 28,
          padding: "14px 22px", fontSize: 15, fontWeight: "bold",
          fontFamily: "inherit", cursor: "pointer",
          boxShadow: `0 4px 20px ${COLORS.gold}66`,
          letterSpacing: 0.5,
        }}>✦ Create Token</button>
      )}

      {/* Create Token bottom-sheet — also outside scroll container */}
      {onScreen && showAdd && draft && (
        <div onClick={closeForm} style={{
          position: "fixed", inset: 0, zIndex: 60,
          background: "rgba(0,0,0,0.72)",
          display: "flex", alignItems: "flex-end", justifyContent: "center",
          animation: "fadeIn 0.2s ease",
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: "100%", maxWidth: 520,
            background: COLORS.surface,
            borderRadius: "20px 20px 0 0",
            border: `1px solid ${COLORS.border}`, borderBottom: "none",
            boxShadow: "0 -8px 40px rgba(0,0,0,0.7)",
            maxHeight: "88vh",
            display: "flex", flexDirection: "column",
            animation: formClosing
              ? "modalSlideDown 0.32s cubic-bezier(0.4,0,0.2,1) forwards"
              : "modalSlideUp 0.32s cubic-bezier(0.4,0,0.2,1) forwards",
          }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: COLORS.border, margin: "14px auto 0", flexShrink: 0 }}/>
            <div style={{
              padding: "14px 16px 12px",
              borderBottom: `1px solid ${COLORS.border}`,
              display: "flex", alignItems: "center", flexShrink: 0,
            }}>
              <div style={{ width: 36 }} />
              <div style={{ flex: 1, textAlign: "center" }}>
                <div style={{
                  fontSize: 18, fontWeight: "bold", letterSpacing: 3,
                  textTransform: "uppercase",
                  background: `linear-gradient(135deg, ${COLORS.goldLight}, ${COLORS.gold})`,
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                }}>✦ New Token ✦</div>
              </div>
              <button onClick={closeForm} style={{
                width: 36, background: "#ffffff0a", border: `1px solid ${COLORS.border}`,
                color: COLORS.muted, borderRadius: 8, padding: "5px 0",
                fontSize: 14, cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
              }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "14px 16px 36px" }}>
              <AddTokenForm draft={draft} setDraft={setDraft}
                onAdd={() => { addTokenFromForm(); closeForm(); }}
                onCancel={closeForm} hideHeader={true} />
            </div>
          </div>
        </div>
      )}

      {diceState !== "closed" && (
        <DiceModal closing={diceState === "closing"} onClose={closeDice} />
      )}
      {rulingsOpen && (
        <RulingsSheet
          closing={rulingsClosing}
          onClose={closeRulings}
          tokens={tokens}
          playersRef={playersRef}
        />
      )}
    </div>
  );
}

// ── Hub Screen ────────────────────────────────────────────────────────────────
// 21-color gradient spectrum: white→gray→near-black, then hue wheel red→orange→yellow→green→blue→purple
const ALL_PLAYER_COLORS = [
  // White → Gray → Near-Black
  { id:"w1", hex:"#e8e4d8", label:"Ivory"      },
  { id:"w2", hex:"#a8a098", label:"Ash"         },
  { id:"w3", hex:"#585060", label:"Slate"       },
  // Red spectrum (warm red → rose)
  { id:"r1", hex:"#e85040", label:"Crimson"    },
  { id:"r2", hex:"#c03050", label:"Rose"        },
  { id:"r3", hex:"#f07878", label:"Blush"       },
  // Orange spectrum
  { id:"o1", hex:"#e87030", label:"Flame"       },
  { id:"o2", hex:"#c05820", label:"Rust"        },
  { id:"o3", hex:"#f0a060", label:"Copper"      },
  // Yellow spectrum
  { id:"y1", hex:"#d8b830", label:"Gold"        },
  { id:"y2", hex:"#e8d840", label:"Sun"         },
  { id:"y3", hex:"#b09020", label:"Amber"       },
  // Green spectrum
  { id:"g1", hex:"#40a860", label:"Forest"      },
  { id:"g2", hex:"#60c870", label:"Jade"        },
  { id:"g3", hex:"#207840", label:"Moss"        },
  // Blue spectrum
  { id:"b1", hex:"#3888d8", label:"Azure"       },
  { id:"b2", hex:"#60b0f0", label:"Sky"         },
  { id:"b3", hex:"#1850a0", label:"Midnight"    },
  // Purple spectrum (blue-purple → violet)
  { id:"p1", hex:"#8060c8", label:"Violet"      },
  { id:"p2", hex:"#b080e8", label:"Lavender"    },
  { id:"p3", hex:"#502880", label:"Dusk"        },
];
const DEFAULT_COLOR_IDS = ["b1","r1","g1","p1"];
let nextPlayerId = 5;

function HubScreen({ onNav, onDice, onRulings, playersRef }) {
  const [players, setPlayers] = useState(() => [
    { id:1, name:"Player 1", colorId:"b1", life:40, poison:0, energy:0, exp:0, rad:0, cmdDamage:{}, commanders:[] },
    { id:2, name:"Player 2", colorId:"r1", life:40, poison:0, energy:0, exp:0, rad:0, cmdDamage:{}, commanders:[] },
    { id:3, name:"Player 3", colorId:"g1", life:40, poison:0, energy:0, exp:0, rad:0, cmdDamage:{}, commanders:[] },
    { id:4, name:"Player 4", colorId:"p1", life:40, poison:0, energy:0, exp:0, rad:0, cmdDamage:{}, commanders:[] },
  ]);
  const [playerCount, setPlayerCount] = useState(1);
  const [editingName, setEditingName] = useState(null);
  const [tempName, setTempName]       = useState("");
  const [showNewGame, setShowNewGame] = useState(false);

  // Keep App-level ref in sync for rulings context
  if (playersRef) playersRef.current = players.slice(0, playerCount);

  const activePlayers = players.slice(0, playerCount);
  const isSolo = playerCount === 1;
  const gridCols = isSolo ? "1fr" : "1fr 1fr";

  const getColor = (p) => ALL_PLAYER_COLORS.find(c => c.id === p.colorId)?.hex || "#4a90d9";

  const updatePlayer  = (id, patch) => setPlayers(ps => ps.map(p => p.id===id ? {...p,...patch} : p));
  const adjustLife    = (id, delta) => setPlayers(ps => ps.map(p => p.id===id ? {...p, life:p.life+delta} : p));

  const adjustCmdDmg = (targetId, fromId, delta) => setPlayers(ps => ps.map(p => {
    if (p.id !== targetId) return p;
    const cur = p.cmdDamage[fromId] || 0;
    return { ...p, cmdDamage: { ...p.cmdDamage, [fromId]: Math.max(0, cur + delta) } };
  }));

  const removePlayer = (id) => {
    setPlayers(ps => ps.filter(p => p.id !== id));
    setPlayerCount(c => Math.max(1, c - 1));
  };

  const newGame = () => {
    setPlayers(ps => ps.map(p => ({ ...p, life:40, poison:0, energy:0, exp:0, rad:0, cmdDamage:{}, commanders:[] })));
    setShowNewGame(false);
  };

  return (
    <div style={{ minHeight:"100vh", background:COLORS.bg, fontFamily:"'Georgia','Times New Roman',serif", color:COLORS.text }}>

      {/* Header */}
      <div style={{
        background:`linear-gradient(180deg,#0d1020 0%,${COLORS.bg} 100%)`,
        borderBottom:`1px solid ${COLORS.border}`,
        padding:"18px 16px 14px", textAlign:"center",
        position:"sticky", top:0, zIndex:10, backdropFilter:"blur(8px)",
      }}>
        <div style={{ fontSize:10, letterSpacing:4, color:COLORS.gold, textTransform:"uppercase", marginBottom:3 }}>✦ MTG ✦</div>
        <h1 style={{
          margin:0, fontSize:26, fontWeight:"bold",
          background:`linear-gradient(135deg,${COLORS.goldLight},${COLORS.gold})`,
          WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", letterSpacing:1,
        }}>Battlefield</h1>

        {/* Player count pills */}
        <div style={{ display:"flex", justifyContent:"center", gap:6, marginTop:10, flexWrap:"wrap" }}>
          {[1,2,3,4].map(n => (
            <button key={n} onClick={() => setPlayerCount(n)} style={{
              padding:"4px 12px", borderRadius:16, fontSize:11,
              background: playerCount===n ? COLORS.gold+"33" : "#ffffff0a",
              border:`1px solid ${playerCount===n ? COLORS.gold : COLORS.border}`,
              color: playerCount===n ? COLORS.gold : COLORS.muted,
              cursor:"pointer", fontFamily:"inherit", letterSpacing:0.5, fontSize:13,
            }}>{n===1 ? "Solo" : `${n}P`}</button>
          ))}
        </div>
      </div>

      {/* Player cards */}
      <div style={{ padding:"14px 12px 0" }}>
        <div style={{ display:"grid", gridTemplateColumns:gridCols, gap:10 }}>
          {activePlayers.map((p, i) => (
            <LifeCard
              key={p.id} player={p} color={getColor(p)}
              allPlayers={activePlayers} getColor={getColor}
              onLifeChange={delta => adjustLife(p.id, delta)}
              onCmdAdjust={(fromId, delta) => adjustCmdDmg(p.id, fromId, delta)}
              onCounterUpdate={patch => updatePlayer(p.id, patch)}
              onColorChange={colorId => updatePlayer(p.id, { colorId })}
              onCommanderUpdate={commanders => updatePlayer(p.id, { commanders })}
              onNameEdit={() => { setEditingName(p.id); setTempName(p.name); }}
              editingName={editingName === p.id}
              tempName={tempName}
              onTempNameChange={setTempName}
              onNameSave={() => { updatePlayer(p.id, { name: tempName || p.name }); setEditingName(null); }}
              isSolo={isSolo}
              canRemove={activePlayers.length > 1}
              onRemove={() => removePlayer(p.id)}
            />
          ))}
        </div>

        {/* New Game button */}
        <div style={{ padding:"18px 0 130px", textAlign:"center" }}>
          {!showNewGame ? (
            <button onClick={() => setShowNewGame(true)} style={{
              padding:"10px 32px", borderRadius:20, fontSize:13,
              background:"#ffffff08", border:`1px solid ${COLORS.border}`,
              color:COLORS.muted, cursor:"pointer", fontFamily:"inherit", letterSpacing:0.5,
            }}>↺ New Game</button>
          ) : (
            <div style={{ display:"flex", gap:8, justifyContent:"center", alignItems:"center" }}>
              <span style={{ fontSize:13, color:COLORS.muted }}>Reset all totals?</span>
              <button onClick={newGame} style={{
                padding:"8px 20px", borderRadius:16, fontSize:12,
                background:COLORS.red+"44", border:`1px solid ${COLORS.red}`,
                color:COLORS.red, cursor:"pointer", fontFamily:"inherit", fontWeight:"bold",
              }}>Confirm</button>
              <button onClick={() => setShowNewGame(false)} style={{
                padding:"8px 14px", borderRadius:16, fontSize:12,
                background:"#ffffff08", border:`1px solid ${COLORS.border}`,
                color:COLORS.muted, cursor:"pointer", fontFamily:"inherit",
              }}>Cancel</button>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Dock */}
      <div style={{
        position:"fixed", bottom:0, left:0, right:0,
        background:`${COLORS.surface}ee`, borderTop:`1px solid ${COLORS.border}`,
        backdropFilter:"blur(12px)", padding:"10px 16px 20px",
        display:"flex", gap:10, justifyContent:"center", zIndex:20,
      }}>
        <ToolButton icon="⬡" label="Token Tracker" onClick={() => onNav("tokens")} accent={COLORS.gold} />
        <ToolButton icon="🎲" label="Dice / Coin"   onClick={onDice}                accent={COLORS.teal} />
        <ToolButton icon="⚖" label="Ask the Rules" onClick={onRulings}             accent={COLORS.eot} />
      </div>
    </div>
  );
}

function ToolButton({ icon, label, onClick, accent }) {
  return (
    <button onClick={onClick} style={{
      display:"flex", flexDirection:"column", alignItems:"center",
      gap:3, padding:"8px 22px", borderRadius:14,
      background:accent+"22", border:`1px solid ${accent}55`,
      color:accent, cursor:"pointer", fontFamily:"inherit", transition:"all 0.15s",
    }}>
      <span style={{ fontSize:22 }}>{icon}</span>
      <span style={{ fontSize:10, letterSpacing:0.8, textTransform:"uppercase" }}>{label}</span>
    </button>
  );
}

// ── Life Card ─────────────────────────────────────────────────────────────────
function LifeCard({
  player, color, allPlayers, getColor,
  onLifeChange, onCmdAdjust, onCounterUpdate, onColorChange, onCommanderUpdate,
  onNameEdit, editingName, tempName, onTempNameChange, onNameSave,
  isSolo, canRemove, onRemove,
}) {
  const [expanded, setExpanded] = useState(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [cmdInput, setCmdInput] = useState("");
  const isLow   = player.life <= 10;
  const isDead  = player.life <= 0;
  // In solo, cmd damage comes from named commanders; in multiplayer from opponent players
  const cmdTotals = isSolo
    ? (player.commanders || []).map(c => c.damage || 0)
    : allPlayers.filter(p => p.id !== player.id).map(p => player.cmdDamage[p.id] || 0);
  const cmdDead   = cmdTotals.some(v => v >= 21);
  const totalCmd  = cmdTotals.reduce((s,v) => s+v, 0);

  const COUNTER_DEFS = [
    { key:"poison", icon:"☠", label:"Poison", accent:"#7abf3a", lethal:10 },
    { key:"energy", icon:"⚡", label:"Energy", accent:COLORS.gold },
    { key:"exp",    icon:"✦",  label:"Exp",    accent:"#8ae0e0" },
    { key:"rad",    icon:"☢",  label:"Rad",    accent:"#c9d44c" },
  ];
  const activeCounters = COUNTER_DEFS.filter(cd => (player[cd.key]||0) > 0);

  return (
    <div style={{
      background:COLORS.card,
      border:`1px solid ${(cmdDead||isDead) ? COLORS.red+"88" : color+"44"}`,
      borderTop:`3px solid ${cmdDead||isDead ? COLORS.red : color}`,
      borderRadius:12, overflow:"hidden",
      boxShadow:(isDead||cmdDead) ? `0 0 20px ${COLORS.red}33` : `0 2px 12px ${color}22`,
      transition:"all 0.2s",
    }}>
      {/* Name bar */}
      <div style={{ background:color+"18", padding:"7px 12px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"relative" }}>
        <div style={{ display:"flex", alignItems:"center", gap:7, flex:1, minWidth:0 }}>
          {/* Color swatch / picker toggle */}
          <div style={{ position:"relative", flexShrink:0 }}>
            <button onClick={() => setShowColorPicker(v => !v)} style={{
              width:18, height:18, borderRadius:"50%", background:color,
              border:`2px solid ${showColorPicker ? "#fff" : color+"88"}`,
              cursor:"pointer", flexShrink:0, boxShadow:`0 0 6px ${color}88`,
            }}/>
            {showColorPicker && (
              <div style={{
                position:"absolute", top:24, left:0, zIndex:30,
                background:COLORS.surface, border:`1px solid ${COLORS.border}`,
                borderRadius:10, padding:8, display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:5,
                boxShadow:"0 4px 20px rgba(0,0,0,0.6)",
                minWidth:86,
              }}>
                {ALL_PLAYER_COLORS.map(c => (
                  <button key={c.id} onClick={() => { onColorChange(c.id); setShowColorPicker(false); }} title={c.label} style={{
                    width:24, height:24, borderRadius:"50%", background:c.hex,
                    border:`2px solid ${player.colorId===c.id ? "#fff" : "transparent"}`,
                    cursor:"pointer", boxShadow: player.colorId===c.id ? `0 0 8px ${c.hex}` : "none",
                  }}/>
                ))}
              </div>
            )}
          </div>
          {editingName ? (
            <input autoFocus value={tempName}
              onChange={e => onTempNameChange(e.target.value)}
              onBlur={onNameSave}
              onKeyDown={e => e.key==="Enter" && onNameSave()}
              style={{ background:"none", border:"none", borderBottom:`1px solid ${color}`, color:COLORS.text, fontFamily:"inherit", fontSize:13, flex:1, outline:"none", padding:"2px 0" }}
            />
          ) : (
            <span onClick={onNameEdit} style={{ fontSize:13, color, cursor:"pointer", letterSpacing:0.5, fontWeight:"bold", flex:1 }}>{player.name}</span>
          )}
        </div>
        <div style={{ display:"flex", gap:6, alignItems:"center", flexShrink:0 }}>
          <span style={{
            fontSize:11, letterSpacing:1, textTransform:"uppercase",
            color:isDead ? COLORS.red : cmdDead ? COLORS.red : isLow ? COLORS.tap : COLORS.muted,
            fontWeight:"bold",
          }}>{isDead?"☠ Dead":cmdDead?"☠ Cmd":isLow?"⚠ Low":""}</span>
          {canRemove && (
            <button onClick={onRemove} style={{
              background:"none", border:"none", color:COLORS.muted,
              cursor:"pointer", fontSize:14, padding:"0 2px", lineHeight:1,
            }}>×</button>
          )}
        </div>
      </div>

      {/* Life total */}
      <div style={{ textAlign:"center", padding: isSolo ? "28px 8px" : "14px 8px 10px" }}>
        <div style={{
          fontSize: isSolo ? 120 : 68, fontWeight:"bold", lineHeight:1,
          color: isDead ? COLORS.red : isLow ? COLORS.tap : color,
          transition:"color 0.3s",
          textShadow:`0 0 40px ${isDead ? COLORS.red : color}44`,
        }}>{player.life}</div>
        {activeCounters.length > 0 && (
          <div style={{ display:"flex", justifyContent:"center", gap:6, marginTop:8, flexWrap:"wrap" }}>
            {activeCounters.map(cd => (
              <span key={cd.key} style={{ fontSize:13, padding:"2px 8px", borderRadius:10, background:cd.accent+"22", border:`1px solid ${cd.accent}55`, color:cd.accent }}>
                {cd.icon} {player[cd.key]}
              </span>
            ))}
          </div>
        )}
        {/* Per-commander damage summary badges */}
        {isSolo && (player.commanders||[]).filter(c => (c.damage||0) > 0).map(cmd => (
          <div key={cmd.id} style={{ marginTop:3 }}>
            <span style={{
              fontSize:12, padding:"2px 8px", borderRadius:10,
              background: (cmd.damage>=21) ? COLORS.red+"33" : "#ffffff0a",
              border:`1px solid ${(cmd.damage>=21) ? COLORS.red+"66" : COLORS.border}`,
              color: cmd.damage>=21 ? COLORS.red : COLORS.muted,
            }}>⚔ {cmd.name}: {cmd.damage}</span>
          </div>
        ))}
        {!isSolo && allPlayers.filter(p => p.id!==player.id && (player.cmdDamage[p.id]||0) > 0).map(src => {
          const dmg = player.cmdDamage[src.id]||0;
          const srcColor = getColor(src);
          return (
            <div key={src.id} style={{ marginTop:3 }}>
              <span style={{
                fontSize:12, padding:"2px 8px", borderRadius:10,
                background: dmg>=21 ? COLORS.red+"33" : "#ffffff0a",
                border:`1px solid ${dmg>=21 ? COLORS.red+"66" : srcColor+"44"}`,
                color: dmg>=21 ? COLORS.red : srcColor,
              }}>⚔ {src.name}: {dmg}</span>
            </div>
          );
        })}
      </div>

      {/* Life controls */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", borderTop:`1px solid ${COLORS.border}` }}>
        {[-5,-1,+1,+5].map(delta => (
          <button key={delta} onClick={() => onLifeChange(delta)} style={{
            padding: isSolo ? "18px 0" : "11px 0",
            background: delta<0 ? COLORS.red+"18" : color+"18",
            border:"none", borderRight: delta!==5 ? `1px solid ${COLORS.border}` : "none",
            color: delta<0 ? COLORS.red : color,
            fontSize: isSolo ? 18 : 14, fontWeight:"bold",
            cursor:"pointer", fontFamily:"inherit", transition:"background 0.1s",
          }}>{delta>0 ? `+${delta}` : delta}</button>
        ))}
      </div>

      {/* Expand toggles */}
      <div style={{ display:"flex", borderTop:`1px solid ${COLORS.border}` }}>
        <button onClick={() => setExpanded(e => e==="cmd" ? null : "cmd")} style={{
          flex:1, padding:"7px 0",
          background: expanded==="cmd" ? COLORS.red+"22" : "#ffffff06",
          border:"none", borderRight:`1px solid ${COLORS.border}`,
          color: expanded==="cmd" ? COLORS.red : cmdDead ? COLORS.red : COLORS.muted,
          fontSize:13, cursor:"pointer", fontFamily:"inherit", letterSpacing:0.5,
          fontWeight: cmdDead ? "bold" : "normal",
        }}>⚔ Commander {expanded==="cmd" ? "▴" : "▾"}</button>
        <button onClick={() => setExpanded(e => e==="counters" ? null : "counters")} style={{
          flex:1, padding:"7px 0",
          background: expanded==="counters" ? color+"22" : "#ffffff06",
          border:"none",
          color: expanded==="counters" ? color : COLORS.muted,
          fontSize:13, cursor:"pointer", fontFamily:"inherit", letterSpacing:0.5,
        }}>⬡ Counters {expanded==="counters" ? "▴" : "▾"}</button>
      </div>

      {/* Commander panel */}
      {expanded==="cmd" && (
        <div style={{ padding:"10px 12px", borderTop:`1px solid ${COLORS.border}`, background:"#0d1018" }}>
          {/* Add commander input */}
          <div style={{ display:"flex", gap:6, marginBottom:10 }}>
            <input
              value={cmdInput}
              onChange={e => setCmdInput(e.target.value)}
              onKeyDown={e => {
                if (e.key==="Enter" && cmdInput.trim()) {
                  onCommanderUpdate([...(player.commanders||[]), { id:Date.now(), name:cmdInput.trim(), damage:0 }]);
                  setCmdInput("");
                }
              }}
              placeholder="Add commander name…"
              style={{
                flex:1, background:COLORS.card, border:`1px solid ${COLORS.border}`,
                borderRadius:8, padding:"7px 10px", color:COLORS.text,
                fontFamily:"inherit", fontSize:12, outline:"none",
              }}
            />
            <button
              onClick={() => {
                if (!cmdInput.trim()) return;
                onCommanderUpdate([...(player.commanders||[]), { id:Date.now(), name:cmdInput.trim(), damage:0 }]);
                setCmdInput("");
              }}
              style={{
                padding:"7px 14px", borderRadius:8, fontSize:12,
                background:color+"33", border:`1px solid ${color}55`,
                color, cursor:"pointer", fontFamily:"inherit",
              }}>+ Add</button>
          </div>

          {/* Solo: named commanders with damage tracking */}
          {isSolo && (player.commanders||[]).map(cmd => {
            const lethal = cmd.damage >= 21;
            return (
              <div key={cmd.id} style={{
                display:"flex", alignItems:"center", gap:8, marginBottom:6,
                padding:"6px 10px", borderRadius:8,
                background: lethal ? COLORS.red+"22" : "#ffffff06",
                border:`1px solid ${lethal ? COLORS.red+"55" : COLORS.border}`,
              }}>
                <span style={{ fontSize:13 }}>⚔</span>
                <span style={{ flex:1, fontSize:13, color:COLORS.text }}>{cmd.name}</span>
                <button onClick={() => onCommanderUpdate((player.commanders||[]).map(c => c.id===cmd.id ? {...c, damage:Math.max(0,c.damage-1)} : c))}
                  style={{ width:26, height:26, borderRadius:6, background:COLORS.red+"22", border:`1px solid ${COLORS.red}44`, color:COLORS.red, fontSize:14, cursor:"pointer", fontFamily:"inherit" }}>−</button>
                <span style={{ fontSize:16, fontWeight:"bold", minWidth:26, textAlign:"center", color: lethal ? COLORS.red : color }}>{cmd.damage}</span>
                <button onClick={() => onCommanderUpdate((player.commanders||[]).map(c => c.id===cmd.id ? {...c, damage:c.damage+1} : c))}
                  style={{ width:26, height:26, borderRadius:6, background:color+"22", border:`1px solid ${color}44`, color, fontSize:14, cursor:"pointer", fontFamily:"inherit" }}>+</button>
                <button onClick={() => onCommanderUpdate((player.commanders||[]).filter(c => c.id!==cmd.id))}
                  style={{ background:"none", border:"none", color:COLORS.muted, cursor:"pointer", fontSize:14, padding:"0 2px" }}>×</button>
              </div>
            );
          })}
          {isSolo && (player.commanders||[]).length===0 && (
            <div style={{ fontSize:13, color:COLORS.muted, fontStyle:"italic", textAlign:"center", padding:"6px 0" }}>No commanders added</div>
          )}

          {/* Multiplayer: opponent players + optional named commanders */}
          {!isSolo && allPlayers.filter(src => src.id !== player.id).map(src => {
            const dmg = player.cmdDamage[src.id] || 0;
            const lethal = dmg >= 21;
            const srcColor = getColor(src);
            return (
              <div key={src.id} style={{
                display:"flex", alignItems:"center", gap:8, marginBottom:6,
                padding:"6px 10px", borderRadius:8,
                background: lethal ? COLORS.red+"22" : "#ffffff06",
                border:`1px solid ${lethal ? COLORS.red+"55" : COLORS.border}`,
              }}>
                <div style={{ width:7, height:7, borderRadius:"50%", background:srcColor, flexShrink:0 }} />
                <span style={{ flex:1, fontSize:13, color:COLORS.text }}>{src.name}</span>
                <button onClick={() => onCmdAdjust(src.id,-1)} style={{ width:26, height:26, borderRadius:6, background:COLORS.red+"22", border:`1px solid ${COLORS.red}44`, color:COLORS.red, fontSize:14, cursor:"pointer", fontFamily:"inherit" }}>−</button>
                <span style={{ fontSize:16, fontWeight:"bold", minWidth:26, textAlign:"center", color: lethal ? COLORS.red : srcColor }}>{dmg}</span>
                <button onClick={() => onCmdAdjust(src.id,+1)} style={{ width:26, height:26, borderRadius:6, background:srcColor+"22", border:`1px solid ${srcColor}44`, color:srcColor, fontSize:14, cursor:"pointer", fontFamily:"inherit" }}>+</button>
              </div>
            );
          })}
          {/* Extra named commanders in multiplayer */}
          {!isSolo && (player.commanders||[]).map(cmd => {
            const lethal = cmd.damage >= 21;
            return (
              <div key={cmd.id} style={{
                display:"flex", alignItems:"center", gap:8, marginBottom:6,
                padding:"6px 10px", borderRadius:8,
                background: lethal ? COLORS.red+"22" : "#ffffff06",
                border:`1px solid ${lethal ? COLORS.red+"44" : COLORS.border}`,
              }}>
                <span style={{ fontSize:12 }}>⚔</span>
                <span style={{ flex:1, fontSize:13, color:COLORS.text, fontStyle:"italic" }}>{cmd.name}</span>
                <button onClick={() => onCommanderUpdate((player.commanders||[]).map(c => c.id===cmd.id ? {...c, damage:Math.max(0,c.damage-1)} : c))}
                  style={{ width:26, height:26, borderRadius:6, background:COLORS.red+"22", border:`1px solid ${COLORS.red}44`, color:COLORS.red, fontSize:14, cursor:"pointer", fontFamily:"inherit" }}>−</button>
                <span style={{ fontSize:16, fontWeight:"bold", minWidth:26, textAlign:"center", color: lethal ? COLORS.red : color }}>{cmd.damage}</span>
                <button onClick={() => onCommanderUpdate((player.commanders||[]).map(c => c.id===cmd.id ? {...c, damage:c.damage+1} : c))}
                  style={{ width:26, height:26, borderRadius:6, background:color+"22", border:`1px solid ${color}44`, color, fontSize:14, cursor:"pointer", fontFamily:"inherit" }}>+</button>
                <button onClick={() => onCommanderUpdate((player.commanders||[]).filter(c => c.id!==cmd.id))}
                  style={{ background:"none", border:"none", color:COLORS.muted, cursor:"pointer", fontSize:14, padding:"0 2px" }}>×</button>
              </div>
            );
          })}
        </div>
      )}

      {/* Counters panel — add/remove style */}
      {expanded==="counters" && (() => {
        const activeKeys = COUNTER_DEFS.filter(cd => (player[cd.key]||0) > 0).map(cd => cd.key);
        const inactiveOptions = COUNTER_DEFS.filter(cd => (player[cd.key]||0) === 0);
        return (
          <div style={{ padding:"10px 12px", borderTop:`1px solid ${COLORS.border}`, background:"#0d1018" }}>
            {/* Active counters */}
            {COUNTER_DEFS.filter(cd => (player[cd.key]||0) > 0).map(({ key, icon, label, accent, lethal }) => {
              const val = player[key] || 0;
              const isLethal = lethal && val >= lethal;
              return (
                <div key={key} style={{
                  display:"flex", alignItems:"center", gap:8, marginBottom:7,
                  padding:"7px 10px", borderRadius:8,
                  background: isLethal ? accent+"22" : "#ffffff06",
                  border:`1px solid ${isLethal ? accent+"88" : COLORS.border}`,
                }}>
                  <span style={{ fontSize:16, color:accent }}>{icon}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:11, color:COLORS.muted, letterSpacing:1, textTransform:"uppercase" }}>{label}{isLethal ? " ⚠" : ""}</div>
                    <div style={{ fontSize:20, fontWeight:"bold", color: isLethal ? accent : COLORS.text, lineHeight:1.1 }}>{val}</div>
                  </div>
                  <button onClick={() => onCounterUpdate({ [key]: val+1 })} style={{ width:28, height:28, borderRadius:6, fontSize:16, background:accent+"22", border:`1px solid ${accent}44`, color:accent, cursor:"pointer", fontFamily:"inherit" }}>+</button>
                  <button onClick={() => onCounterUpdate({ [key]: Math.max(0,val-1) })} style={{ width:28, height:28, borderRadius:6, fontSize:16, background:COLORS.red+"22", border:`1px solid ${COLORS.red}44`, color:COLORS.red, cursor:"pointer", fontFamily:"inherit" }}>−</button>
                  <button onClick={() => onCounterUpdate({ [key]: 0 })} style={{ background:"none", border:"none", color:COLORS.muted, cursor:"pointer", fontSize:15, padding:"0 2px" }}>×</button>
                </div>
              );
            })}
            {/* Add counter dropdown */}
            {inactiveOptions.length > 0 && (
              <div style={{ display:"flex", gap:6, alignItems:"center", marginTop: activeKeys.length>0 ? 4 : 0 }}>
                <select
                  defaultValue=""
                  onChange={e => {
                    if (!e.target.value) return;
                    onCounterUpdate({ [e.target.value]: 1 });
                    e.target.value = "";
                  }}
                  style={{
                    flex:1, background:COLORS.card, border:`1px solid ${COLORS.border}`,
                    borderRadius:8, padding:"7px 10px", color:COLORS.text,
                    fontFamily:"inherit", fontSize:13, outline:"none", cursor:"pointer",
                    appearance:"none", WebkitAppearance:"none",
                  }}>
                  <option value="" disabled>Add counter…</option>
                  {inactiveOptions.map(cd => (
                    <option key={cd.key} value={cd.key}>{cd.icon} {cd.label}{cd.lethal ? ` (lethal @ ${cd.lethal})` : ""}</option>
                  ))}
                </select>
              </div>
            )}
            {activeKeys.length===0 && inactiveOptions.length===0 && (
              <div style={{ fontSize:13, color:COLORS.muted, fontStyle:"italic", textAlign:"center", padding:"4px 0" }}>All counters active</div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

// ── Dice / Coin Modal ─────────────────────────────────────────────────────────
const DICE = [
  { label:"d4",  sides:4,  icon:"△", color:"#e87a3a" },
  { label:"d6",  sides:6,  icon:"⬡", color:"#4a90d9" },
  { label:"d8",  sides:8,  icon:"◇", color:"#9a7abf" },
  { label:"d10", sides:10, icon:"⬠", color:"#d95540" },
  { label:"d12", sides:12, icon:"⬠", color:"#4aaa6a" },
  { label:"d20", sides:20, icon:"⬡", color:"#c9a84c" },
];

// ── Rulings Sheet ──────────────────────────────────────────────────────────────
function RulingsSheet({ onClose, closing, tokens, playersRef }) {
  const [messages, setMessages] = useState([]); // [{role, text}]
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const scrollRef = useRef(null);

  const scrollToBottom = () => {
    setTimeout(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, 40);
  };

  // Build battlefield context string from live state
  const buildContext = () => {
    const players = playersRef ? playersRef.current : [];
    let ctx = "";

    if (players.length > 0) {
      ctx += "=== PLAYERS ===\n";
      players.forEach(p => {
        ctx += `${p.name}: ${p.life} life`;
        if (p.poison > 0)  ctx += `, ${p.poison} poison`;
        if (p.energy > 0)  ctx += `, ${p.energy} energy`;
        const cmdEntries = Object.entries(p.cmdDamage || {}).filter(([,v]) => v > 0);
        if (cmdEntries.length > 0) ctx += `, cmd dmg received: ${cmdEntries.map(([k,v]) => `${v} from player ${k}`).join(", ")}`;
        ctx += "\n";
      });
    }

    if (tokens.length > 0) {
      ctx += "\n=== BATTLEFIELD TOKENS ===\n";
      tokens.forEach(tok => {
        const name = tok.type === "Custom…" ? (tok.customType || "Custom") : tok.type;
        let line = `${tok.quantity}x ${name}`;
        if (tok.isCreature || tok.category === "creature") {
          const pow = tok.basePower + tok.powerMod + tok.eotPowerMod;
          const tou = tok.baseToughness + tok.toughnessMod + tok.eotToughnessMod;
          line += ` (${pow}/${tou})`;
        }
        if (tok.tappedCount > 0) line += ` [${tok.tappedCount} tapped]`;
        if (tok.keywords && tok.keywords.length > 0) line += ` — ${tok.keywords.join(", ")}`;
        if (tok.counters && tok.counters.length > 0) line += ` — counters: ${tok.counters.map(c => `${c.type}×${c.count}`).join(", ")}`;
        if (tok.abilityText) line += `\n  Abilities: ${tok.abilityText}`;
        ctx += line + "\n";
      });
    }

    return ctx.trim();
  };

  const send = () => {
    const q = input.trim();
    if (!q || loading) return;
    setInput("");

    const userMsg = { role: "user", text: q };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    scrollToBottom();

    const context = buildContext();
    const systemPrompt = `You are an expert Magic: The Gathering rules advisor with deep knowledge of the Comprehensive Rules, card interactions, priority, the stack, and judge rulings. Answer questions clearly and concisely. Cite specific rules numbers when relevant. If a ruling is complex or edge-case, acknowledge uncertainty and recommend consulting a judge.

${context ? `The player is currently in a game with this battlefield state:\n${context}\n\nUse this context to give more relevant rulings advice when applicable.` : "No active battlefield state provided."}

Always end your response with a brief disclaimer if the ruling is non-obvious.`;

    // Build message history for multi-turn context (last 6 exchanges)
    const history = [];
    const recent = messages.slice(-6);
    recent.forEach(m => history.push({ role: m.role === "user" ? "user" : "assistant", content: m.text }));
    history.push({ role: "user", content: q });

    fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: systemPrompt,
        messages: history,
      }),
    })
      .then(r => r.json())
      .then(data => {
        const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("") || "Sorry, I couldn't get a response. Please try again.";
        setMessages(prev => [...prev, { role: "assistant", text }]);
        setLoading(false);
        scrollToBottom();
      })
      .catch(() => {
        setMessages(prev => [...prev, { role: "assistant", text: "Connection error — please check your network and try again." }]);
        setLoading(false);
        scrollToBottom();
      });
  };

  const handleKey = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } };

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(0,0,0,0.65)",
      display: "flex", alignItems: "flex-end", justifyContent: "center",
      animation: "fadeIn 0.2s ease",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "100%", maxWidth: 520,
        background: COLORS.surface,
        borderRadius: "20px 20px 0 0",
        border: `1px solid ${COLORS.border}`, borderBottom: "none",
        boxShadow: "0 -8px 40px rgba(0,0,0,0.7)",
        height: "78vh",
        display: "flex", flexDirection: "column",
        animation: closing
          ? "modalSlideDown 0.32s cubic-bezier(0.4,0,0.2,1) forwards"
          : "modalSlideUp 0.32s cubic-bezier(0.4,0,0.2,1) forwards",
      }}>
        {/* Drag pill */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: COLORS.border, margin: "14px auto 6px", flexShrink: 0 }} />

        {/* Header */}
        <div style={{
          padding: "6px 16px 12px", borderBottom: `1px solid ${COLORS.border}`,
          display: "flex", alignItems: "center", flexShrink: 0,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, letterSpacing: 3, color: COLORS.eot, textTransform: "uppercase" }}>⚖ MTG Rules Advisor</div>
            <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 2 }}>
              {tokens.length > 0 || (playersRef && playersRef.current.length > 0)
                ? `Battlefield context active · ${tokens.length} token type${tokens.length !== 1 ? "s" : ""}`
                : "Ask any rules question"}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "#ffffff0a", border: `1px solid ${COLORS.border}`,
            color: COLORS.muted, borderRadius: 8, padding: "5px 10px",
            fontSize: 13, cursor: "pointer", fontFamily: "inherit",
          }}>✕</button>
        </div>

        {/* Message history */}
        <div ref={scrollRef} style={{
          flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch",
          padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10,
        }}>
          {messages.length === 0 && (
            <div style={{ textAlign: "center", padding: "30px 20px", color: COLORS.muted }}>
              <div style={{ fontSize: 32, marginBottom: 10, opacity: 0.4 }}>⚖</div>
              <div style={{ fontSize: 13, lineHeight: 1.7 }}>
                Ask about card interactions, priority,<br/>the stack, triggered abilities, and more.
              </div>
              <div style={{ fontSize: 11, marginTop: 12, color: COLORS.border, lineHeight: 1.6 }}>
                Your current battlefield state is included<br/>automatically for context.
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} style={{
              display: "flex",
              justifyContent: m.role === "user" ? "flex-end" : "flex-start",
            }}>
              <div style={{
                maxWidth: "88%",
                padding: "9px 13px",
                borderRadius: m.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                background: m.role === "user" ? COLORS.eot + "28" : "#ffffff0d",
                border: `1px solid ${m.role === "user" ? COLORS.eot + "55" : COLORS.border}`,
                fontSize: 13, lineHeight: 1.6, color: COLORS.text,
                whiteSpace: "pre-wrap",
              }}>
                {m.text}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <div style={{
                padding: "10px 16px", borderRadius: "14px 14px 14px 4px",
                background: "#ffffff0d", border: `1px solid ${COLORS.border}`,
                color: COLORS.muted, fontSize: 13,
              }}>
                <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</span> Consulting the rules…
              </div>
            </div>
          )}
        </div>

        {/* Input row */}
        <div style={{
          padding: "10px 12px 28px", borderTop: `1px solid ${COLORS.border}`,
          display: "flex", gap: 8, flexShrink: 0,
          background: COLORS.surface,
        }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask a rules question…"
            rows={2}
            style={{
              flex: 1, background: "#ffffff0a",
              border: `1px solid ${COLORS.border}`, borderRadius: 10,
              color: COLORS.text, fontFamily: "inherit", fontSize: 13,
              padding: "8px 10px", resize: "none",
              outline: "none", lineHeight: 1.5,
            }}
          />
          <button onClick={send} disabled={!input.trim() || loading} style={{
            ...smallBtn(COLORS.eot),
            padding: "0 16px", fontSize: 18, alignSelf: "stretch",
            opacity: !input.trim() || loading ? 0.4 : 1,
            borderRadius: 10,
          }}>↑</button>
        </div>
      </div>
    </div>
  );
}

function DiceModal({ onClose, closing }) {
  const [rolling, setRolling] = useState(null);
  const [phase, setPhase]     = useState("idle"); // "idle"|"rolling"|"result"
  const [result, setResult]   = useState(null);

  // Start a roll immediately — works from idle OR result state
  const doRoll = (die) => {
    setResult(null); setRolling(die.label); setPhase("rolling");
    setTimeout(() => {
      const val = Math.floor(Math.random() * die.sides) + 1;
      setResult({ type:"die", sides:die.sides, value:val, label:die.label, die });
      setPhase("result"); setRolling(null);
    }, 920);
  };

  const doFlip = () => {
    setResult(null); setRolling("coin"); setPhase("rolling");
    const isHeads = Math.random() < 0.5;
    setTimeout(() => {
      setResult({ type:"coin", value: isHeads ? "Heads" : "Tails", isHeads });
      setPhase("result"); setRolling(null);
    }, 900);
  };

  // Seamless replay: if currently showing result, start new roll immediately (no reset step)
  const roll     = (die) => { if (phase !== "rolling") doRoll(die); };
  const flipCoin = ()    => { if (phase !== "rolling") doFlip(); };
  const reset    = ()    => { setPhase("idle"); setResult(null); setRolling(null); };

  return (
    <div onClick={onClose} style={{
      position:"fixed", inset:0, zIndex:100,
      background:"rgba(0,0,0,0.6)", backdropFilter:"blur(4px)",
      display:"flex", alignItems:"flex-end", justifyContent:"center",
      animation:"fadeIn 0.2s ease",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width:"100%", maxWidth:480,
        background:COLORS.surface, borderRadius:"20px 20px 0 0",
        border:`1px solid ${COLORS.border}`, borderBottom:"none",
        padding:"20px 16px 36px",
        boxShadow:"0 -8px 40px rgba(0,0,0,0.6)",
        animation: closing
          ? "modalSlideDown 0.32s cubic-bezier(0.4,0,0.2,1) forwards"
          : "modalSlideUp 0.32s cubic-bezier(0.4,0,0.2,1) forwards",
      }}>
        <div style={{ width:36, height:4, borderRadius:2, background:COLORS.border, margin:"0 auto 18px" }}/>
        <div style={{ textAlign:"center", marginBottom:14 }}>
          <div style={{ fontSize:13, letterSpacing:3, color:COLORS.gold, textTransform:"uppercase" }}>🎲 Dice & Coin</div>
        </div>

        {/* Result stage */}
        <div style={{ minHeight:110, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", marginBottom:14, perspective:"400px" }}>
          {/* Dice rolling */}
          {phase==="rolling" && rolling && rolling!=="coin" && (() => {
            const die = DICE.find(d => d.label===rolling);
            return (
              <div style={{ animation:"diceRoll 0.92s cubic-bezier(0.2,0,0.8,1) forwards" }}>
                <span style={{ fontSize:72, color:die.color, filter:`drop-shadow(0 0 16px ${die.color}) drop-shadow(0 0 32px ${die.color}88)`, display:"block", lineHeight:1 }}>{die.icon}</span>
              </div>
            );
          })()}

          {/* Coin flip */}
          {phase==="rolling" && rolling==="coin" && (
            <div style={{ animation:"coinFlip 0.9s ease forwards", display:"inline-block" }}>
              <span style={{ fontSize:72, display:"block", lineHeight:1 }}>🪙</span>
            </div>
          )}

          {/* Dice result */}
          {phase==="result" && result?.type==="die" && (
            <div style={{ textAlign:"center", animation:"resultPop 0.3s ease forwards" }}>
              <span style={{ fontSize:52, color:result.die.color, filter:`drop-shadow(0 0 14px ${result.die.color})`, display:"block", lineHeight:1, marginBottom:4 }}>{result.die.icon}</span>
              <div style={{ fontSize:52, fontWeight:"bold", color:result.die.color, textShadow:`0 0 24px ${result.die.color}cc`, lineHeight:1 }}>{result.value}</div>
              <div style={{ fontSize:12, color:COLORS.muted, letterSpacing:1, marginTop:4 }}>{result.label} · 1–{result.sides}</div>
              {result.value===result.sides && <div style={{ fontSize:13, color:COLORS.gold, marginTop:4 }}>✦ Natural Max!</div>}
              {result.value===1 && result.sides===20 && <div style={{ fontSize:13, color:COLORS.red, marginTop:4 }}>☠ Critical Fail</div>}
            </div>
          )}

          {/* Coin result */}
          {phase==="result" && result?.type==="coin" && (
            <div style={{ textAlign:"center", animation:"resultPop 0.3s ease forwards" }}>
              <div style={{ position:"relative", display:"inline-block", marginBottom:6 }}>
                <span style={{ fontSize:72, display:"block", lineHeight:1 }}>🪙</span>
                {/* Heads/Tails overlay badge */}
                <div style={{
                  position:"absolute", bottom:-4, left:"50%", transform:"translateX(-50%)",
                  background: result.isHeads ? COLORS.gold+"ee" : "#3a2a50ee",
                  border:`1px solid ${result.isHeads ? COLORS.gold : "#7a6aaa"}`,
                  borderRadius:8, padding:"2px 10px",
                  fontSize:11, fontWeight:"bold", letterSpacing:1, textTransform:"uppercase",
                  color: result.isHeads ? "#1a1508" : "#c8b8e8",
                  whiteSpace:"nowrap",
                }}>
                  {result.isHeads ? "H" : "T"}
                </div>
              </div>
              <div style={{ fontSize:22, fontWeight:"bold", color:COLORS.gold, marginTop:8 }}>{result.value}</div>
            </div>
          )}

          {phase==="idle" && (
            <div style={{ fontSize:14, color:COLORS.muted, fontStyle:"italic" }}>Tap a die or the coin to roll</div>
          )}
        </div>

        {/* Tap any card to roll again hint */}
        {phase==="result" && (
          <div style={{ textAlign:"center", marginBottom:8 }}>
            <span style={{ fontSize:12, color:COLORS.muted, fontStyle:"italic", letterSpacing:0.5 }}>Tap any card to roll again</span>
          </div>
        )}

        {/* Dice grid — 3×2 for the 6 dice */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:8 }}>
          {DICE.map(die => (
            <button key={die.label}
              onClick={() => roll(die)}
              disabled={phase==="rolling"}
              style={{
                padding:"12px 0", borderRadius:12, display:"flex", flexDirection:"column",
                alignItems:"center", gap:4,
                background: result?.label===die.label ? die.color+"33" : COLORS.card,
                border:`1px solid ${result?.label===die.label ? die.color : COLORS.border}`,
                cursor: phase==="rolling" ? "default" : "pointer",
                fontFamily:"inherit",
                opacity: phase==="rolling" && rolling!==die.label ? 0.45 : 1,
                transition:"all 0.15s",
              }}>
              <span style={{ fontSize:28, color:die.color, filter:`drop-shadow(0 0 6px ${die.color}88)`, lineHeight:1 }}>{die.icon}</span>
              <span style={{ fontSize:13, fontWeight:"bold", color: result?.label===die.label ? die.color : COLORS.text }}>{die.label}</span>
            </button>
          ))}
        </div>
        {/* Coin — full-width separate row */}
        <button
          onClick={() => flipCoin()}
          disabled={phase==="rolling"}
          style={{
            width:"100%", padding:"12px 0", borderRadius:12, display:"flex",
            flexDirection:"row", alignItems:"center", justifyContent:"center", gap:10,
            background: result?.type==="coin" ? COLORS.gold+"22" : COLORS.card,
            border:`1px solid ${result?.type==="coin" ? COLORS.gold : COLORS.border}`,
            cursor: phase==="rolling" ? "default" : "pointer",
            fontFamily:"inherit", marginBottom:10,
            opacity: phase==="rolling" && rolling!=="coin" ? 0.45 : 1,
            transition:"all 0.15s",
          }}>
          <span style={{ fontSize:28, lineHeight:1 }}>🪙</span>
          <span style={{ fontSize:14, fontWeight:"bold", color: result?.type==="coin" ? COLORS.gold : COLORS.text, letterSpacing:0.5 }}>Coin Flip</span>
        </button>

        <button onClick={onClose} style={{
          width:"100%", padding:"12px", borderRadius:10,
          background:"#ffffff08", border:`1px solid ${COLORS.border}`,
          color:COLORS.muted, cursor:"pointer", fontFamily:"inherit",
          fontSize:13, letterSpacing:0.5,
        }}>Close</button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Token Tracker Screen (existing tracker wrapped) ───────────────────────────
// ══════════════════════════════════════════════════════════════════════════════


function TokenTrackerScreen({ onBack, tokens, setTokens }) {
  const [eotFlash, setEotFlash] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [layout, setLayout] = useState("list");
  const [reorderMode, setReorderMode] = useState(false);
  const [gridSheet, setGridSheet] = useState(null);
  const [gridCols, setGridCols] = useState(2); // 1, 2, or 3

  const removeToken = (id) => setTokens(t => t.filter(tok => tok.id !== id));
  const moveToken = (id, dir) => setTokens(prev => {
    const idx = prev.findIndex(t => t.id === id);
    const next = idx + dir;
    if (next < 0 || next >= prev.length) return prev;
    const arr = prev.slice();
    const tmp = arr[idx]; arr[idx] = arr[next]; arr[next] = tmp;
    return arr;
  });
  const updateToken = useCallback((id, patch) => {
    setTokens(t => t.map(tok => tok.id === id ? { ...tok, ...patch } : tok));
  }, []);
  const addCounter = (id, type) => setTokens(t => t.map(tok => {
    if (tok.id !== id) return tok;
    const existing = tok.counters.find(c => c.type === type);
    if (existing) return { ...tok, counters: tok.counters.map(c => c.type === type ? { ...c, count: c.count + 1 } : c) };
    return { ...tok, counters: [...tok.counters, { type, count: 1 }] };
  }));
  const removeCounter = (id, type) => setTokens(t => t.map(tok => {
    if (tok.id !== id) return tok;
    return { ...tok, counters: tok.counters.map(c => c.type === type ? { ...c, count: c.count - 1 } : c).filter(c => c.count > 0) };
  }));
  const tapOne = (id) => setTokens(t => t.map(tok => tok.id === id ? { ...tok, tappedCount: Math.min(tok.tappedCount + 1, tok.quantity) } : tok));
  const untapOne = (id) => setTokens(t => t.map(tok => tok.id === id ? { ...tok, tappedCount: Math.max(tok.tappedCount - 1, 0) } : tok));
  const untapAll = () => setTokens(t => t.map(tok => ({ ...tok, tappedCount: 0 })));
  const clearAll = () => { setTokens([]); setConfirm(null); };
  const clearArtifacts = () => { setTokens(t => t.filter(tok => !(ARTIFACT_TOKENS.includes(tok.type) && !tok.isCreature))); setConfirm(null); };
  const clearCreatures = () => { setTokens(t => t.filter(tok => ARTIFACT_TOKENS.includes(tok.type) && !tok.isCreature)); setConfirm(null); };
  const endOfTurn = () => {
    setTokens(t => t.map(tok => ({ ...tok, eotPowerMod: 0, eotToughnessMod: 0 })));
    setEotFlash(true);
    setTimeout(() => setEotFlash(false), 600);
  };

  const anyEotMods = tokens.some(t => t.eotPowerMod !== 0 || t.eotToughnessMod !== 0);
  const anyTapped = tokens.some(t => t.tappedCount > 0);
  const totalTokens = tokens.reduce((s, t) => s + t.quantity, 0);
  const displayType = (tok) => ARTIFACT_TOKENS.includes(tok.type) ? tok.type : (tok.type === "Custom…" || !tok.type) ? tok.customType || "Custom" : tok.type;
  const effectivePower = (tok) => tok.basePower + tok.powerMod + tok.eotPowerMod;
  const effectiveToughness = (tok) => tok.baseToughness + tok.toughnessMod + tok.eotToughnessMod;

  return (
    <div style={{
      minHeight: "100vh",
      background: COLORS.bg,
      fontFamily: "'Georgia', 'Times New Roman', serif",
      color: COLORS.text,
      padding: "0 0 120px 0",
    }}>
      {/* Header */}
      <div style={{
        background: `linear-gradient(180deg, #0d1020 0%, ${COLORS.bg} 100%)`,
        borderBottom: `1px solid ${COLORS.border}`,
        padding: "16px 16px 12px",
        position: "sticky", top: 0, zIndex: 10,
        backdropFilter: "blur(8px)",
      }}>
        {/* Back + Title row */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <button onClick={onBack} style={{
            background: "#ffffff0a", border: `1px solid ${COLORS.border}`,
            color: COLORS.gold, borderRadius: 8, padding: "5px 10px",
            fontSize: 13, cursor: "pointer", fontFamily: "inherit",
          }}>‹ Back</button>
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 10, letterSpacing: 4, color: COLORS.gold, textTransform: "uppercase" }}>✦ Battlefield ✦</div>
            <h1 style={{
              margin: 0, fontSize: 20, fontWeight: "bold",
              background: `linear-gradient(135deg, ${COLORS.goldLight}, ${COLORS.gold})`,
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              letterSpacing: 1,
            }}>Token Tracker</h1>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setLayout(l => l === "list" ? "grid" : "list")} style={{
              background: layout === "grid" ? COLORS.gold + "22" : "#ffffff0a",
              border: `1px solid ${layout === "grid" ? COLORS.gold + "88" : COLORS.border}`,
              color: layout === "grid" ? COLORS.gold : COLORS.muted,
              borderRadius: 8, padding: "5px 10px", fontSize: 13,
              cursor: "pointer", fontFamily: "inherit",
              boxShadow: layout === "grid" ? ("0 0 8px " + COLORS.gold + "44") : "none",
              transition: "all 0.15s", width: 60,
            }}>{layout === "grid" ? "⊞ Grid" : "☰ List"}</button>
            <button onClick={() => setReorderMode(r => !r)} style={{
              background: reorderMode ? COLORS.teal + "22" : "#ffffff0a",
              border: `1px solid ${reorderMode ? COLORS.teal + "88" : COLORS.border}`,
              color: reorderMode ? COLORS.teal : COLORS.muted,
              borderRadius: 8, padding: "5px 10px", fontSize: 13,
              cursor: "pointer", fontFamily: "inherit",
              boxShadow: reorderMode ? ("0 0 8px " + COLORS.teal + "44") : "none",
              transition: "all 0.15s",
            }}>⇅</button>
          </div>
        </div>

        {/* Grid size slider — only in grid mode */}
        {layout === "grid" && (
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "6px 4px 2px", marginTop: 4,
          }}>
            <span style={{ fontSize: 10, color: COLORS.muted, letterSpacing: 0.5, flexShrink: 0 }}>⊞</span>
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
              {[1, 2, 3].map(n => (
                <button key={n} onClick={() => setGridCols(n)} style={{
                  flex: 1, padding: "4px 0", borderRadius: 6, fontSize: 11,
                  cursor: "pointer", fontFamily: "inherit",
                  background: gridCols === n ? COLORS.gold + "28" : "#ffffff08",
                  border: `1px solid ${gridCols === n ? COLORS.gold + "99" : COLORS.border}`,
                  color: gridCols === n ? COLORS.gold : COLORS.muted,
                  boxShadow: gridCols === n ? `0 0 7px ${COLORS.gold}44` : "none",
                  transition: "all 0.15s",
                }}>
                  {n === 1 ? "▬" : n === 2 ? "▬▬" : "▬▬▬"}
                </button>
              ))}
            </div>
            <span style={{ fontSize: 10, color: COLORS.muted, letterSpacing: 0.5, minWidth: 28, textAlign: "right" }}>
              {gridCols === 1 ? "Large" : gridCols === 2 ? "Medium" : "Small"}
            </span>
          </div>
        )}

        {/* Action row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
          <button onClick={endOfTurn} style={{
            background: eotFlash ? COLORS.eot + "55" : anyEotMods ? COLORS.eot + "33" : "#ffffff0a",
            border: `1px solid ${eotFlash ? COLORS.eot : anyEotMods ? COLORS.eot + "99" : COLORS.border}`,
            color: anyEotMods || eotFlash ? COLORS.eot : COLORS.muted,
            borderRadius: 20, padding: "5px 16px", fontSize: 12,
            cursor: "pointer", fontFamily: "inherit", letterSpacing: 0.5,
            transition: "all 0.2s ease", fontWeight: anyEotMods ? "bold" : "normal",
          }}>{eotFlash ? "✔ Cleared" : "⏳ End of Turn"}</button>

          {anyTapped && (
            <button onClick={untapAll} style={{
              background: COLORS.teal + "22", border: `1px solid ${COLORS.teal}66`,
              color: COLORS.teal, borderRadius: 20, padding: "5px 14px",
              fontSize: 12, cursor: "pointer", fontFamily: "inherit", letterSpacing: 0.5,
            }}>⟳ Untap All</button>
          )}

          {tokens.length > 0 && (
            <button onClick={() => setConfirm(c => c === "menu" ? null : "menu")} style={{
              background: confirm === "menu" ? COLORS.red + "33" : "#ffffff0a",
              border: `1px solid ${confirm === "menu" ? COLORS.red + "88" : COLORS.border}`,
              color: confirm === "menu" ? COLORS.red : COLORS.muted,
              borderRadius: 20, padding: "5px 14px",
              fontSize: 12, cursor: "pointer", fontFamily: "inherit", letterSpacing: 0.5,
              transition: "all 0.15s",
            }}>✕ Clear {confirm === "menu" ? "▴" : "▾"}</button>
          )}
        </div>

        {confirm === "menu" && (
          <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            {[{ key: "all", label: "All Tokens" }, { key: "artifacts", label: "Artifacts Only" }, { key: "creatures", label: "Creatures Only" }].map(({ key, label }) => (
              <button key={key} onClick={() => setConfirm(key)} style={{
                background: "#ffffff08", border: `1px solid ${COLORS.red}44`,
                color: COLORS.red + "cc", borderRadius: 16, padding: "4px 12px",
                fontSize: 11, cursor: "pointer", fontFamily: "inherit",
              }}>{label}</button>
            ))}
          </div>
        )}

        {["all", "artifacts", "creatures"].includes(confirm) && (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: COLORS.muted }}>
              Remove {confirm === "all" ? "all tokens" : confirm === "artifacts" ? "all artifact tokens" : "all creature tokens"}?
            </span>
            <button onClick={confirm === "all" ? clearAll : confirm === "artifacts" ? clearArtifacts : clearCreatures} style={{
              background: COLORS.red + "44", border: `1px solid ${COLORS.red}`,
              color: COLORS.red, borderRadius: 16, padding: "4px 14px",
              fontSize: 11, cursor: "pointer", fontFamily: "inherit", fontWeight: "bold",
            }}>Confirm</button>
            <button onClick={() => setConfirm("menu")} style={{
              background: "#ffffff0a", border: `1px solid ${COLORS.border}`,
              color: COLORS.muted, borderRadius: 16, padding: "4px 10px",
              fontSize: 11, cursor: "pointer", fontFamily: "inherit",
            }}>Back</button>
          </div>
        )}

        <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 8, textAlign: "center" }}>
          {tokens.length === 0 ? "No tokens in play" : `${totalTokens} token${totalTokens !== 1 ? "s" : ""} · ${tokens.length} type${tokens.length !== 1 ? "s" : ""}`}
        </div>
      </div>

      {/* Token List / Grid */}
      <div style={{ padding: layout === "grid" ? "12px 10px 0" : "12px 12px 0" }}>
        {tokens.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: COLORS.muted, fontSize: 14, lineHeight: 2 }}>
            <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>⚔</div>
            <div>No tokens on the battlefield.</div>
            <div>Tap <span style={{ color: COLORS.gold }}>+ Create Token</span> to begin.</div>
          </div>
        )}

        {layout === "list" && tokens.map((tok, i) => (
          <TokenCard key={tok.id + "-" + i} tok={tok} tokIndex={i} totalTokens={tokens.length} reorderMode={reorderMode}
            displayType={displayType} effectivePower={effectivePower} effectiveToughness={effectiveToughness}
            updateToken={updateToken} addCounter={addCounter} removeCounter={removeCounter}
            tapOne={tapOne} untapOne={untapOne} removeToken={removeToken} moveToken={moveToken}
          />
        ))}

        {layout === "grid" && (
          <div style={{
            display: "grid",
            gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
            gap: gridCols === 3 ? 7 : 10,
          }}>
            {tokens.map((tok, i) => (
              <TokenCardGrid key={tok.id + "-" + i} tok={tok} tokIndex={i} totalTokens={tokens.length} reorderMode={reorderMode}
                gridCols={gridCols} onOpenSheet={() => setGridSheet(tok.id)}
                displayType={displayType} effectivePower={effectivePower} effectiveToughness={effectiveToughness}
                updateToken={updateToken} addCounter={addCounter} removeCounter={removeCounter}
                tapOne={tapOne} untapOne={untapOne} removeToken={removeToken} moveToken={moveToken}
              />
            ))}
          </div>
        )}
      </div>

      {/* Grid card bottom sheet */}
      {gridSheet && (() => {
        const shTok = tokens.find(t => t.id === gridSheet);
        if (!shTok) return null;
        return (
          <GridCardSheet
            tok={shTok}
            onClose={() => setGridSheet(null)}
            displayType={displayType} effectivePower={effectivePower} effectiveToughness={effectiveToughness}
            updateToken={updateToken} addCounter={addCounter} removeCounter={removeCounter}
            tapOne={tapOne} untapOne={untapOne}
            removeToken={(id) => { removeToken(id); setGridSheet(null); }}
          />
        );
      })()}

    </div>
  );
}

// ── Add Token Form ─────────────────────────────────────────────────────────────
function AddTokenForm({ draft, setDraft, onAdd, onCancel, hideHeader=false }) {
  const isArt = draft.category === "artifact";
  const isCopy = draft.category === "copy";
  const showAbilities = draft.category === "creature" || draft.category === "copy";
  const [openSection, setOpenSection] = useState(null);
  const [openSymbolGroup, setOpenSymbolGroup] = useState(null);
  const [abilityEl, setAbilityEl] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [showArtPicker, setShowArtPicker] = useState(false);
  const searchTimer = useRef(null);
  const prevCategory = useRef(draft.category);

  // Clear search when category changes
  if (prevCategory.current !== draft.category) {
    prevCategory.current = draft.category;
    setSearchQuery("");
    setSearchResults([]);
    setSearchError(null);
  }

  const handleSearchChange = (val) => {
    setSearchQuery(val);
    setShowResults(true);
    clearTimeout(searchTimer.current);
    if (val.length < 2) { setSearchResults([]); setSearching(false); return; }
    setSearchError(null);
    setSearching(true);
    searchTimer.current = setTimeout(function() {
      scryfallSearch(val, draft.category).then(function(res) {
        setSearchResults(res.results);
        setSearchError(res.error);
        setSearching(false);
      });
    }, 320);
  };

  const applyToken = (result) => {
    const colors = result.colors.length > 0 ? result.colors.map(sfColorToId) : ["C"];
    const isArtifactResult = result.typeLine.toLowerCase().includes("artifact");
    setDraft(d => ({
      ...d,
      type: result.name,
      customType: "",
      category: isArtifactResult && !result.power ? "artifact" : "creature",
      colors,
      basePower: result.power !== undefined && result.power !== null ? parseInt(result.power) || 0 : d.basePower,
      baseToughness: result.toughness !== undefined && result.toughness !== null ? parseInt(result.toughness) || 0 : d.baseToughness,
      keywords: result.keywords.length > 0 ? result.keywords : d.keywords,
      abilityText: result.oracleText || d.abilityText,
      artUrl: result.artUrl,
      artUrls: result.artUrls,
      scryfallId: result.scryfallId,
    }));
    setSearchQuery(result.name);
    setShowResults(false);
  };

  const toggleSection = (key) => setOpenSection(s => s === key ? null : key);

  const insertAtCursor = (text) => {
    if (!abilityEl) { setDraft(d => ({ ...d, abilityText: d.abilityText + text })); return; }
    const start = abilityEl.selectionStart;
    const end = abilityEl.selectionEnd;
    const next = draft.abilityText.slice(0, start) + text + draft.abilityText.slice(end);
    setDraft(d => ({ ...d, abilityText: next }));
    setTimeout(() => { abilityEl.focus(); abilityEl.setSelectionRange(start + text.length, start + text.length); }, 0);
  };

  const toggleKeyword = (kw) => setDraft(d => ({
    ...d,
    keywords: d.keywords.includes(kw) ? d.keywords.filter(k => k !== kw) : [...d.keywords, kw],
  }));

  const addCustomKeyword = (val) => {
    const trimmed = val.trim();
    if (trimmed && !draft.keywords.includes(trimmed))
      setDraft(d => ({ ...d, keywords: [...d.keywords, trimmed] }));
  };

  const genericSymbols   = MANA_SYMBOLS.filter(s => ["1","2","3","4","5","6","X"].includes(s.label));
  const coloredSymbols   = MANA_SYMBOLS.filter(s => ["W","U","B","R","G","C"].includes(s.label));
  const hybridSymbols    = MANA_SYMBOLS.filter(s => s.label.includes("/") && !s.label.startsWith("P/"));
  const phyrexianSymbols = MANA_SYMBOLS.filter(s => s.label.startsWith("P/"));

  // Summary previews shown on collapsed accordion headers
  const colorPreview = (
    <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
      {(draft.colors || []).length === 0
        ? <span style={{ fontSize: 11, color: COLORS.muted }}>None</span>
        : (draft.colors || []).map(id => {
            const mc = MTG_COLORS.find(c => c.id === id);
            return <div key={id} style={{ width: 12, height: 12, borderRadius: "50%", background: mc?.hex || "#888", border: "1px solid #ffffff33", flexShrink: 0 }} />;
          })
      }
    </div>
  );
  const keywordPreview = draft.keywords.length > 0
    ? <span style={{ fontSize: 11, color: cardAccent(draft.colors) }}>{draft.keywords.slice(0, 3).join(", ")}{draft.keywords.length > 3 ? "…" : ""}</span>
    : <span style={{ fontSize: 11, color: COLORS.muted }}>None</span>;
  const abilityPreview = draft.abilityText
    ? <span style={{ fontSize: 11, color: COLORS.muted, fontStyle: "italic" }}>{draft.abilityText.slice(0, 28)}{draft.abilityText.length > 28 ? "…" : ""}</span>
    : <span style={{ fontSize: 11, color: COLORS.muted }}>None</span>;

  return (
    <div style={hideHeader ? { padding: 0 } : {
      background: "#1a1f2e", border: `1px solid ${COLORS.gold}44`,
      borderRadius: 12, padding: 16, marginBottom: 12,
      boxShadow: `0 0 20px ${COLORS.gold}22`,
    }}>
      {!hideHeader && (
        <div style={{ fontSize: 13, color: COLORS.gold, marginBottom: 12, letterSpacing: 1, textTransform: "uppercase" }}>
          New Token
        </div>
      )}

      {/* Category toggle */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {[
          { key: "creature", label: "⚔ Creature",  color: COLORS.teal,     defaultType: "Saproling", defaultColors: ["G"] },
          { key: "artifact", label: "⚙ Artifact",  color: COLORS.artifact, defaultType: "Treasure",  defaultColors: ["C"] },
          { key: "copy",     label: "✦ Copy",       color: COLORS.eot,      defaultType: "",          defaultColors: []    },
        ].map(({ key, label, color, defaultType, defaultColors }) => (
          <button key={key}
            onClick={() => setDraft(d => ({
              ...d, category: key,
              type: defaultType,
              customType: "",
              colors: defaultColors,
              isCreature: false,
              artUrl: null, artUrls: [], scryfallId: null,
            }))}
            style={{
              flex: 1, padding: "8px",
              background: draft.category === key ? color + "28" : "#ffffff0a",
              border: `1px solid ${draft.category === key ? color + "bb" : COLORS.border}`,
              color: draft.category === key ? color : COLORS.muted,
              borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
              fontSize: 12, letterSpacing: 1, textTransform: "uppercase",
              boxShadow: draft.category === key ? ("0 0 8px " + color + "44") : "none",
              transition: "all 0.15s",
            }}
          >{label}</button>
        ))}
      </div>

      {/* Scryfall search */}
      <Label>{isCopy ? "Card Search" : "Token Search"}</Label>
      <div style={{ position: "relative" }}>
        <input
          value={searchQuery}
          onChange={e => handleSearchChange(e.target.value)}
          onFocus={() => searchQuery.length >= 2 && setShowResults(true)}
          onKeyDown={e => {
            if (e.key === "Enter" && searchQuery.trim() && searchResults.length === 0 && !searching) {
              // Commit typed name as a custom token
              setDraft(d => ({ ...d, type: searchQuery.trim(), customType: searchQuery.trim(), artUrl: null, artUrls: [], scryfallId: null }));
              setShowResults(false);
            }
            if (e.key === "Escape") { setShowResults(false); }
          }}
          placeholder={isArt ? "Search or type artifact name, press Enter" : "Search or type token name, press Enter"}
          style={{ ...inputStyle, paddingRight: 36 }}
        />
        {searching && (
          <span style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", fontSize:12, color:COLORS.muted }}>⏳</span>
        )}
        {!searching && searchQuery && (
          <button onClick={() => { setSearchQuery(""); setSearchResults([]); setShowResults(false); }}
            style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:COLORS.muted, cursor:"pointer", fontSize:14, padding:"2px 4px" }}>✕</button>
        )}
        {/* Results dropdown */}
        {showResults && searchResults.length > 0 && (
          <div style={{
            position:"absolute", top:"calc(100% + 4px)", left:0, right:0, zIndex:200,
            background:COLORS.surface, border:`1px solid ${COLORS.border}`,
            borderRadius:10, boxShadow:"0 8px 24px rgba(0,0,0,0.6)",
            maxHeight:260, overflowY:"auto",
          }}>
            {searchResults.map((r, i) => (
              <button key={i} onClick={() => applyToken(r)} style={{
                width:"100%", display:"flex", alignItems:"center", gap:10,
                padding:"8px 12px", background:"none", border:"none",
                borderBottom: i < searchResults.length-1 ? `1px solid ${COLORS.border}` : "none",
                cursor:"pointer", fontFamily:"inherit", textAlign:"left",
              }}>
                {r.artUrl && (
                  <img src={r.artUrl} alt={r.name} style={{ width:44, height:32, objectFit:"contain", background:COLORS.card, borderRadius:4, flexShrink:0 }} />
                )}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:"bold", color:COLORS.text }}>{r.name}</div>
                  <div style={{ fontSize:11, color:COLORS.muted }}>
                    {r.power !== null && r.power !== undefined ? `${r.power}/${r.toughness} · ` : ""}
                    {r.colors.length > 0 ? r.colors.join("") : "Colorless"}
                    {r.keywords.length > 0 ? ` · ${r.keywords.slice(0,2).join(", ")}` : ""}
                  </div>
                </div>
                {r.artUrls.length > 1 && (
                  <span style={{ fontSize:10, color:COLORS.gold, flexShrink:0 }}>{r.artUrls.length} arts</span>
                )}
              </button>
            ))}
          </div>
        )}
        {showResults && !searching && searchQuery.length >= 2 && searchResults.length === 0 && (
          <div style={{
            position:"absolute", top:"calc(100% + 4px)", left:0, right:0, zIndex:200,
            background:COLORS.surface, border:`1px solid ${searchError ? COLORS.red : COLORS.border}`,
            borderRadius:10, padding:"12px", textAlign:"center",
            fontSize:12, color: searchError ? COLORS.red : COLORS.muted,
          }}>
            {searchError
              ? ("⚠ " + searchError)
              : (<span>No results — press <span style={{ color:COLORS.gold, fontWeight:"bold" }}>Enter</span> to use "{searchQuery}" as token name</span>)
            }
          </div>
        )}
      </div>

      {/* Selected art preview + art picker */}
      {draft.artUrl && (
        <div style={{ marginTop:10, position:"relative" }}>
          <div style={{
            borderRadius:8, overflow:"hidden", position:"relative",
            background:COLORS.card, display:"flex", justifyContent:"center",
          }}>
            <img src={draft.artUrl} alt="Token art" style={{
              width:"100%", maxWidth:340, display:"block",
              objectFit:"contain", objectPosition:"center center",
              borderRadius:8,
            }} />
            <div style={{ position:"absolute", right:8, bottom:8, display:"flex", gap:6 }}>
              {draft.artUrls.length > 1 && (
                <button onClick={() => setShowArtPicker(v => !v)} style={{
                  background:"rgba(0,0,0,0.75)", border:`1px solid ${COLORS.gold}66`,
                  color:COLORS.gold, borderRadius:8, padding:"4px 10px",
                  fontSize:11, cursor:"pointer", fontFamily:"inherit",
                }}>🎨 {showArtPicker ? "Hide" : `${draft.artUrls.length} Arts`}</button>
              )}
            </div>
          </div>
          {showArtPicker && draft.artUrls.length > 1 && (
            <div style={{
              display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:6, marginTop:6,
            }}>
              {draft.artUrls.map((p, i) => (
                <button key={p.id} onClick={() => {
                  setDraft(d => ({ ...d, artUrl: p.artUrl, scryfallId: p.id }));
                  setShowArtPicker(false);
                }} style={{
                  padding:0, border:`2px solid ${draft.scryfallId===p.id ? COLORS.gold : "transparent"}`,
                  borderRadius:6, overflow:"hidden", cursor:"pointer", background:"none",
                  transition:"border-color 0.15s",
                }}>
                  <img src={p.artUrl} alt={p.setName} style={{ width:"100%", height:54, objectFit:"contain", background:COLORS.card, display:"block" }}/>
                  <div style={{ fontSize:9, color:COLORS.muted, padding:"2px 4px", background:COLORS.card, textAlign:"center", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.setName}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}



      {/* Committed token name indicator (custom, no art) */}
      {!draft.artUrl && draft.type && draft.type !== "Saproling" && draft.type !== "Treasure" && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8, marginTop: 10,
          padding: "7px 12px", borderRadius: 8,
          background: COLORS.gold + "18", border: `1px solid ${COLORS.gold}44`,
        }}>
          <span style={{ fontSize: 13, color: COLORS.gold, flex: 1 }}>✦ {draft.type}</span>
          <button onClick={() => { setDraft(d => ({ ...d, type: "Saproling", customType: "" })); setSearchQuery(""); }}
            style={{ background:"none", border:"none", color:COLORS.muted, cursor:"pointer", fontSize:13, padding:"0 2px" }}>✕</button>
        </div>
      )}

      {/* Qty / P/T */}
      {(() => {
        const showPT = !isArt && (!isCopy || (draft.basePower !== null && draft.basePower !== undefined));
        const cols = showPT ? "1fr 1fr 1fr" : "1fr";
        return (
          <div style={{ display: "grid", gridTemplateColumns: cols, gap: 8, marginTop: 8 }}>
            <div><Label>Qty</Label><NumInput value={draft.quantity} min={1} onChange={v => setDraft(d => ({ ...d, quantity: v }))} /></div>
            {showPT && (
              <>
                <div><Label>Power</Label><NumInput value={draft.basePower} onChange={v => setDraft(d => ({ ...d, basePower: v }))} /></div>
                <div><Label>Toughness</Label><NumInput value={draft.baseToughness} onChange={v => setDraft(d => ({ ...d, baseToughness: v }))} /></div>
              </>
            )}
          </div>
        );
      })()}

      {/* ── Accordion sections ── */}
      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>

        {/* COLOR */}
        <Accordion
          label="Card Color"
          preview={colorPreview}
          open={openSection === "color"}
          onToggle={() => toggleSection("color")}
        >
          <div style={{ paddingTop: 10 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
              {MTG_COLORS.map(mc => {
                const active = (draft.colors || []).includes(mc.id);
                return (
                  <button
                    key={mc.id}
                    onClick={() => {
                      if (mc.solo) {
                        setDraft(d => ({ ...d, colors: active ? [] : [mc.id] }));
                      } else {
                        setDraft(d => {
                          const filtered = (d.colors || []).filter(id => {
                            const c = MTG_COLORS.find(x => x.id === id);
                            return !c?.solo;
                          });
                          return {
                            ...d,
                            colors: active
                              ? filtered.filter(id => id !== mc.id)
                              : [...filtered, mc.id],
                          };
                        });
                      }
                    }}
                    title={mc.label}
                    style={{
                      width: 38, height: 38, borderRadius: "50%",
                      background: mc.hex,
                      border: active ? "3px solid white" : "2px solid transparent",
                      cursor: "pointer",
                      boxShadow: active ? `0 0 12px ${mc.hex}` : "none",
                      transition: "all 0.15s",
                      opacity: active ? 1 : 0.45,
                    }}
                  />
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {(draft.colors || []).map(id => {
                const mc = MTG_COLORS.find(c => c.id === id);
                return (
                  <span key={id} style={{
                    fontSize: 11, padding: "2px 8px", borderRadius: 10,
                    background: mc?.hex + "33", border: `1px solid ${mc?.hex}88`,
                    color: mc?.hex,
                  }}>{mc?.label}</span>
                );
              })}
              {(draft.colors || []).length === 0 && (
                <span style={{ fontSize: 11, color: COLORS.muted, fontStyle: "italic" }}>No color selected</span>
              )}
            </div>
          </div>
        </Accordion>

        {/* KEYWORDS — creatures only */}
        {showAbilities && (
          <Accordion
            label="Keywords"
            preview={keywordPreview}
            open={openSection === "keywords"}
            onToggle={() => toggleSection("keywords")}
          >
            <div style={{ paddingTop: 10 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                {EVERGREEN_KEYWORDS.map(kw => {
                  const active = draft.keywords.includes(kw);
                  const ac = cardAccent(draft.colors);
                  return (
                    <button key={kw} onClick={() => toggleKeyword(kw)} style={{
                      padding: "5px 12px", borderRadius: 14, fontSize: 12,
                      background: active ? ac + "44" : "#ffffff0a",
                      border: `1px solid ${active ? ac : COLORS.border}`,
                      color: active ? ac : COLORS.muted,
                      cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
                    }}>{active ? "✔ " : ""}{kw}</button>
                  );
                })}
              </div>
              <CustomKeywordInput onAdd={addCustomKeyword} />
              {draft.keywords.filter(k => !EVERGREEN_KEYWORDS.includes(k)).length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                  {draft.keywords.filter(k => !EVERGREEN_KEYWORDS.includes(k)).map(k => {
                    const ac = cardAccent(draft.colors);
                    return (
                      <span key={k} style={{
                        display: "flex", alignItems: "center", gap: 4,
                        padding: "3px 8px", borderRadius: 12, fontSize: 12,
                        background: ac + "33", border: `1px solid ${ac}88`, color: ac,
                      }}>
                        {k}
                        <button onClick={() => setDraft(d => ({ ...d, keywords: d.keywords.filter(x => x !== k) }))}
                          style={{ background: "none", border: "none", color: COLORS.red, cursor: "pointer", fontSize: 13, padding: 0, lineHeight: 1 }}>×</button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </Accordion>
        )}

        {/* ABILITY TEXT — creatures only */}
        {showAbilities && (
          <Accordion
            label="Ability Text"
            preview={abilityPreview}
            open={openSection === "ability"}
            onToggle={() => toggleSection("ability")}
          >
            <div style={{ paddingTop: 10 }}>
              {/* Nested symbol sub-accordions */}
              <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 10 }}>

                {/* Tap + Generic */}
                <SubAccordion
                  label="{T} + Generic"
                  open={openSymbolGroup === "generic"}
                  onToggle={() => setOpenSymbolGroup(s => s === "generic" ? null : "generic")}
                >
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "8px 0 4px" }}>
                    <button onClick={() => insertAtCursor(TAP_SYMBOL)} style={{
                      width: 34, height: 28, borderRadius: 6, fontSize: 10, fontWeight: "bold",
                      background: COLORS.tap + "33", border: `1px solid ${COLORS.tap}66`,
                      color: COLORS.tap, cursor: "pointer", fontFamily: "inherit",
                    }}>{"{T}"}</button>
                    {genericSymbols.map(s => <ManaBtn key={s.label} s={s} onClick={() => insertAtCursor(s.text)} />)}
                  </div>
                </SubAccordion>

                {/* Colored */}
                <SubAccordion
                  label="Colored"
                  open={openSymbolGroup === "colored"}
                  onToggle={() => setOpenSymbolGroup(s => s === "colored" ? null : "colored")}
                >
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "8px 0 4px" }}>
                    {coloredSymbols.map(s => <ManaBtn key={s.label} s={s} onClick={() => insertAtCursor(s.text)} />)}
                  </div>
                </SubAccordion>

                {/* Hybrid */}
                <SubAccordion
                  label="Hybrid"
                  open={openSymbolGroup === "hybrid"}
                  onToggle={() => setOpenSymbolGroup(s => s === "hybrid" ? null : "hybrid")}
                >
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "8px 0 4px" }}>
                    {hybridSymbols.map(s => <ManaBtn key={s.label} s={s} onClick={() => insertAtCursor(s.text)} />)}
                  </div>
                </SubAccordion>

                {/* Phyrexian */}
                <SubAccordion
                  label="Phyrexian"
                  open={openSymbolGroup === "phyrexian"}
                  onToggle={() => setOpenSymbolGroup(s => s === "phyrexian" ? null : "phyrexian")}
                >
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "8px 0 4px" }}>
                    {phyrexianSymbols.map(s => <ManaBtn key={s.label} s={s} onClick={() => insertAtCursor(s.text)} />)}
                  </div>
                </SubAccordion>

              </div>

              <textarea
                ref={setAbilityEl}
                value={draft.abilityText}
                onChange={e => setDraft(d => ({ ...d, abilityText: e.target.value }))}
                placeholder={"e.g. {T}: Add {G}."}
                rows={3}
                style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6, fontFamily: "'Georgia', serif", fontSize: 13 }}
              />
            </div>
          </Accordion>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button onClick={onAdd} style={btnStyle(COLORS.gold, "#1a1508")}>✦ Add to Battlefield</button>
        {!hideHeader && <button onClick={onCancel} style={btnStyle(COLORS.border, COLORS.surface)}>Cancel</button>}
      </div>
    </div>
  );
}

// ── Accordion row ──────────────────────────────────────────────────────────────
function Accordion({ label, preview, open, onToggle, children }) {
  return (
    <div style={{
      border: `1px solid ${open ? COLORS.gold + "55" : COLORS.border}`,
      borderRadius: 8,
      overflow: "hidden",
      transition: "border-color 0.15s",
    }}>
      <button onClick={onToggle} style={{
        width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "9px 12px", background: open ? COLORS.gold + "0d" : "#ffffff06",
        border: "none", cursor: "pointer", fontFamily: "inherit",
        transition: "background 0.15s",
      }}>
        <span style={{ fontSize: 12, color: open ? COLORS.gold : COLORS.muted, letterSpacing: 0.8, textTransform: "uppercase" }}>
          {label}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {!open && preview}
          <span style={{ color: open ? COLORS.gold : COLORS.muted, fontSize: 12, transition: "transform 0.2s", display: "inline-block", transform: open ? "rotate(180deg)" : "none" }}>▾</span>
        </div>
      </button>
      {open && (
        <div style={{ padding: "0 12px 12px", borderTop: `1px solid ${COLORS.border}` }}>
          {children}
        </div>
      )}
    </div>
  );
}

function CustomKeywordInput({ onAdd }) {
  const [val, setVal] = useState("");
  const submit = () => { onAdd(val); setVal(""); };
  return (
    <div style={{ display: "flex", gap: 6 }}>
      <input
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => e.key === "Enter" && submit()}
        placeholder="Custom keyword…"
        style={{ ...inputStyle, padding: "5px 10px", fontSize: 12 }}
      />
      <button onClick={submit} style={{
        background: COLORS.teal + "22", border: `1px solid ${COLORS.teal}55`,
        color: COLORS.teal, borderRadius: 8, padding: "5px 12px",
        cursor: "pointer", fontFamily: "inherit", fontSize: 12, flexShrink: 0,
      }}>Add</button>
    </div>
  );
}

function ManaBtn({ s, onClick }) {
  return (
    <button onClick={onClick} title={s.text} style={{
      width: 28, height: 28, borderRadius: 14,
      background: s.bg || "#2a3050",
      border: `1px solid ${(s.color || COLORS.text) + "44"}`,
      color: s.color || COLORS.text,
      fontSize: s.label.length > 2 ? 7 : s.label.length > 1 ? 9 : 12,
      fontWeight: "bold",
      cursor: "pointer", fontFamily: "inherit",
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0,
      lineHeight: 1,
    }}>{s.label}</button>
  );
}


// ── Token Card Grid (portrait MTG-card style) ──────────────────────────────────
// ── Grid Card Bottom Sheet ─────────────────────────────────────────────────────
function GridCardSheet({ tok, onClose, displayType, effectivePower, effectiveToughness, updateToken, addCounter, removeCounter, tapOne, untapOne, removeToken }) {
  const [showCounterMenu, setShowCounterMenu] = useState(false);
  const [closing, setClosing] = useState(false);

  const close = () => {
    setClosing(true);
    setTimeout(onClose, 300);
  };

  const accent = cardAccent(tok.colors);
  const gradient = cardGradient(tok.colors);
  const isMulti = (tok.colors || []).length > 1;
  const isArtifactToken = tok.category === "artifact";
  const showPT = !isArtifactToken || tok.isCreature;
  const tapped = tok.tappedCount;
  const hasEotMod = tok.eotPowerMod !== 0 || tok.eotToughnessMod !== 0;
  const name = displayType(tok);

  return (
    <div onClick={close} style={{
      position: "fixed", inset: 0, zIndex: 110,
      background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "flex-end", justifyContent: "center",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "100%", maxWidth: 480,
        background: COLORS.surface,
        borderRadius: "20px 20px 0 0",
        border: `1px solid ${COLORS.border}`, borderBottom: "none",
        boxShadow: "0 -8px 40px rgba(0,0,0,0.7)",
        animation: closing
          ? "modalSlideDown 0.3s cubic-bezier(0.4,0,0.2,1) forwards"
          : "modalSlideUp 0.32s cubic-bezier(0.4,0,0.2,1) forwards",
        maxHeight: "85vh", overflowY: "auto",
      }}>
        {/* Drag pill */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: COLORS.border, margin: "14px auto 0" }} />

        {/* Header — art + name */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "12px 16px 10px",
          borderBottom: `1px solid ${COLORS.border}`,
        }}>
          {tok.artUrl && (
            <div style={{
              width: 52, height: 52, borderRadius: 8, overflow: "hidden", flexShrink: 0,
              border: `1px solid ${accent}55`,
              boxShadow: `0 0 10px ${accent}44`,
            }}>
              <img src={tok.artUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 20%" }} />
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 16, fontWeight: "bold", color: COLORS.text,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>{name}</div>
            <div style={{ display: "flex", gap: 6, marginTop: 4, alignItems: "center", flexWrap: "wrap" }}>
              {(tok.colors || []).map(id => {
                const mc = MTG_COLORS.find(c => c.id === id);
                return <div key={id} style={{
                  width: 9, height: 9, borderRadius: "50%",
                  background: mc?.hex || "#888",
                  boxShadow: `0 0 5px ${mc?.hex || "#888"}88`,
                }} />;
              })}
              {showPT && (
                <span style={{
                  fontSize: 13, fontWeight: "bold", color: hasEotMod ? COLORS.eot : accent,
                  background: (hasEotMod ? COLORS.eot : accent) + "18",
                  padding: "1px 8px", borderRadius: 6,
                  border: `1px solid ${(hasEotMod ? COLORS.eot : accent)}55`,
                }}>
                  {effectivePower(tok)}/{effectiveToughness(tok)}
                </span>
              )}
            </div>
          </div>
          {/* Tap/Untap inline */}
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <button onClick={() => tapOne(tok.id)} disabled={tapped >= tok.quantity} style={{
              ...smallBtn(tapped < tok.quantity ? accent : COLORS.border),
              opacity: tapped < tok.quantity ? 1 : 0.3,
              padding: "6px 10px", fontSize: 15,
            }}>↷</button>
            <button onClick={() => untapOne(tok.id)} disabled={tapped === 0} style={{
              ...smallBtn(tapped > 0 ? accent : COLORS.border),
              opacity: tapped > 0 ? 1 : 0.3,
              padding: "6px 10px", fontSize: 15,
            }}>⟳</button>
          </div>
        </div>

        {/* Controls body */}
        <div style={{ padding: "12px 16px 32px" }}>

          <Row label="Qty">
            <Stepper value={tok.quantity} min={tok.tappedCount + 1}
              onChange={v => updateToken(tok.id, { quantity: v })} color={accent} />
          </Row>

          {isArtifactToken && (
            <Row label="Creature">
              <button onClick={() => updateToken(tok.id, {
                isCreature: !tok.isCreature, basePower: tok.isCreature ? 0 : 1,
                baseToughness: tok.isCreature ? 0 : 1, powerMod: 0, toughnessMod: 0,
                eotPowerMod: 0, eotToughnessMod: 0,
              })} style={{
                background: tok.isCreature ? COLORS.teal + "22" : "#ffffff0a",
                border: `1px solid ${tok.isCreature ? COLORS.teal : COLORS.border}`,
                color: tok.isCreature ? COLORS.teal : COLORS.muted,
                borderRadius: 20, padding: "5px 14px",
                cursor: "pointer", fontFamily: "inherit", fontSize: 12, transition: "all 0.15s",
              }}>{tok.isCreature ? "✔ Creature" : "Animate"}</button>
            </Row>
          )}

          {showPT && (
            <>
              <Row label="Base P/T">
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Stepper value={tok.basePower} onChange={v => updateToken(tok.id, { basePower: v })} color={accent} small />
                  <span style={{ color: COLORS.muted }}>/</span>
                  <Stepper value={tok.baseToughness} onChange={v => updateToken(tok.id, { baseToughness: v })} color={accent} small />
                </div>
              </Row>
              <Row label="Modifier">
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Stepper value={tok.powerMod} onChange={v => updateToken(tok.id, { powerMod: v })} color={accent} small allowNeg />
                  <span style={{ color: COLORS.muted }}>/</span>
                  <Stepper value={tok.toughnessMod} onChange={v => updateToken(tok.id, { toughnessMod: v })} color={accent} small allowNeg />
                </div>
              </Row>
              <div style={{
                margin: "10px 0 8px", padding: "10px 12px",
                background: COLORS.eot + "0e", border: `1px solid ${COLORS.eot}33`, borderRadius: 8,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 11, color: COLORS.eot, letterSpacing: 1, textTransform: "uppercase" }}>⏳ Until EOT</span>
                  {hasEotMod && (
                    <button onClick={() => updateToken(tok.id, { eotPowerMod: 0, eotToughnessMod: 0 })}
                      style={{ ...smallBtn(COLORS.eot), fontSize: 10, padding: "2px 8px" }}>Clear</button>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Stepper value={tok.eotPowerMod} onChange={v => updateToken(tok.id, { eotPowerMod: v })} color={COLORS.eot} small allowNeg />
                  <span style={{ color: COLORS.muted }}>/</span>
                  <Stepper value={tok.eotToughnessMod} onChange={v => updateToken(tok.id, { eotToughnessMod: v })} color={COLORS.eot} small allowNeg />
                </div>
              </div>
            </>
          )}

          {/* Counters */}
          <div style={{ marginTop: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 1 }}>Counters</span>
              <button onClick={() => setShowCounterMenu(m => !m)} style={{ ...smallBtn(COLORS.gold), fontSize: 11 }}>
                + Add Counter
              </button>
            </div>
            {showCounterMenu && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10, padding: 10, background: "#ffffff08", borderRadius: 8 }}>
                {COUNTER_TYPES.map(ct => (
                  <button key={ct} onClick={() => { addCounter(tok.id, ct); setShowCounterMenu(false); }} style={smallBtn(COLORS.teal)}>
                    {ct}
                  </button>
                ))}
              </div>
            )}
            {tok.counters.length === 0 && <div style={{ fontSize: 12, color: COLORS.muted, fontStyle: "italic" }}>No counters</div>}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {tok.counters.map(c => (
                <div key={c.type} style={{
                  display: "flex", alignItems: "center", gap: 5,
                  background: "#ffffff0a", borderRadius: 6, padding: "4px 8px",
                  border: `1px solid ${COLORS.border}`,
                }}>
                  <button onClick={() => removeCounter(tok.id, c.type)} style={{ ...iconBtn, color: COLORS.red }}>−</button>
                  <span style={{ fontSize: 12, color: COLORS.text }}>{c.type}</span>
                  <span style={{ fontSize: 13, color: COLORS.gold, minWidth: 16, textAlign: "center" }}>{c.count}</span>
                  <button onClick={() => addCounter(tok.id, c.type)} style={{ ...iconBtn, color: COLORS.teal }}>+</button>
                </div>
              ))}
            </div>
          </div>

          {/* Ability text */}
          {tok.abilityText && (
            <div style={{
              marginTop: 12, padding: "10px 12px",
              background: "#ffffff06", borderRadius: 8,
              border: `1px solid ${COLORS.border}`,
              fontSize: 12, color: COLORS.muted, fontStyle: "italic", lineHeight: 1.6,
            }}>
              {tok.abilityText}
            </div>
          )}

          {/* Remove */}
          <button onClick={() => removeToken(tok.id)} style={{
            marginTop: 16, width: "100%",
            background: COLORS.red + "22", border: `1px solid ${COLORS.red}88`,
            color: COLORS.red, borderRadius: 8, padding: "10px",
            cursor: "pointer", fontFamily: "inherit", fontSize: 13, letterSpacing: 0.5,
            boxShadow: `0 0 12px ${COLORS.red}44`,
          }}>✕ Remove Token</button>
        </div>
      </div>
    </div>
  );
}

function TokenCardGrid({ tok, tokIndex, totalTokens, reorderMode, gridCols, onOpenSheet, displayType, effectivePower, effectiveToughness, updateToken, addCounter, removeCounter, tapOne, untapOne, removeToken, moveToken }) {
  const [showCounterMenu, setShowCounterMenu] = useState(false);

  // Scale everything based on column count
  const artPct   = gridCols === 1 ? "55%" : gridCols === 2 ? "62%" : "52%";
  const nameFz   = gridCols === 1 ? 15    : gridCols === 2 ? 13    : 11;
  const badgeFz  = gridCols === 1 ? 10    : gridCols === 2 ? 9     : 8;
  const bodyPad  = gridCols === 1 ? "9px 12px 10px" : "7px 10px 8px";
  const ptFz     = gridCols === 1 ? 15    : gridCols === 2 ? 13    : 11;
  const tapBtnSz = gridCols === 3 ? 20    : 26;

  const name = displayType(tok);
  const isArtifactToken = ARTIFACT_TOKENS.includes(tok.type);
  const showPT = !isArtifactToken || tok.isCreature;
  const pow = effectivePower(tok);
  const tou = effectiveToughness(tok);
  const tapped = tok.tappedCount;
  const untapped = tok.quantity - tapped;
  const allTapped = tapped === tok.quantity && tok.quantity > 0;
  const someTapped = tapped > 0;
  const hasEotMod = tok.eotPowerMod !== 0 || tok.eotToughnessMod !== 0;
  const accent = cardAccent(tok.colors);
  const gradient = cardGradient(tok.colors);
  const isMulti = (tok.colors || []).length > 1;
  const borderColor = allTapped ? COLORS.tap : hasEotMod ? COLORS.eot : accent;

  const cardBorderStyle = isMulti && !allTapped && !hasEotMod ? {
    border: `1px solid ${borderColor}44`,
    backgroundImage: `linear-gradient(#1a1f2e, #1a1f2e), ${gradient}`,
    backgroundOrigin: "border-box",
    backgroundClip: "padding-box, border-box",
  } : {
    border: `1px solid ${borderColor}66`,
    borderTop: `3px solid ${borderColor}`,
  };

  return (
    <div style={{
      background: "#1a1f2e",
      borderRadius: 12,
      overflow: "hidden",
      position: "relative",
      opacity: allTapped ? 0.7 : 1,
      transition: "all 0.2s ease",
      boxShadow: reorderMode ? ("0 0 0 2px " + COLORS.teal + "55") : allTapped ? "none" : hasEotMod ? ("0 2px 16px " + COLORS.eot + "44") : ("0 2px 14px " + accent + "33"),
      display: "flex", flexDirection: "column",
      ...cardBorderStyle,
    }}>

      {/* ── Reorder mode overlay ── */}
      {reorderMode && (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", gap: 8,
          padding: "12px 10px",
          minHeight: 90,
        }}>
          <div style={{ fontSize: 12, color: COLORS.text, fontWeight: "bold", textAlign: "center", lineHeight: 1.3 }}>{name}</div>
          <div style={{ fontSize: 10, color: COLORS.muted }}>×{tok.quantity}</div>
          <div style={{ display: "flex", gap: 6, width: "100%" }}>
            <button onClick={() => moveToken(tok.id, -1)} disabled={tokIndex === 0} style={{
              ...smallBtn(tokIndex === 0 ? COLORS.border : COLORS.teal),
              flex: 1, opacity: tokIndex === 0 ? 0.3 : 1,
              fontSize: 16, padding: "6px 4px",
            }}>↑</button>
            <button onClick={() => moveToken(tok.id, 1)} disabled={tokIndex === totalTokens - 1} style={{
              ...smallBtn(tokIndex === totalTokens - 1 ? COLORS.border : COLORS.teal),
              flex: 1, opacity: tokIndex === totalTokens - 1 ? 0.3 : 1,
              fontSize: 16, padding: "6px 4px",
            }}>↓</button>
          </div>
        </div>
      )}

      {/* ── Normal card content ── */}
      {!reorderMode && (<>

      {/* ── Art section (top ~55% of card) ── */}
      <div style={{
        position: "relative",
        width: "100%",
        paddingTop: artPct,
        overflow: "hidden",
        background: COLORS.card,
        flexShrink: 0,
      }}>
        {tok.artUrl ? (
          <>
            <img src={tok.artUrl} alt={name} style={{
              position: "absolute", inset: 0,
              width: "100%", height: "100%",
              objectFit: "cover", objectPosition: "center 20%",
              display: "block",
            }}/>
            {/* Bottom fade into card body */}
            <div style={{
              position: "absolute", inset: 0,
              background: "linear-gradient(to bottom, transparent 45%, rgba(26,31,46,0.7) 80%, #1a1f2e 100%)",
            }}/>
          </>
        ) : (
          /* No art — show color identity placeholder */
          <div style={{
            position: "absolute", inset: 0,
            background: isMulti ? gradient : (accent + "22"),
            display: "flex", alignItems: "center", justifyContent: "center",
            opacity: 0.4,
          }}>
            <span style={{ fontSize: 36, opacity: 0.5 }}>⚔</span>
          </div>
        )}

        {/* Quantity + tap pips overlaid bottom-left of art */}
        <div style={{
          position: "absolute", bottom: 6, left: 8,
          display: "flex", alignItems: "center", gap: 5,
        }}>
          <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
            {Array.from({ length: Math.min(tok.quantity, 8) }).map((_, i) => {
              const isTapped = i >= untapped;
              return (
                <div key={i} style={{
                  width: 5, height: 9, borderRadius: 1,
                  background: isTapped ? COLORS.tap : accent,
                  opacity: isTapped ? 0.7 : 1,
                  transform: isTapped ? "rotate(90deg)" : "none",
                  transition: "all 0.2s",
                  boxShadow: isTapped ? "none" : ("0 0 4px " + accent + "88"),
                }} />
              );
            })}
            {tok.quantity > 8 && <span style={{ fontSize: 9, color: accent }}>+{tok.quantity - 8}</span>}
          </div>
          <span style={{ fontSize: 11, color: COLORS.text, fontWeight: "bold", textShadow: "0 1px 4px #000" }}>
            ×{tok.quantity}
          </span>
        </div>

        {/* Tap/Untap buttons top-right of art */}
        <div style={{
          position: "absolute", top: 5, right: 5,
          display: "flex", flexDirection: "column", gap: 3,
        }}>
          <button onClick={() => tapOne(tok.id)} disabled={tapped >= tok.quantity} style={{
            width: tapBtnSz, height: tapBtnSz - 2, borderRadius: "5px 5px 2px 2px",
            background: "rgba(0,0,0,0.65)",
            border: ("1px solid " + (tapped < tok.quantity ? accent + "99" : COLORS.border + "66")),
            color: tapped < tok.quantity ? accent : COLORS.muted,
            fontSize: gridCols === 3 ? 10 : 12, cursor: tapped < tok.quantity ? "pointer" : "default",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: tapped < tok.quantity ? ("0 0 7px " + accent + "77") : "none",
            transition: "all 0.15s",
          }}>↷</button>
          <button onClick={() => untapOne(tok.id)} disabled={tapped === 0} style={{
            width: tapBtnSz, height: tapBtnSz - 2, borderRadius: "2px 2px 5px 5px",
            background: "rgba(0,0,0,0.65)",
            border: ("1px solid " + (tapped > 0 ? accent + "99" : COLORS.border + "66")),
            color: tapped > 0 ? accent : COLORS.muted,
            fontSize: gridCols === 3 ? 10 : 12, cursor: tapped > 0 ? "pointer" : "default",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: tapped > 0 ? ("0 0 7px " + accent + "77") : "none",
            transition: "all 0.15s",
          }}>⟳</button>
        </div>

        {/* P/T badge overlaid bottom-right of art */}
        {showPT && (
          <div style={{
            position: "absolute", bottom: 6, right: 6,
            background: "rgba(0,0,0,0.75)",
            border: ("1px solid " + (hasEotMod ? COLORS.eot : accent) + "88"),
            borderRadius: 6, padding: "2px 7px",
            fontSize: ptFz, fontWeight: "bold",
            color: hasEotMod ? COLORS.eot : accent,
            boxShadow: "0 0 8px " + (hasEotMod ? COLORS.eot : accent) + "66",
            letterSpacing: 0.5,
          }}>
            {pow}/{tou}
          </div>
        )}
      </div>

      {/* ── Card body (bottom ~45%) ── */}
      <div style={{
        padding: bodyPad,
        display: "flex", flexDirection: "column", gap: 4,
        flex: 1,
        background: "#1a1f2e",
        position: "relative", zIndex: 1,
      }}>
        {/* Name + color pips row */}
        <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
          <span style={{
            fontSize: nameFz, fontWeight: "bold", color: COLORS.text,
            flex: 1, minWidth: 0, overflow: "hidden",
            textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{name}</span>
          {(tok.colors || []).length > 0 && (
            <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
              {tok.colors.map(id => {
                const mc = MTG_COLORS.find(c => c.id === id);
                return <div key={id} style={{
                  width: gridCols === 3 ? 6 : 8, height: gridCols === 3 ? 6 : 8, borderRadius: "50%",
                  background: mc?.hex || "#888", border: "1px solid #ffffff33",
                  boxShadow: "0 0 4px " + (mc?.hex || "#888") + "88",
                }} />;
              })}
            </div>
          )}
        </div>

        {/* Type / keyword badges */}
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {isArtifactToken && (
            <span style={{
              fontSize: badgeFz, letterSpacing: 0.8, textTransform: "uppercase",
              color: COLORS.artifact, background: COLORS.artifact + "22",
              padding: "1px 5px", borderRadius: 3,
            }}>{tok.isCreature ? "Art. Creature" : "Artifact"}</span>
          )}
          {hasEotMod && (
            <span style={{
              fontSize: badgeFz, color: COLORS.eot, background: COLORS.eot + "22",
              padding: "1px 5px", borderRadius: 3,
            }}>until EOT</span>
          )}
          {tok.keywords && tok.keywords.slice(0, gridCols === 1 ? 5 : 3).map(kw => (
            <span key={kw} style={{
              fontSize: badgeFz, padding: "1px 5px", borderRadius: 8,
              background: accent + "22", border: ("1px solid " + accent + "44"),
              color: accent,
            }}>{kw}</span>
          ))}
          {tok.counters.map(c => (
            <span key={c.type} style={{
              fontSize: badgeFz,
              color: c.type === "+1/+1" ? COLORS.teal : c.type === "-1/-1" ? COLORS.red : COLORS.gold,
              background: "#ffffff11", padding: "1px 5px", borderRadius: 3,
            }}>{c.type}×{c.count}</span>
          ))}
        </div>

        {/* Ability text snippet */}
        {tok.abilityText && (
          <div style={{
            fontSize: badgeFz, color: COLORS.muted, fontStyle: "italic",
            lineHeight: 1.4, overflow: "hidden",
            display: "-webkit-box", WebkitLineClamp: gridCols === 1 ? 3 : 2, WebkitBoxOrient: "vertical",
          }}>
            {tok.abilityText}
          </div>
        )}

        {/* Details button → opens bottom sheet */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 2 }}>
          <button onClick={onOpenSheet} style={{
            background: accent + "18", border: ("1px solid " + accent + "66"),
            color: accent, fontSize: gridCols === 3 ? 9 : 10, cursor: "pointer",
            padding: gridCols === 3 ? "2px 6px" : "3px 8px",
            borderRadius: 6, flexShrink: 0, letterSpacing: 0.5,
            boxShadow: "0 0 6px " + accent + "44",
            transition: "box-shadow 0.15s",
          }}>Details ›</button>
        </div>
      </div>
      </>)}
    </div>
  );
}

// ── Token Card ─────────────────────────────────────────────────────────────────
function TokenCard({ tok, tokIndex, totalTokens, reorderMode, displayType, effectivePower, effectiveToughness, updateToken, addCounter, removeCounter, tapOne, untapOne, removeToken, moveToken }) {
  const [showCounterMenu, setShowCounterMenu] = useState(false);

  const name = displayType(tok);
  const isArtifactToken = ARTIFACT_TOKENS.includes(tok.type);
  const showPT = !isArtifactToken || tok.isCreature;
  const pow = effectivePower(tok);
  const tou = effectiveToughness(tok);
  const tapped = tok.tappedCount;
  const untapped = tok.quantity - tapped;
  const allTapped = tapped === tok.quantity && tok.quantity > 0;
  const someTapped = tapped > 0;
  const hasEotMod = tok.eotPowerMod !== 0 || tok.eotToughnessMod !== 0;
  const accent = cardAccent(tok.colors);
  const gradient = cardGradient(tok.colors);
  const isMulti = (tok.colors || []).length > 1;
  const borderColor = allTapped ? COLORS.tap : hasEotMod ? COLORS.eot : accent;



  return (
    <div style={{
      background: "#1a1f2e",
      border: `1px solid ${reorderMode ? COLORS.teal + "55" : borderColor + "44"}`,
      borderRadius: 10, marginBottom: 10,
      opacity: allTapped ? 0.72 : 1,
      transition: "all 0.2s ease",
      overflow: "hidden", position: "relative",
      animation: "cardSettle 0.22s ease",
      boxShadow: reorderMode ? `0 0 0 1px ${COLORS.teal}33` : hasEotMod ? `0 2px 14px ${COLORS.eot}28` : someTapped ? "none" : `0 2px 12px ${accent}22`,
      ...(isMulti && !allTapped && !hasEotMod ? {
        borderLeft: `3px solid ${reorderMode ? COLORS.teal : "transparent"}`,
        backgroundImage: reorderMode ? "none" : `linear-gradient(#1a1f2e, #1a1f2e), ${gradient}`,
        backgroundOrigin: "border-box",
        backgroundClip: "padding-box, border-box",
      } : {
        borderLeft: `3px solid ${reorderMode ? COLORS.teal : borderColor}`,
      }),
    }}>

      {/* ── Reorder mode ── */}
      {reorderMode && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 5, flexShrink: 0 }}>
            <button onClick={() => moveToken(tok.id, -1)} disabled={tokIndex === 0} style={{
              ...smallBtn(tokIndex === 0 ? COLORS.border : COLORS.teal),
              opacity: tokIndex === 0 ? 0.3 : 1,
              padding: "5px 10px", fontSize: 14, lineHeight: 1,
            }}>↑</button>
            <button onClick={() => moveToken(tok.id, 1)} disabled={tokIndex === totalTokens - 1} style={{
              ...smallBtn(tokIndex === totalTokens - 1 ? COLORS.border : COLORS.teal),
              opacity: tokIndex === totalTokens - 1 ? 0.3 : 1,
              padding: "5px 10px", fontSize: 14, lineHeight: 1,
            }}>↓</button>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: "bold", color: COLORS.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{displayType(tok)}</div>
            <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>
              ×{tok.quantity}{tok.isCreature ? ` · ${effectivePower(tok)}/${effectiveToughness(tok)}` : ""}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
            {(tok.colors || []).map(c => {
              const cd = ALL_PLAYER_COLORS.find(x => x.id === c) || { hex: COLORS.artifact };
              return <div key={c} style={{ width: 8, height: 8, borderRadius: "50%", background: cd.hex }} />;
            })}
          </div>
        </div>
      )}

      {/* ── Normal card content ── */}
      {!reorderMode && (<>
      {/* Art overlay — right spacer keeps dropdown clear, edge-to-edge height */}
      {tok.artUrl && (
        <div style={{
          position: "absolute", top: 0, height: 80,
          right: 48, width: 142,
          pointerEvents: "none", zIndex: 0, overflow: "hidden",
        }}>
          <img src={tok.artUrl} alt="" style={{
            width: "100%", height: "100%",
            objectFit: "cover", objectPosition: "center 25%",
            display: "block",
          }}/>
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(to right, #1a1f2e 0%, #1a1f2e 15%, rgba(26,31,46,0.5) 45%, rgba(26,31,46,0.05) 75%, #1a1f2e 100%)",
          }}/>
        </div>
      )}
      {/* Main Row */}
      <div style={{ display: "flex", alignItems: "center", padding: "10px 12px", gap: 10, position: "relative", zIndex: 1 }}>

        {/* Tap Controls */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, flexShrink: 0 }}>
          <button onClick={() => tapOne(tok.id)} disabled={tapped >= tok.quantity} title="Tap one" style={{
            width: 30, height: 28, borderRadius: "6px 6px 3px 3px",
            background: tapped < tok.quantity ? accent + "22" : "#ffffff06",
            border: `1px solid ${tapped < tok.quantity ? accent + "99" : COLORS.border}`,
            color: tapped < tok.quantity ? accent : COLORS.muted,
            fontSize: 13, cursor: tapped < tok.quantity ? "pointer" : "default",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: tapped < tok.quantity ? `0 0 8px ${accent}66, inset 0 0 4px ${accent}22` : "none",
            transition: "all 0.15s",
          }}>↷</button>
          <button onClick={() => untapOne(tok.id)} disabled={tapped === 0} title="Untap one" style={{
            width: 30, height: 28, borderRadius: "3px 3px 6px 6px",
            background: tapped > 0 ? accent + "22" : "#ffffff06",
            border: `1px solid ${tapped > 0 ? accent + "99" : COLORS.border}`,
            color: tapped > 0 ? accent : COLORS.muted,
            fontSize: 13, cursor: tapped > 0 ? "pointer" : "default",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: tapped > 0 ? `0 0 8px ${accent}66, inset 0 0 4px ${accent}22` : "none",
            transition: "all 0.15s",
          }}>⟳</button>
        </div>

        {/* Token Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 15, fontWeight: "bold", color: COLORS.text }}>{name}</span>
            {/* Color identity pips */}
            {(tok.colors || []).length > 0 && (
              <div style={{ display: "flex", gap: 3 }}>
                {tok.colors.map(id => {
                  const mc = MTG_COLORS.find(c => c.id === id);
                  return <div key={id} style={{ width: 9, height: 9, borderRadius: "50%", background: mc?.hex || "#888", border: "1px solid #ffffff33" }} />;
                })}
              </div>
            )}
            {isArtifactToken && (
              <span style={{
                fontSize: 10, letterSpacing: 1, textTransform: "uppercase",
                color: COLORS.artifact, background: COLORS.artifact + "22",
                padding: "1px 6px", borderRadius: 4,
              }}>
                {tok.isCreature ? "Artifact Creature" : "Artifact"}
              </span>
            )}
            {hasEotMod && (
              <span style={{
                fontSize: 10, letterSpacing: 1,
                color: COLORS.eot, background: COLORS.eot + "22",
                padding: "1px 6px", borderRadius: 4,
              }}>
                until EOT
              </span>
            )}
          </div>

          {/* Pips + stats */}
          <div style={{ display: "flex", gap: 8, marginTop: 5, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
              {Array.from({ length: tok.quantity }).map((_, i) => {
                const isTapped = i >= untapped;
                return (
                  <div key={i} style={{
                    width: 7, height: 11, borderRadius: 2,
                    background: isTapped ? COLORS.tap : accent,
                    opacity: isTapped ? 0.65 : 1,
                    transform: isTapped ? "rotate(90deg)" : "none",
                    transition: "all 0.2s",
                  }} />
                );
              })}
            </div>
            <span style={{ fontSize: 12, color: COLORS.muted }}>
              ×{tok.quantity}
              {someTapped && <span style={{ color: COLORS.tap }}> ({tapped} tapped)</span>}
            </span>
            {showPT && (
              <span style={{
                fontSize: 13, fontWeight: "bold",
                color: hasEotMod ? COLORS.eot : accent,
                background: (hasEotMod ? COLORS.eot : accent) + "22",
                padding: "1px 8px", borderRadius: 4, letterSpacing: 1,
                transition: "all 0.2s",
              }}>
                {pow}/{tou}
              </span>
            )}
            {tok.counters.map(c => (
              <span key={c.type} style={{
                fontSize: 11,
                color: c.type === "+1/+1" ? COLORS.teal : c.type === "-1/-1" ? COLORS.red : COLORS.gold,
                background: "#ffffff11", padding: "1px 6px", borderRadius: 4,
              }}>{c.type} ×{c.count}</span>
            ))}
          </div>
          {/* Keyword badges */}
          {tok.keywords && tok.keywords.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 5 }}>
              {tok.keywords.map(kw => (
                <span key={kw} style={{
                  fontSize: 10, padding: "1px 7px", borderRadius: 10,
                  background: accent + "28", border: `1px solid ${accent}55`,
                  color: accent, letterSpacing: 0.3,
                }}>{kw}</span>
              ))}
            </div>
          )}
          {/* Ability text */}
          {tok.abilityText && (
            <div style={{
              marginTop: 4, fontSize: 11, color: COLORS.muted,
              fontStyle: "italic", lineHeight: 1.5,
              whiteSpace: "pre-wrap", wordBreak: "break-word",
            }}>
              {renderSymbols(tok.abilityText)}
            </div>
          )}
        </div>

        <button onClick={() => setExpanded(e => !e)} style={{
          background: expanded ? accent + "28" : "#ffffff0f",
          border: `1px solid ${expanded ? accent + "99" : COLORS.border + "aa"}`,
          color: expanded ? accent : COLORS.text,
          fontSize: 14, cursor: "pointer", padding: "6px 10px",
          borderRadius: 8, flexShrink: 0,
          transform: expanded ? "rotate(180deg)" : "none",
          transition: "transform 0.2s, box-shadow 0.15s, background 0.15s",
          boxShadow: expanded ? `0 0 10px ${accent}77, inset 0 0 5px ${accent}22` : `0 0 6px ${accent}33`,
          zIndex: 2, position: "relative",
        }}>▾</button>
      </div>

      {/* Expanded Controls */}
      {expanded && (
        <div style={{
          borderTop: `1px solid ${COLORS.border}`, padding: "12px 12px",
          position: "relative", zIndex: 1,
          background: "#1a1f2e",
        }}>

          <Row label="Quantity">
            <Stepper value={tok.quantity} min={tok.tappedCount + 1}
              onChange={v => updateToken(tok.id, { quantity: v })} color={accent} />
          </Row>

          {/* Artifact → Creature toggle */}
          {isArtifactToken && (
            <Row label="Make Creature">
              <button
                onClick={() => updateToken(tok.id, {
                  isCreature: !tok.isCreature,
                  basePower: tok.isCreature ? 0 : 1,
                  baseToughness: tok.isCreature ? 0 : 1,
                  powerMod: 0, toughnessMod: 0,
                  eotPowerMod: 0, eotToughnessMod: 0,
                })}
                style={{
                  background: tok.isCreature ? COLORS.teal + "22" : "#ffffff0a",
                  border: `1px solid ${tok.isCreature ? COLORS.teal : COLORS.border}`,
                  color: tok.isCreature ? COLORS.teal : COLORS.muted,
                  borderRadius: 20, padding: "5px 16px",
                  cursor: "pointer", fontFamily: "inherit", fontSize: 12, transition: "all 0.15s",
                }}
              >{tok.isCreature ? "✔ Creature" : "Animate"}</button>
            </Row>
          )}

          {/* P/T controls */}
          {showPT && (
            <>
              <Row label="Base P/T">
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Stepper value={tok.basePower} onChange={v => updateToken(tok.id, { basePower: v })} color={accent} small />
                  <span style={{ color: COLORS.muted }}>/</span>
                  <Stepper value={tok.baseToughness} onChange={v => updateToken(tok.id, { baseToughness: v })} color={accent} small />
                </div>
              </Row>

              <Row label="P/T Modifier">
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Stepper value={tok.powerMod} onChange={v => updateToken(tok.id, { powerMod: v })} color={accent} small allowNeg />
                  <span style={{ color: COLORS.muted }}>/</span>
                  <Stepper value={tok.toughnessMod} onChange={v => updateToken(tok.id, { toughnessMod: v })} color={accent} small allowNeg />
                </div>
              </Row>

              {/* Until End of Turn modifier */}
              <div style={{
                margin: "10px 0 8px",
                padding: "10px 12px",
                background: COLORS.eot + "0e",
                border: `1px solid ${COLORS.eot}33`,
                borderRadius: 8,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 11, color: COLORS.eot, letterSpacing: 1, textTransform: "uppercase" }}>
                    ⏳ Until End of Turn
                  </span>
                  {(tok.eotPowerMod !== 0 || tok.eotToughnessMod !== 0) && (
                    <button
                      onClick={() => updateToken(tok.id, { eotPowerMod: 0, eotToughnessMod: 0 })}
                      style={{ ...smallBtn(COLORS.eot), fontSize: 10, padding: "2px 8px" }}
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Stepper value={tok.eotPowerMod} onChange={v => updateToken(tok.id, { eotPowerMod: v })} color={COLORS.eot} small allowNeg />
                  <span style={{ color: COLORS.muted, fontSize: 13 }}>/</span>
                  <Stepper value={tok.eotToughnessMod} onChange={v => updateToken(tok.id, { eotToughnessMod: v })} color={COLORS.eot} small allowNeg />
                  <span style={{ fontSize: 11, color: COLORS.muted, marginLeft: 4 }}>resets at EOT</span>
                </div>
              </div>

              {/* Effective P/T summary */}
              <div style={{
                display: "flex", justifyContent: "center", alignItems: "center", gap: 10,
                margin: "4px 0 8px", padding: "8px",
                background: accent + "11", borderRadius: 8,
                border: `1px solid ${accent}33`,
              }}>
                <span style={{ color: COLORS.muted, fontSize: 12 }}>Effective:</span>
                <span style={{ color: accent, fontWeight: "bold", fontSize: 16 }}>
                  {tok.basePower + tok.powerMod}/{tok.baseToughness + tok.toughnessMod}
                </span>
                {(tok.eotPowerMod !== 0 || tok.eotToughnessMod !== 0) && (
                  <>
                    <span style={{ color: COLORS.muted, fontSize: 12 }}>+EOT</span>
                    <span style={{ color: COLORS.eot, fontWeight: "bold", fontSize: 16 }}>
                      {effectivePower(tok)}/{effectiveToughness(tok)}
                    </span>
                  </>
                )}
              </div>
            </>
          )}

          {/* Counters */}
          <div style={{ marginTop: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 1 }}>Counters</span>
              <button onClick={() => setShowCounterMenu(m => !m)} style={{ ...smallBtn(COLORS.gold), fontSize: 11 }}>
                + Add Counter
              </button>
            </div>
            {showCounterMenu && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8, padding: 8, background: "#ffffff08", borderRadius: 8 }}>
                {COUNTER_TYPES.map(ct => (
                  <button key={ct} onClick={() => { addCounter(tok.id, ct); setShowCounterMenu(false); }} style={smallBtn(COLORS.teal)}>
                    {ct}
                  </button>
                ))}
              </div>
            )}
            {tok.counters.length === 0 && <div style={{ fontSize: 12, color: COLORS.muted, fontStyle: "italic" }}>No counters</div>}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {tok.counters.map(c => (
                <div key={c.type} style={{
                  display: "flex", alignItems: "center", gap: 4,
                  background: "#ffffff0a", borderRadius: 6, padding: "4px 8px",
                  border: `1px solid ${COLORS.border}`,
                }}>
                  <span style={{ fontSize: 12, color: COLORS.text }}>{c.type}</span>
                  <button onClick={() => removeCounter(tok.id, c.type)} style={{ ...iconBtn, color: COLORS.red }}>−</button>
                  <span style={{ fontSize: 13, color: COLORS.gold, minWidth: 16, textAlign: "center" }}>{c.count}</span>
                  <button onClick={() => addCounter(tok.id, c.type)} style={{ ...iconBtn, color: COLORS.teal }}>+</button>
                </div>
              ))}
            </div>
          </div>

          <button onClick={() => removeToken(tok.id)} style={{
            marginTop: 8, width: "100%",
            background: COLORS.red + "22", border: `1px solid ${COLORS.red}88`,
            color: COLORS.red, borderRadius: 8, padding: "8px",
            cursor: "pointer", fontFamily: "inherit", fontSize: 13, letterSpacing: 0.5,
            boxShadow: `0 0 10px ${COLORS.red}44, inset 0 0 6px ${COLORS.red}18`,
            transition: "box-shadow 0.15s",
          }}>
            ✕ Remove Token
          </button>
        </div>
      )}
      </>)}
    </div>
  );
}

// ── Sub-Accordion (smaller, used inside Ability Text) ─────────────────────────
function SubAccordion({ label, open, onToggle, children }) {
  return (
    <div style={{
      border: `1px solid ${open ? COLORS.teal + "55" : COLORS.border}`,
      borderRadius: 6,
      overflow: "hidden",
      transition: "border-color 0.15s",
    }}>
      <button onClick={onToggle} style={{
        width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "7px 10px", background: open ? COLORS.teal + "0d" : "#ffffff04",
        border: "none", cursor: "pointer", fontFamily: "inherit",
        transition: "background 0.15s",
      }}>
        <span style={{ fontSize: 11, color: open ? COLORS.teal : COLORS.muted, letterSpacing: 0.6, textTransform: "uppercase" }}>
          {label}
        </span>
        <span style={{
          color: open ? COLORS.teal : COLORS.muted, fontSize: 11,
          display: "inline-block", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s",
        }}>▾</span>
      </button>
      {open && (
        <div style={{ padding: "0 10px 8px", borderTop: `1px solid ${COLORS.border}` }}>
          {children}
        </div>
      )}
    </div>
  );
}
// Turns {T}, {W}, {2}, etc. into styled inline spans
function renderSymbols(text) {
  const parts = text.split(/(\{[^}]+\})/g);
  return parts.map((part, i) => {
    if (!part.startsWith("{")) return part;
    const inner = part.slice(1, -1);
    const sym = MANA_SYMBOLS.find(s => s.text === part);
    if (inner === "T") return (
      <span key={i} style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 16, height: 16, borderRadius: "50%",
        background: COLORS.tap + "44", border: `1px solid ${COLORS.tap}88`,
        color: COLORS.tap, fontSize: 9, fontWeight: "bold",
        verticalAlign: "middle", margin: "0 1px",
      }}>↷</span>
    );
    return (
      <span key={i} style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 16, height: 16, borderRadius: "50%",
        background: sym?.bg || "#2a3050",
        border: `1px solid ${(sym?.color || COLORS.text) + "44"}`,
        color: sym?.color || COLORS.text,
        fontSize: inner.length > 2 ? 6 : inner.length > 1 ? 8 : 9,
        fontWeight: "bold",
        verticalAlign: "middle", margin: "0 1px",
      }}>{inner}</span>
    );
  });
}

// ── Shared Components ──────────────────────────────────────────────────────────
function Stepper({ value, min = undefined, onChange, color, small, allowNeg }) {
  const canDec = allowNeg || min === undefined || value > min;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: small ? 6 : 8 }}>
      <button onClick={() => { if (canDec) onChange(value - 1); }} style={{
        width: small ? 24 : 30, height: small ? 24 : 30, borderRadius: 6,
        background: canDec ? color + "22" : "#ffffff08",
        border: `1px solid ${canDec ? color + "44" : COLORS.border}`,
        color: canDec ? color : COLORS.muted,
        cursor: canDec ? "pointer" : "default", fontSize: small ? 14 : 16,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>−</button>
      <span style={{ minWidth: small ? 20 : 28, textAlign: "center", fontSize: small ? 14 : 16, color: COLORS.text }}>{value}</span>
      <button onClick={() => onChange(value + 1)} style={{
        width: small ? 24 : 30, height: small ? 24 : 30, borderRadius: 6,
        background: color + "22", border: `1px solid ${color}44`,
        color: color, cursor: "pointer", fontSize: small ? 14 : 16,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>+</button>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
      <span style={{ fontSize: 12, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</span>
      {children}
    </div>
  );
}

function NumInput({ value, min, onChange }) {
  return (
    <input type="number" value={value} min={min} onChange={e => onChange(Number(e.target.value))}
      style={{ ...inputStyle, marginTop: 4, padding: "6px 8px" }} />
  );
}

function Label({ children }) {
  return <div style={{ fontSize: 11, color: COLORS.muted, letterSpacing: 1, textTransform: "uppercase", marginTop: 10, marginBottom: 4 }}>{children}</div>;
}

const selectStyle = {
  width: "100%", background: "#0d1018", border: `1px solid ${COLORS.border}`,
  borderRadius: 8, padding: "8px 10px", color: COLORS.text, fontSize: 14, fontFamily: "inherit",
};

const inputStyle = {
  width: "100%", background: "#0d1018", border: `1px solid ${COLORS.border}`,
  borderRadius: 8, padding: "8px 10px", color: COLORS.text, fontSize: 14,
  fontFamily: "inherit", boxSizing: "border-box",
};

const btnStyle = (borderColor, bg) => ({
  flex: 1, padding: "10px", background: bg, border: `1px solid ${borderColor}`,
  color: borderColor, borderRadius: 8, cursor: "pointer",
  fontFamily: "inherit", fontSize: 13, letterSpacing: 0.5,
});

const smallBtn = (color) => ({
  background: color + "22", border: `1px solid ${color}88`,
  color: color, borderRadius: 6, padding: "4px 8px",
  cursor: "pointer", fontFamily: "inherit", fontSize: 12,
  boxShadow: `0 0 8px ${color}44, inset 0 0 4px ${color}18`,
  transition: "box-shadow 0.15s",
});

const iconBtn = {
  background: "none", border: "none", cursor: "pointer",
  fontSize: 16, lineHeight: 1, padding: "0 2px", fontFamily: "inherit",
  filter: "drop-shadow(0 0 4px currentColor)",
  transition: "filter 0.15s",
};

function effectivePower(tok) { return tok.basePower + tok.powerMod + tok.eotPowerMod; }
function effectiveToughness(tok) { return tok.baseToughness + tok.toughnessMod + tok.eotToughnessMod; }

// Make App available for mounting from index.html
window.__MTGApp = App;
