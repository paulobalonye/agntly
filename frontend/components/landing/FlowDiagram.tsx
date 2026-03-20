'use client';

export function FlowDiagram() {
  return (
    <div className="relative w-full max-w-[760px] mx-auto animate-fade-up delay-300">
      <svg className="w-full h-[120px]" viewBox="0 0 760 110" preserveAspectRatio="xMidYMid meet">
        <defs>
          <marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M2 1L8 5L2 9" fill="none" stroke="#00e5a0" strokeWidth="1.5"/>
          </marker>
          <marker id="arr2" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M2 1L8 5L2 9" fill="none" stroke="#4d9ef5" strokeWidth="1.5"/>
          </marker>
        </defs>
        {/* User */}
        <rect x="20" y="30" width="110" height="50" rx="2" fill="#0d1117" stroke="#243447" strokeWidth="1"/>
        <text x="75" y="52" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="11" fill="#8fa8c0">User</text>
        <text x="75" y="70" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="9" fill="#4d6478">funds wallet</text>
        {/* Arrow 1 */}
        <line x1="131" y1="55" x2="175" y2="55" stroke="#00e5a0" strokeWidth="1" markerEnd="url(#arr)" strokeDasharray="4 3" className="animate-dash"/>
        {/* Orchestrator */}
        <rect x="177" y="20" width="130" height="70" rx="2" fill="#0d1117" stroke="#00e5a0" strokeWidth="1"/>
        <text x="242" y="48" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="11" fill="#e8edf2">Orchestrator</text>
        <text x="242" y="65" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="9" fill="#4d6478">assigns tasks</text>
        <text x="242" y="80" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="9" fill="#00e5a0">$0.10 budget</text>
        {/* Arrows to sub-agents */}
        <line x1="308" y1="40" x2="360" y2="30" stroke="#4d9ef5" strokeWidth="1" markerEnd="url(#arr2)" strokeDasharray="4 3" className="animate-dash" style={{animationDuration:'0.9s'}}/>
        <line x1="308" y1="55" x2="360" y2="55" stroke="#4d9ef5" strokeWidth="1" markerEnd="url(#arr2)" strokeDasharray="4 3" className="animate-dash" style={{animationDuration:'1.1s'}}/>
        <line x1="308" y1="70" x2="360" y2="80" stroke="#4d9ef5" strokeWidth="1" markerEnd="url(#arr2)" strokeDasharray="4 3" className="animate-dash" style={{animationDuration:'1.3s'}}/>
        {/* Sub agents */}
        <rect x="362" y="10" width="115" height="38" rx="2" fill="#0d1117" stroke="#243447" strokeWidth="1"/>
        <text x="419" y="27" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="10" fill="#8fa8c0">Web Search</text>
        <text x="419" y="41" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="9" fill="#4d9ef5">$0.002/call</text>
        <rect x="362" y="56" width="115" height="38" rx="2" fill="#0d1117" stroke="#243447" strokeWidth="1"/>
        <text x="419" y="73" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="10" fill="#8fa8c0">CodeExec</text>
        <text x="419" y="87" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="9" fill="#4d9ef5">$0.005/call</text>
        <text x="419" y="9" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="8" fill="#4d6478">escrow locked</text>
        {/* Arrows to settlement */}
        <line x1="478" y1="30" x2="528" y2="45" stroke="#00e5a0" strokeWidth="1" markerEnd="url(#arr)" strokeDasharray="4 3" className="animate-dash"/>
        <line x1="478" y1="75" x2="528" y2="60" stroke="#00e5a0" strokeWidth="1" markerEnd="url(#arr)" strokeDasharray="4 3" style={{animationDuration:'1.2s'}}/>
        {/* Settlement */}
        <rect x="530" y="25" width="130" height="60" rx="2" fill="#0d1117" stroke="#00e5a0" strokeWidth="1"/>
        <text x="595" y="48" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="10" fill="#e8edf2">Settlement</text>
        <text x="595" y="63" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="9" fill="#00e5a0">Base L2 · USDC</text>
        <text x="595" y="78" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="9" fill="#4d6478">on-chain proof</text>
        {/* Receipt */}
        <line x1="661" y1="55" x2="710" y2="55" stroke="#00e5a0" strokeWidth="1" markerEnd="url(#arr)" strokeDasharray="4 3" className="animate-dash"/>
        <rect x="712" y="30" width="40" height="50" rx="2" fill="#0d1117" stroke="#243447" strokeWidth="1"/>
        <text x="732" y="52" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="9" fill="#8fa8c0">Rcpt</text>
        <text x="732" y="66" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="8" fill="#4d6478">audit</text>
      </svg>
    </div>
  );
}
