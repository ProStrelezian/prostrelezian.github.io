// dashboard_dev.js
/**
 * ZLAN Dashboard 2026 - Optimized Core Logic
 * Author: Antigravity AI
 */

// Helper: Normalisation du texte (minuscules, sans accents) pour des comparaisons robustes
const normalizeText = (str) => String(str || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

// Helper: Recherche d'un mot-clé dans une cellule (insensible à la casse et aux accents)
const has = (cell, text) => normalizeText(cell).includes(normalizeText(text));

// Helper: Détection d'un début de phase de groupe
const isGroupPhase = (row) => {
    if (!row) return false;
    const cells = Array.isArray(row) ? row.slice(0, 3) : [row];
    return cells.some(cell => {
        const t = normalizeText(cell);
        return t.includes("phase") && !t.includes("seeding") && !t.includes("knockout");
    });
};

class ZlanDashboard {
    constructor(encodedUrl, enableTwitchLive = false, avatarUrl = null, is2026Format = false, useMockData = false) {
        console.log(`🚀 [ZLAN] Dashboard initialisé (Format 2026: ${is2026Format} | Mode Mock: ${useMockData})`);
        this.sheetUrl = encodedUrl ? atob(encodedUrl) : "";
        this.enableTwitchLive = enableTwitchLive;
        this.avatarUrl = avatarUrl;
        this.is2026 = is2026Format;
        this.useMockData = useMockData;
        this.isFetching = false;
        this.lastRawData = ""; // Pour le check de changement de données

        this.init();
        if (this.enableTwitchLive) {
            this.checkTwitchLive();
            setInterval(() => this.checkTwitchLive(), 120000);
        }
    }

    /**
     * Initialisation et cycle de rafraîchissement
     */
    async init() {
        if (this.isFetching) return;
        this.isFetching = true;

        if (this.useMockData) {
            this.handleData(this.getMockData());
            this.isFetching = false;
            this.updateStatus("MOCK OK", "violet");
            setTimeout(() => this.init(), 30000);
            return;
        }

        try {
            const url = `${this.sheetUrl}&timestamp=${Date.now()}&rnd=${Math.random()}`;
            const response = await fetch(url, { cache: 'no-store' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const csvData = await response.text();
            
            // Check si les données ont changé pour éviter un re-rendu inutile
            if (csvData === this.lastRawData) {
                this.isFetching = false;
                this.updateStatus("SYNC OK (Cached)", "green");
                setTimeout(() => this.init(), 30000);
                return;
            }
            this.lastRawData = csvData;

            Papa.parse(csvData, {
                skipEmptyLines: false,
                complete: (results) => {
                    if (results?.data) this.handleData(results.data);
                    this.isFetching = false;
                    this.updateStatus("SYNC OK", "green");
                    setTimeout(() => this.init(), 30000);
                },
                error: (err) => {
                    console.error("❌ Erreur Parse:", err);
                    this.updateStatus("ERREUR PARSE", "red");
                    this.isFetching = false;
                    setTimeout(() => this.init(), 30000);
                }
            });
        } catch (error) {
            console.error("❌ Erreur Fetch:", error);
            this.updateStatus("HORS LIGNE", "red");
            this.isFetching = false;
            setTimeout(() => this.init(), 30000);
        }
    }

    /**
     * Mise à jour de l'indicateur de statut en haut à droite
     */
    updateStatus(label, colorType) {
        const statusEl = document.getElementById('status');
        if (!statusEl) return;
        const colors = {
            green: { bg: "var(--pixel-green)", glow: "rgba(100,255,218,1)" },
            red: { bg: "var(--pixel-red)", glow: "rgba(229,57,53,1)" },
            violet: { bg: "var(--pixel-violet)", glow: "rgba(145,70,255,1)" }
        };
        const c = colors[colorType] || colors.green;
        const time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        statusEl.innerHTML = `<span class="w-2 h-2 md:w-2.5 md:h-2.5" style="background: ${c.bg}; box-shadow: 0 0 8px ${c.glow}"></span> <span style="color: ${c.bg}" class="whitespace-nowrap uppercase tracking-tighter">${label} (${time})</span>`;
    }

    /**
     * Traitement principal des données
     */
    handleData(data) {
        if (!data?.length) return;
        this.buildDashboard(data);
    }

    /**
     * Construction du HTML par blocs
     */
    buildDashboard(data) {
        let htmlChunks = { team: "", seeding: "", knockout: "", groups: "", finalRank: "" };
        let state = { seedingFinished: false, knockoutFinished: false, groupFinished: true, tournamentOver: false, tournamentWon: false };
        let bluePhaseCount = 0;
        let lastValidRowIndex = data.findLastIndex(row => row.some(c => c?.trim()));

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const r0 = String(row[0] || "");
            const isLastRow = (i === lastValidRowIndex);

            if (state.tournamentOver && !isLastRow) continue;

            // --- 1. JOUEURS ENGAGÉS ---
            let teamText = row.find(c => has(c, "TEAM :") || has(c, "TEAM:"));
            if (teamText) {
                htmlChunks.team = this.renderTeamBlock(teamText);
            }

            // --- 2. RÉSULTAT FINAL ---
            else if (isLastRow) {
                htmlChunks.finalRank = this.renderFinalRankBlock(row, r0, state);
            }

            // --- 3. PHASE DE SEEDING ---
            else if (has(r0, "PHASE DE SEEDING")) {
                let { games, seedingScore, nextIndex } = this.parseSeeding(data, i, lastValidRowIndex);
                if (seedingScore && !has(seedingScore, "EN ATTENTE")) state.seedingFinished = true;
                htmlChunks.seeding = this.renderSeedingBlock(games, seedingScore);
                i = nextIndex - 1;
            }

            // --- 4. PHASE DE KNOCKOUT ---
            else if (has(r0, "PHASE DE KNOCKOUT")) {
                if (!state.seedingFinished) {
                    while (i + 1 < data.length && !isGroupPhase(data[i + 1])) i++;
                    continue;
                }
                let { games, qualif, score, nextIndex } = this.parseKnockout(data, i, lastValidRowIndex, state);
                if (qualif && !has(qualif, "EN ATTENTE")) state.knockoutFinished = true;
                htmlChunks.knockout = this.renderKnockoutBlock(games, qualif, score);
                i = nextIndex - 1;
            }

            // --- 5. GROUPES & FINALES ---
            else if (isGroupPhase(row)) {
                if (!state.knockoutFinished || !state.groupFinished) {
                    while (i + 1 < data.length && !isGroupPhase(data[i + 1])) i++;
                    continue;
                }
                let { chunk, nextIndex, blueCount } = this.renderGroupBlock(data, i, lastValidRowIndex, state, bluePhaseCount);
                htmlChunks.groups += chunk;
                bluePhaseCount = blueCount;
                i = nextIndex - 1;
            }
        }

        this.updateDOM(htmlChunks);
    }

    /**
     * Mise à jour du conteneur principal
     */
    updateDOM(chunks) {
        const container = document.getElementById('dashboard-container');
        if (!container) return;
        const fullHtml = chunks.team + chunks.seeding + chunks.knockout + (chunks.groups ? `<div>${chunks.groups}</div>` : '') + chunks.finalRank;
        if (container.innerHTML !== fullHtml && fullHtml.trim() !== "") {
            container.innerHTML = fullHtml;
        }
    }

    // --- TEMPLATES ET PARSING ---

    renderTeamBlock(teamText) {
        let cleanTeam = teamText.replace(/TEAM\s*:/i, '').trim();
        let avatarHtml = this.avatarUrl ? `
            <div class="flex-shrink-0 transition-transform duration-300 hover:scale-105" style="filter: drop-shadow(6px 6px 0px rgba(0,0,0,0.8));">
                <div class="bg-[var(--pixel-orange)] p-[4px]" style="clip-path: polygon(8px 0, calc(100% - 8px) 0, calc(100% - 8px) 8px, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 8px calc(100% - 8px), 0 calc(100% - 8px), 0 8px, 8px 8px);">
                    <img src="${this.avatarUrl}" alt="Avatar" class="h-[80px] md:h-[140px] lg:h-[180px] w-auto max-w-full object-cover block" style="clip-path: polygon(4px 0, calc(100% - 4px) 0, calc(100% - 4px) 4px, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 4px calc(100% - 4px), 0 calc(100% - 4px), 0 4px, 4px 4px);">
                </div>
            </div>` : '';

        return `
            <section class="mb-6 md:mb-12 flex justify-center w-full px-2 md:px-0">
                <div class="pixel-card border-b-4 px-4 py-5 md:px-8 md:p-8 w-full max-w-[920px]" style="border-bottom-color: var(--pixel-orange);">
                    <div class="flex flex-col md:flex-row items-center justify-center gap-5 md:gap-8">
                        ${avatarHtml}
                        <div class="flex flex-col items-center md:items-start text-center md:text-left">
                            <h1 class="text-[var(--pixel-orange)] font-text text-base md:text-xl lg:text-2xl mb-2 tracking-widest drop-shadow-[0_0_6px_rgba(245,158,11,0.5)]">>> JOUEURS ENGAGÉS <<</h1>
                            <p class="text-2xl md:text-4xl lg:text-5xl font-pixel text-white tracking-wider leading-snug">${cleanTeam}</p>
                        </div>
                    </div>
                </div>
            </section>`;
    }

    renderFinalRankBlock(row, r0, state) {
        let finalRankText = r0 || row.find(c => c?.trim()) || "";
        const exitKeywords = ["ÉLIMINÉ", "ELIMINE", "GAGNÉ", "GAGNE", "CHAMPION", "VICTOIRE", "DÉFAITE", "TOP", "CLASSEMENT", "FINI", "1ER", "2EME", "3EME"];
        const isExplicitEnd = exitKeywords.some(kw => has(finalRankText, kw));
        
        if (isExplicitEnd) state.tournamentOver = true;
        const isHeaderOnly = (has(finalRankText, "PHASE") || has(finalRankText, "JEUX") || has(finalRankText, "QUALIFIÉ") || has(finalRankText, "WIN ?")) && !isExplicitEnd;

        if (state.tournamentOver && !isHeaderOnly && finalRankText?.trim()) {
            if (isHeaderOnly) finalRankText = state.tournamentWon ? "CHAMPIONS !" : "TOURNOI TERMINÉ";

            let isWin = state.tournamentWon || ["WIN", "1ER", "GAGNÉ", "OUI", "TOP 1", "CHAMPIONS", "VICTOIRE"].some(kw => has(finalRankText, kw));
            if (isWin) state.tournamentWon = true;

            let colorVar = state.tournamentWon ? "var(--pixel-green)" : "var(--pixel-red)";
            let bgColor = state.tournamentWon ? "rgba(100, 255, 218, 0.08)" : "rgba(229, 57, 53, 0.08)";
            let shadowColor = state.tournamentWon ? "rgba(100, 255, 218, 0.3)" : "rgba(229, 57, 53, 0.3)";

            return `
                <section class="pixel-animate-enter mt-10 md:mt-16 mb-12 md:mb-20 flex justify-center w-full px-2 md:px-0">
                    <div class="pixel-card border-4 px-6 py-8 md:px-12 md:py-16 w-full max-w-[800px] relative overflow-hidden" 
                         style="border-color: ${colorVar}; text-align: center; background: ${bgColor}; box-shadow: 0 0 30px ${shadowColor}, 8px 8px 0px rgba(0,0,0,0.9);">
                        <div class="absolute top-0 left-0 w-full h-1 opacity-50" style="background: ${colorVar};"></div>
                        <h2 class="text-slate-400 font-text text-xl md:text-4xl mb-4 tracking-[0.2em] uppercase">RÉSULTAT FINAL</h2>
                        <p class="text-3xl md:text-7xl font-pixel tracking-widest animate-pulse" 
                           style="color: ${colorVar}; text-shadow: 4px 4px 0px rgba(0,0,0,0.8);">${finalRankText.toUpperCase()}</p>
                        <div class="mt-6 flex justify-center gap-4 opacity-30">
                            <span style="color: ${colorVar};">★</span><span style="color: ${colorVar};">★</span><span style="color: ${colorVar};">★</span>
                        </div>
                    </div>
                </section>`;
        }
        return "";
    }

    parseSeeding(data, start, lastIndex) {
        let games = [], seedingScore = "", j = start + 1;
        while (j < data.length && !has(String(data[j][0] || ""), "PHASE DE KNOCKOUT") && j !== lastIndex) {
            let subRow = data[j];
            if (subRow[0] && !has(subRow[0], "JEUX")) {
                games.push({ name: subRow[0], place: subRow[3], heure: subRow[9] || subRow[10] || '' });
            }
            let seedIdx = subRow.findIndex(c => has(c, ">> SEEDING"));
            if (seedIdx !== -1) {
                seedingScore = subRow.slice(seedIdx + 1).find(v => v.trim() !== "") || "";
            }
            j++;
        }
        return { games, seedingScore, nextIndex: j };
    }

    renderSeedingBlock(games, score) {
        let gamesHtml = games.map((g, idx) => `
            <div class="grid ${this.is2026 ? 'grid-cols-6' : 'grid-cols-4'} text-center items-stretch border-b border-black/50 last:border-0 hover:bg-white/5 transition-colors ${idx % 2 === 0 ? "bg-[#18181b]" : "bg-[#27272a]/50"}">
                <div class="col-span-2 font-pixel text-[9px] md:text-base lg:text-xl uppercase py-1.5 md:py-3 px-1 flex items-center justify-center" style="color: var(--pixel-orange);">${g.name}</div>
                <div class="col-span-2 font-text text-sm md:text-xl lg:text-2xl ${g.place === '???' ? 'text-slate-600' : 'text-white'} py-1.5 md:py-3 px-1 flex items-center justify-center border-l border-[#27272a]/50">${g.place || '???'}</div>
                ${this.is2026 ? `<time class="col-span-2 font-pixel italic text-[7px] md:text-xs lg:text-base text-slate-400 py-1.5 md:py-3 px-1 border-l border-[#27272a]/50 flex justify-center items-center">${g.heure}</time>` : ''}
            </div>
        `).join('');

        return `
            <section class="pixel-card mt-6 mx-2 md:mx-0">
                <header class="pixel-header-orange px-2.5 py-3 md:px-4 md:p-5 flex flex-col justify-center items-center text-center relative">
                    <div class="text-slate-300 font-text text-sm md:text-xl mb-1 tracking-widest">RÉSULTATS DE LA</div>
                    <h2 class="font-pixel text-lg md:text-3xl tracking-widest" style="color: var(--pixel-orange);">PHASE DE SEEDING</h2>
                </header>
                <div class="p-2 md:p-0">
                    <div class="w-full overflow-x-auto pb-2">
                        <div class="min-w-[500px]">
                            <div class="grid ${this.is2026 ? 'grid-cols-6' : 'grid-cols-4'} font-pixel text-[10px] md:text-sm text-slate-500 p-1.5 md:p-3 text-center bg-[#09090b] border-b border-[#27272a]">
                                <div class="col-span-2">JEUX</div><div class="col-span-2">PLACE</div>
                                ${this.is2026 ? `<div class="col-span-2">HEURE DU LIVE :</div>` : ''}
                            </div>
                            <div class="bg-[#0f0f13]">${gamesHtml}</div>
                        </div>
                    </div>
                </div>
                ${score ? `
                <div class="flex border-t-[3px] border-[#27272a] mt-auto flex-col md:flex-row">
                    <div class="bg-[#18181b] flex-1 p-2.5 md:p-3 flex items-center justify-center"><span class="font-text text-base md:text-2xl text-slate-400">SEED FINALE</span></div>
                    <div class="flex-1 p-2.5 md:p-3 flex items-center justify-center md:border-l-[3px] border-t-[3px] md:border-t-0 border-[#27272a]" style="background: ${has(score, 'EN ATTENTE') ? 'rgba(255, 255, 255, 0.05)' : 'rgba(245, 158, 11, 0.1)'};">
                        <span class="font-pixel text-xl md:text-5xl" style="color: ${has(score, 'EN ATTENTE') ? '#94a3b8' : 'var(--pixel-orange)'};">${score}</span>
                    </div>
                </div>` : ''}
            </section>`;
    }

    parseKnockout(data, start, lastIndex, state) {
        let games = [], qualif = "", score = "", j = start + 1;
        while (j < data.length && !isGroupPhase(data[j]) && j !== lastIndex) {
            let subRow = data[j];
            let qIdx = subRow.findIndex(c => has(c, "QUALIFIÉ"));
            if (qIdx !== -1) {
                let vals = subRow.slice(qIdx + 1).filter(v => v.trim() !== "");
                qualif = vals[0] || "";
                score = vals[1] || "";
                if (!has(qualif, "OUI") && !has(qualif, "WIN") && !has(qualif, "EN ATTENTE") && qualif.trim()) state.tournamentOver = true;
            } else if (subRow[0] && !has(subRow[0], "JEUX") && !has(subRow[0], "PHASE")) {
                if (this.is2026) games.push({ name: subRow[0], choix: subRow[3] || '', contre: subRow[4] || '', score: [subRow[6] || ''], resultat: subRow[7] || '', vies: subRow[8] || '', heure: subRow[9] || '' });
                else games.push({ name: subRow[0], choix: '', contre: subRow[3] || '', score: [subRow[5] || ''], resultat: subRow[6] || '', vies: subRow[7] || '', heure: '' });
            } else if (!subRow[0] && (subRow[6] || subRow[5]) && games.length > 0) {
                games[games.length - 1].score.push(subRow[6] || subRow[5]);
            }
            j++;
        }
        return { games, qualif, score, nextIndex: j };
    }

    renderKnockoutBlock(games, qualif, score) {
        let gamesHtml = games.map((g, idx) => {
            let resCol = has(g.resultat, "GAGNÉ") || has(g.resultat, "VICTOIRE") ? "text-[var(--pixel-green)]" : (has(g.resultat, "PERDU") || has(g.resultat, "DÉFAITE") || has(g.resultat, "NON") ? "text-[var(--pixel-red)]" : (has(g.resultat, "ATTENTE") ? "text-slate-600" : "text-white"));
            let numV = parseInt(g.vies);
            let vDisp = !isNaN(numV) && numV > 0 ? `<div class="flex gap-1 justify-center flex-wrap" style="text-shadow: 1.5px 1.5px 0px rgba(0,0,0,0.8);">${Array(numV).fill('<span style="color: var(--pixel-red);">♥</span>').join('')}</div>` : (numV === 0 ? `<span class="font-pixel text-slate-600">X</span>` : `<span class="text-slate-700">-</span>`);
            let colJ = this.is2026 ? 'col-span-2' : 'col-span-3', colC = this.is2026 ? 'col-span-2' : 'col-span-3', colS = this.is2026 ? 'col-span-2' : 'col-span-3';

            return `
                <div class="grid grid-cols-12 text-[10px] text-center border-b border-black/50 last:border-0 hover:bg-white/5 items-stretch ${idx % 2 === 0 ? "bg-[#18181b]" : "bg-[#27272a]/50"}">
                    <div class="${colJ} font-pixel text-[8px] md:text-base lg:text-xl px-1 py-1.5 md:py-3 flex items-center justify-center uppercase" style="color: var(--pixel-green);">${g.name}</div>
                    ${this.is2026 ? `<div class="col-span-2 font-text text-[8px] md:text-sm lg:text-base text-white px-1 py-1.5 flex items-center justify-center border-l border-[#27272a]/50">${g.choix}</div>` : ''}
                    <div class="${colC} font-text text-[10px] md:text-lg lg:text-xl text-[var(--pixel-red)] px-1 py-1.5 md:py-3 flex items-center justify-center border-l border-[#27272a]/50">${g.contre}</div>
                    <div class="${colS} font-text text-[10px] md:text-xl lg:text-2xl text-white px-1 py-1.5 md:py-3 flex flex-col justify-center gap-0.5 border-l border-[#27272a]/50">${g.score.map(s => `<div>${s}</div>`).join('')}</div>
                    <div class="col-span-2 font-pixel text-[7px] md:text-sm lg:text-lg ${resCol} px-1 py-1.5 md:py-3 flex items-center justify-center uppercase border-l border-[#27272a]/50">${g.resultat}</div>
                    <div class="col-span-1 py-1.5 md:py-3 flex justify-center items-center border-l border-[#27272a]">${vDisp}</div>
                    ${this.is2026 ? `<time class="col-span-1 font-pixel italic text-[7px] md:text-xs lg:text-base text-slate-400 px-1 py-1.5 md:py-3 flex justify-center items-center border-l border-[#27272a]/50">${g.heure}</time>` : ''}
                </div>`;
        }).join('');

        let isOui = has(qualif, "OUI") || has(qualif, "WIN");
        let bgR = isOui ? "rgba(100, 255, 218, 0.1)" : (has(qualif, "EN ATTENTE") ? "rgba(255, 255, 255, 0.05)" : "rgba(229, 57, 53, 0.1)");
        let textR = isOui ? "var(--pixel-green)" : (has(qualif, "EN ATTENTE") ? "#94a3b8" : "var(--pixel-red)");
        let hHtml = this.is2026
            ? `<div class="col-span-2">JEUX</div><div class="col-span-2">CHOIX</div><div class="col-span-2">CONTRE QUI</div><div class="col-span-2">SCORE</div><div class="col-span-2">RÉSULTATS</div><div class="col-span-1">VIES</div><div class="col-span-1">LIVE</div>`
            : `<div class="col-span-3">JEUX</div><div class="col-span-3">CONTRE QUI ?</div><div class="col-span-3">SCORE</div><div class="col-span-2">RÉSULTATS</div><div class="col-span-1">VIES</div>`;

        return `
            <section class="pixel-card mt-6 md:mt-10 mx-2 md:mx-0">
                <header class="pixel-header-green px-3 py-4 md:px-5 md:p-6 flex flex-col justify-center items-center text-center relative">
                    <div class="text-slate-300 font-text text-base md:text-xl mb-1 tracking-widest">RÉSULTATS DE LA</div>
                    <h2 class="font-pixel text-lg md:text-3xl tracking-widest" style="color: var(--pixel-green);">PHASE DE KNOCKOUT</h2>
                </header>
                <div class="p-2 md:p-0">
                    <div class="w-full overflow-x-auto pb-2">
                        <div class="min-w-[800px]">
                            <div class="grid grid-cols-12 font-pixel text-[10px] md:text-sm text-slate-500 p-1.5 md:p-3 text-center bg-[#09090b] border-b border-[#27272a]">${hHtml}</div>
                            <div class="bg-[#0f0f13]">${gamesHtml}</div>
                        </div>
                    </div>
                </div>
                ${qualif ? `
                <div class="flex border-t-[3px] border-[#27272a] mt-auto flex-col md:flex-row">
                    <div class="bg-[#18181b] flex-1 p-2.5 md:p-3 flex items-center justify-center"><span class="font-text text-base md:text-2xl text-slate-400">QUALIFIÉ ?</span></div>
                    <div class="flex-1 p-2.5 md:p-3 flex items-center justify-center md:border-l-[3px] border-t-[3px] md:border-t-0 border-[#27272a]" style="background: ${bgR};">
                        <span class="font-pixel text-xl md:text-5xl" style="color: ${textR};">${qualif}</span>
                    </div>
                    ${score ? `<div class="bg-[#09090b] w-full md:w-[30%] p-2.5 md:p-3 flex items-center justify-center border-t-[3px] md:border-t-0 md:border-l-[3px] border-[#27272a]"><span class="font-pixel text-base md:text-2xl" style="color: var(--pixel-green);">${score}</span></div>` : ''}
                </div>` : ''}
            </section>`;
    }

    renderGroupBlock(data, start, lastIndex, state, blueCount) {
        const row = data[start];
        let groupTitle = row.find(c => isGroupPhase(c)) || row[0];
        let teamsTitle = "", teams = "", contreTitle = "", contre = "", games = [], qualifStatus = "", qualifStatusScore = "";
        let isFinale = has(groupTitle, "PHASE FINALE"), isElim = has(groupTitle, "ÉLIMINATOIRE"), isRed = has(groupTitle, "PHASE A") || has(groupTitle, "PHASE À");

        let j = start + 1;
        while (j < data.length && !isGroupPhase(data[j]) && j !== lastIndex) {
            let sub = data[j];
            let qIdx = sub.findIndex(c => has(c, "QUALIFIÉ") || has(c, "WIN"));

            if (qIdx !== -1) {
                let vals = sub.slice(qIdx + 1).filter(v => v.trim() !== "");
                qualifStatus = vals[0] || ""; qualifStatusScore = vals[1] || "";
                let isO = has(qualifStatus, "OUI") || has(qualifStatus, "WIN");
                if (isFinale && isO) { state.tournamentOver = true; state.tournamentWon = true; }
                else if (!isO && !has(qualifStatus, "EN ATTENTE") && qualifStatus.trim()) state.tournamentOver = true;
            } else if (sub.some(c => {
                const tc = normalizeText(c);
                return tc.includes("teams presentes") || tc.includes("contre");
            })) {
                let pIdx = sub.findIndex(c => normalizeText(c).includes("teams presentes")), cIdx = sub.findIndex(c => normalizeText(c).includes("contre"));
                if (pIdx !== -1) {
                    teamsTitle = sub[pIdx];
                    teams = sub.slice(pIdx + 1).find(c => c?.trim() && !has(c, "CONTRE")) || (data[j+1] && data[j+1][pIdx]?.trim() && !has(data[j+1][pIdx], "JEUX") ? data[j+1][pIdx] : "");
                }
                if (cIdx !== -1) {
                    contreTitle = sub[cIdx];
                    contre = sub.slice(cIdx + 1).find(c => c?.trim() && !has(c, "TEAMS")) || (data[j+1] && data[j+1][cIdx]?.trim() && !has(data[j+1][cIdx], "JEUX") ? data[j+1][cIdx] : "");
                }
            } else if (sub.some(c => c?.trim()) && !has(sub[0], "JEUX") && !has(sub[0], "PHASE")) {
                const isVal = (teams && has(sub[0], teams)) || (contre && has(sub[0], contre)) || (sub[0]?.trim() === "???");
                if (!isVal && sub[0]?.trim()) {
                    if ((sub[4]?.trim()) || (sub[7]?.trim()) || (sub[0].length < 50)) {
                        games.push({ name: sub[0], placeJeu: sub[4] || sub[3] || '', place: sub[7] || sub[6] || '', heure: sub[8] || sub[9] || '' });
                    }
                }
            }
            j++;
        }

        let hClass = isFinale ? "pixel-header-violet" : (isRed ? "pixel-header-red" : "pixel-header-blue");
        let tColor = isFinale ? "var(--pixel-violet)" : (isRed ? "var(--pixel-red)" : "var(--pixel-blue)");
        if (!isFinale && !isRed) {
            const shades = ["#60a5fa", "#3b82f6", "#2563eb", "#1d4ed8", "#1e40af"];
            tColor = shades[blueCount % shades.length];
            blueCount++;
        }

        let gHtml = games.map((g, idx) => {
            let resT = isFinale ? (g.placeJeu || g.place) : g.place;
            let pColor = has(resT, "EN ATTENTE") ? "#94a3b8" : (has(resT, "GAGNÉ") || has(resT, "VICTOIRE") ? "var(--pixel-green)" : (has(resT, "PERDU") || has(resT, "DÉFAITE") ? "var(--pixel-red)" : tColor));
            
            if (isFinale) {
                let cJ = this.is2026 ? 'col-span-7' : 'col-span-8', cR = this.is2026 ? 'col-span-3' : 'col-span-4';
                return `<div class="grid grid-cols-12 gap-0 items-stretch border-b border-black/50 last:border-0 hover:bg-white/5 transition-colors ${idx % 2 === 0 ? "bg-[#18181b]" : "bg-[#27272a]/50"}">
                            <div class="${cJ} font-pixel text-[9px] md:text-base lg:text-xl uppercase px-1 py-1.5 md:py-3 flex items-center justify-center text-center" title="${g.name}" style="color: ${tColor};">${g.name}</div>
                            <div class="${cR} font-pixel text-[10px] md:text-lg lg:text-2xl py-1.5 md:py-3 px-1 flex items-center justify-center border-l border-[#27272a]" style="color: ${pColor};">${resT}</div>
                            ${this.is2026 ? `<time class="col-span-2 font-pixel italic text-[7px] md:text-xs lg:text-base text-slate-400 py-1.5 md:py-3 px-1 flex items-center justify-center border-l border-[#27272a]">${g.heure}</time>` : ''}
                        </div>`;
            } else if (isElim) {
                return `<div class="grid grid-cols-12 gap-0 items-stretch border-b border-black/50 last:border-0 hover:bg-white/5 transition-colors ${idx % 2 === 0 ? "bg-[#18181b]" : "bg-[#27272a]/50"}">
                            <div class="col-span-4 font-pixel text-[9px] md:text-base lg:text-xl uppercase px-1 py-1.5 md:py-3 flex items-center justify-center text-center" title="${g.name}" style="color: ${tColor};">${g.name}</div>
                            <div class="col-span-4 font-text text-[10px] md:text-lg lg:text-xl text-slate-400 py-1.5 md:py-3 px-1 flex items-center justify-center border-l border-[#27272a]">${g.placeJeu}</div>
                            <div class="col-span-4 font-pixel text-[10px] md:text-lg lg:text-xl py-1.5 md:py-3 px-1 flex items-center justify-center border-l border-[#27272a]" style="color: ${pColor};">${resT}</div>
                        </div>`;
            } else {
                let cRJ = this.is2026 ? 'col-span-3' : 'col-span-4', cP = this.is2026 ? 'col-span-3' : 'col-span-4';
                return `<div class="grid grid-cols-12 gap-0 items-stretch border-b border-black/50 last:border-0 hover:bg-white/5 transition-colors ${idx % 2 === 0 ? "bg-[#18181b]" : "bg-[#27272a]/50"}">
                            <div class="col-span-4 font-pixel text-[9px] md:text-base lg:text-xl uppercase px-1 py-1.5 md:py-3 flex items-center justify-center text-center" title="${g.name}" style="color: ${tColor};">${g.name}</div>
                            <div class="${cRJ} font-text text-[10px] md:text-lg lg:text-xl text-slate-400 py-1.5 md:py-3 px-1 flex items-center justify-center border-l border-[#27272a]">${g.placeJeu}</div>
                            <div class="${cP} font-pixel text-[10px] md:text-lg lg:text-xl py-1.5 md:py-3 px-1 flex items-center justify-center border-l border-[#27272a]" style="color: ${pColor};">${g.place}</div>
                            ${this.is2026 ? `<time class="col-span-2 font-pixel italic text-[7px] md:text-xs lg:text-base text-slate-400 py-1.5 md:py-3 px-1 flex items-center justify-center border-l border-[#27272a]">${g.heure}</time>` : ''}
                        </div>`;
            }
        }).join('');

        let hHtml = isFinale ? (this.is2026 ? `<div class="col-span-7">JEUX</div><div class="col-span-3">RÉSULTATS</div><div class="col-span-2">LIVE</div>` : `<div class="col-span-8">JEUX</div><div class="col-span-4">RÉSULTATS</div>`)
                    : (isElim ? `<div class="col-span-4">JEUX</div><div class="col-span-4">RÉSULTATS SUR LE JEU</div><div class="col-span-4">WIN?</div>`
                    : (this.is2026 ? `<div class="col-span-4">JEUX</div><div class="col-span-3">RÉSULTATS DU JEU</div><div class="col-span-3">PLACE</div><div class="col-span-2">LIVE</div>`
                    : `<div class="col-span-4">JEUX</div><div class="col-span-4">RÉSULTATS DU JEU</div><div class="col-span-4">PLACE</div>`));

        let qHtml = "";
        if (qualifStatus) {
            let isO = has(qualifStatus, "OUI") || has(qualifStatus, "WIN");
            let bgR = isO ? "rgba(100, 255, 218, 0.1)" : (has(qualifStatus, "EN ATTENTE") ? "rgba(255, 255, 255, 0.05)" : "rgba(229, 57, 53, 0.1)");
            let textR = isO ? "var(--pixel-green)" : (has(qualifStatus, "EN ATTENTE") ? "#94a3b8" : "var(--pixel-red)");
            qHtml = `
                <div class="flex border-t-[3px] border-[#27272a] mt-auto flex-col md:flex-row">
                    <div class="bg-[#18181b] flex-1 p-2.5 md:p-3 flex items-center justify-center"><span class="font-text text-base md:text-2xl text-slate-400">${isFinale ? "WIN ?" : "QUALIFIÉ ?"}</span></div>
                    <div class="flex-1 p-2.5 md:p-3 flex items-center justify-center md:border-l-[3px] border-t-[3px] md:border-t-0 border-[#27272a]" style="background: ${bgR};">
                        <span class="font-pixel text-xl md:text-5xl" style="color: ${textR};">${qualifStatus}</span>
                    </div>
                    ${qualifStatusScore ? `<div class="bg-[#09090b] w-full md:w-[30%] p-2.5 md:p-3 flex items-center justify-center border-t-[3px] md:border-t-0 md:border-l-[3px] border-[#27272a]"><span class="font-pixel text-base md:text-2xl" style="color: ${tColor};">${qualifStatusScore}</span></div>` : ''}
                </div>`;
        }

        let tHtml = (contreTitle && teamsTitle) ? `
            <div class="flex flex-col md:flex-row border-b-2 border-[#27272a]">
                <div class="flex-1 flex flex-col md:border-r-2 border-[#27272a]">
                    <div class="bg-[rgba(88,101,242,0.15)] p-2 md:p-3 text-center font-text text-base md:text-2xl text-slate-300 border-b border-[#27272a]">${contreTitle}</div>
                    <div class="bg-[rgba(229,57,53,0.1)] p-2 md:p-4 text-center font-pixel text-sm md:text-xl text-[var(--pixel-red)] h-full flex items-center justify-center">${contre}</div>
                </div>
                <div class="flex-1 flex flex-col">
                    <div class="bg-[rgba(88,101,242,0.15)] p-2 md:p-3 text-center font-text text-base md:text-2xl text-slate-300 border-b border-[#27272a]">${teamsTitle}</div>
                    <div class="bg-[rgba(245,158,11,0.15)] p-2 md:p-4 text-center font-pixel text-sm md:text-xl text-[var(--pixel-orange)] h-full flex items-center justify-center">${teams}</div>
                </div>
            </div>` : (teamsTitle || teams ? `
            ${teamsTitle ? `<div class="bg-[rgba(88,101,242,0.15)] p-2 md:p-3 text-center font-text text-base md:text-2xl text-slate-300 border-b border-[#27272a]">${teamsTitle}</div>` : ''}
            ${teams ? `<div class="bg-[rgba(245,158,11,0.15)] p-2 md:p-4 text-center font-pixel text-sm md:text-xl text-[var(--pixel-orange)] border-b-2 border-[#27272a]">${teams}</div>` : ''}
        ` : '');

        let chunk = `
            <article class="pixel-card mt-6 md:mt-10 flex flex-col h-full mx-2 md:mx-0">
                <header class="${hClass} px-3 py-4 md:px-5 md:p-6 flex flex-col justify-center items-center text-center relative">
                    <div class="text-slate-300 font-text text-base md:text-xl mb-1 tracking-widest">RÉSULTATS DE LA</div>
                    <h2 class="font-pixel text-lg md:text-3xl tracking-widest" style="color: ${tColor};">${groupTitle}</h2>
                </header>
                ${tHtml}
                <div class="flex-grow bg-[#0f0f13] p-2 md:p-0 border-t border-[#27272a] md:border-0">
                    <div class="w-full overflow-x-auto pb-2">
                        <div class="min-w-[600px]">
                            <div class="grid grid-cols-12 gap-0 font-pixel text-[10px] md:text-sm text-slate-500 p-1.5 md:p-2 text-center bg-[#09090b] border-b border-[#27272a]">${hHtml}</div>
                            ${gHtml || '<div class="p-6 md:p-8 text-center text-slate-600 font-text text-lg md:text-2xl pt-8 md:pt-10">EN ATTENTE...</div>'}
                        </div>
                    </div>
                </div>
                ${qHtml}
            </article>`;
        
        state.groupFinished = qualifStatus && !has(qualifStatus, "EN ATTENTE");
        return { chunk, nextIndex: j, blueCount };
    }

    async checkTwitchLive() {
        const streamers = ["theguill84", "nykho"];
        await Promise.all(streamers.map(async (streamer) => {
            try {
                const response = await fetch(`https://decapi.me/twitch/uptime/${streamer}`);
                const text = await response.text();
                const isLive = !text.includes("offline") && !text.includes("Error") && !text.includes("User not found");
                
                const liveBadge = document.getElementById(`live-${streamer}`);
                const linkElement = document.getElementById(`link-${streamer}`);
                if (liveBadge && linkElement) {
                    liveBadge.classList.toggle('hidden', !isLive);
                    const activeColor = streamer === "theguill84" ? "text-[var(--pixel-orange)]" : "text-[#9146FF]";
                    linkElement.classList.toggle(activeColor, isLive);
                    linkElement.classList.toggle('text-slate-400', !isLive);
                }
            } catch (e) {}
        }));
    }

    getMockData() {
        return [
            ["TEAM : LES MOCKERS FOUS"], [""], ["PHASE DE SEEDING"],
            ["JEUX", "", "", "PLACE", "", "", "", "", "", "HEURE"],
            ["MINECRAFT", "", "", "TOP 3", "", "", "", "", "", "13:00"],
            ["TRACKMANIA", "", "", "1ER", "", "", "", "", "", "14:00"],
            ["", "", "", ">> SEEDING", "2"], [""], ["PHASE DE KNOCKOUT"],
            ["JEUX", "", "", "CHOIX", "CONTRE QUI", "", "SCORE", "RÉSULTATS", "VIES", "LIVE"],
            ["WORMS", "", "", "OUI", "LES TARDTARDS", "", "2-0", "GAGNÉ", "3", "15:00"],
            ["TETRIS", "", "", "NON", "LES TARDTARDS", "", "1-3", "PERDU", "2", "16:00"],
            ["CULT OF THE LAMB", "", "", "OUI", "AUTRE TEAM", "", "3-0", "GAGNÉ", "2", "17:00"],
            ["", "", "QUALIFIÉ ?", "OUI", "2-1"], [""], ["PHASE ÉLIMINATOIRE (16 ÉQUIPES)"],
            ["CONTRE QUI ?", "", "", "TEAMS PRÉSENTES"], ["???", "", "", "???"],
            ["JEUX", "", "", "", "RÉSULTATS SUR LE JEU", "", "", "WIN?"],
            ["MINECRAFT", "", "", "", "1ER", "", "", "OUI"],
            ["VALORANT", "", "", "", "13-5", "", "", "OUI"],
            ["", "", "QUALIFIÉ ?", "OUI", "2-0"], [""], ["PHASE FINALE"],
            ["JEUX", "", "", "", "", "", "", "RÉSULTATS", "LIVE"],
            ["JEU MYSTÈRE", "", "", "", "VICTOIRE", "", "", "1ER", "21:00"],
            ["", "", "WIN ?", "OUI", "CHAMPIONS"], [""], ["WIN !"]
        ];
    }
}

// Gestion du bouton de retour en haut
document.addEventListener("DOMContentLoaded", () => {
    const scrollTopBtn = document.getElementById("scrollTopBtn");
    if (scrollTopBtn) {
        let isScrolling = false;
        window.addEventListener("scroll", () => {
            if (!isScrolling) {
                window.requestAnimationFrame(() => {
                    scrollTopBtn.classList.toggle("opacity-0", window.scrollY <= 300);
                    scrollTopBtn.classList.toggle("pointer-events-none", window.scrollY <= 300);
                    scrollTopBtn.classList.toggle("opacity-100", window.scrollY > 300);
                    scrollTopBtn.classList.toggle("pointer-events-auto", window.scrollY > 300);
                    isScrolling = false;
                });
                isScrolling = true;
            }
        }, { passive: true });
        scrollTopBtn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
    }
});
