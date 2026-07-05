import React, { useEffect, useState } from 'react'

export default function HallOfFame(){
  // Minimal interactive state to keep behaviour similar
  const [dialogueIdx, setDialogueIdx] = useState(0)
  const susChatLogs = [
    { sender: "IndianCoder3", text: "hello dont del code I beg u", color: "cyan", icon: "🤖" },
    { sender: "DreamLong", text: "I'll del u dw", color: "pink", icon: "😡" },
    { sender: "IndianCoder3", text: "I'll del ur push access dw", color: "cyan", icon: "🛠️" },
    { sender: "DreamLong", text: "just stfu and do your work", color: "pink", icon: "💀" }
  ]

  useEffect(()=>{
    // initial empty state
    document.title = 'Astralyx PvP - Complete Dev Hall of Fame'
  },[])

  function stepDialogue(dir){
    setDialogueIdx(i => Math.max(0, Math.min(susChatLogs.length, i + dir)))
  }

  function resetDialogue(){
    setDialogueIdx(0)
  }

  return (
    <div className="site-root">
      <div className="cosmic-bg"></div>
      <header className="site-header">
        <div className="header-inner">
          <div className="brand"><span className="tag">&lt;A&gt;</span> ASTRALYX <span className="pill">MEME MUSEUM</span></div>
          <div className="header-controls">
            <div className="status">● PROD BUILDS PASSING</div>
            <a href="#commits-registry" className="logs-link">Logs</a>
          </div>
        </div>
      </header>

      <main className="main-container">
        <section className="hero">
          <div className="label">🛠️ PROD-LINE MEME REPOSITORY</div>
          <h1 className="hero-title">The Complete Hall of <span className="gradient">Dev Brainrot</span></h1>
          <p className="hero-sub">Behold the actual, uncensored history of the AstralyxPvP website development. Trace the conflicts, check your coordinates, swing your axes, and save granny from meteorites.</p>
        </section>

        <section className="grid two-cols">
          <div className="panel terminal">
            <div className="term-top">
              <div className="term-left">
                <span className="dot red"/>
                <span className="dot yellow"/>
                <span className="dot green"/>
                <span className="path">/git-logs/sus.txt</span>
              </div>
              <div className="term-right">May 11 - May 15</div>
            </div>
            <div className="term-body" id="sus-chat-viewport">
              {dialogueIdx===0 && <p className="empty">Log container empty. Advance line to replay.</p>}
              {susChatLogs.slice(0, dialogueIdx).map((item, idx)=> (
                <div className="message" key={idx}>
                  <div className={`msg-badge ${item.color}`}>{item.icon} @{item.sender}</div>
                  <div className="msg-text">{item.text}</div>
                </div>
              ))}
            </div>
            <div className="term-controls">
              <div>
                <button onClick={()=>stepDialogue(-1)} className="btn small">&lt; Prev</button>
                <button onClick={()=>stepDialogue(1)} className="btn cyan small">Next &gt;</button>
                <span className="counter">Line {dialogueIdx} of {susChatLogs.length}</span>
              </div>
              <button onClick={resetDialogue} className="link">Flush Log</button>
            </div>
          </div>

          <div className="panel pink-panel">
            <div className="pink-top">May 10 Breach <span className="muted">dont_touch.js Protocol</span></div>
            <h3>The forbidden "// i touched it" comment</h3>
            <p className="muted">DreamLong explicitly warned you. He created <code>dont_touch.js</code>. The next morning, you opened it and chaos ensued.</p>
            <div className="code-panel">
              <div className="lang">JS</div>
              <p className="comment">// File: dont_touch.js</p>
              <div className="touched" id="touched-indicator"><span className="muted">Waiting for deployment...</span></div>
            </div>
            <div className="touch-row">
              <button className="btn pink" onClick={()=>alert('BREACH TRIGGERED (simulated)')}>🚨 Touch dont_touch.js</button>
              <p className="muted small">Warning: Tapping will force DreamLong to auto-deploy commit "FUCK YOU ASS BITCH".</p>
            </div>
          </div>
        </section>

        <section id="commits-registry" className="commits">
          <div className="commits-top">
            <h2>The Complete Commit Timeline</h2>
            <p className="muted">Search and audit every legendary commit made on the repository.</p>
          </div>
          <div className="commits-viewport">
            <p className="muted">(Commit timeline preserved in the original site. For brevity this React port focuses on the Hall of Fame layout and interactive panels.)</p>
          </div>
        </section>

      </main>

      <footer className="site-footer">
        <p>Created under extreme stress conditions by <span className="cyan">IndianCoder3</span>. Backed by Gemini 3.1 & Improved by Rage.</p>
        <p className="muted">AstralyxPvP © 2026. Last updated: 22nd June 2026.</p>
      </footer>
    </div>
  )
}
