// dashboard_dev.js
/**
 * ZLAN Dashboard 2026 - Optimized Core Logic
 * Author: Antigravity AI
 */

const normalizeText = (str) => String(str || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
const has = (cell, text) => normalizeText(cell).includes(normalizeText(text));

const isGroupPhase = (row) => {
    if (!row) return false;
    const cells = Array.isArray(row) ? row.slice(0, 3) : [row];
    return cells.some(cell => {
        const t = normalizeText(cell);
        if (t.includes("seeding") || t.includes("knockout")) return false;
        return t.includes("phase") || t.includes("finale") || t.includes("eliminatoire") ||
            t.includes("demi") || t.includes("quart") || t.includes("huitieme") ||
            t.includes("groupe") || t.includes("tournoi");
    });
};

class ZlanDashboard {
    constructor(encodedUrl, enableTwitchLive = false, avatarUrl = null, is2026Format = false, useMockData = false) {
        this.sheetUrl = encodedUrl ? atob(encodedUrl) : "";
        this.enableTwitchLive = enableTwitchLive;
        this.avatarUrl = avatarUrl;
        this.is2026 = is2026Format;
        this.useMockData = useMockData;
        this.isFetching = false;
        this.lastRawData = "";

        this.init();
        if (this.enableTwitchLive) {
            this.checkTwitchLive();
            setInterval(() => this.checkTwitchLive(), 120000);
        }
    }

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
                    if (results && results.data) this.handleData(results.data);
                    this.isFetching = false;
                    this.updateStatus("SYNC OK", "green");
                    setTimeout(() => this.init(), 30000);
                },
                error: (err) => {
                    this.updateStatus("ERREUR PARSE", "red");
                    this.isFetching = false;
                    setTimeout(() => this.init(), 30000);
                }
            });
        } catch (error) {
            this.updateStatus("HORS LIGNE", "red");
            this.isFetching = false;
            setTimeout(() => this.init(), 30000);
        }
    }

    updateStatus(label, colorType) {
        const statusEl = document.getElementById('status');
        if (!statusEl) return;
        const colors = { green: "#64ffda", red: "#e53935", violet: "#8b5cf6" };
        const c = colors[colorType] || colors.green;
        const time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        statusEl.innerHTML = `<span class="w-2 h-2 md:w-2.5 md:h-2.5" style="background: ${c}; box-shadow: 0 0 8px ${c}"></span> <span style="color: ${c}" class="whitespace-nowrap uppercase tracking-tighter">${label} (${time})</span>`;
    }

    handleData(data) {
        if (!data || !data.length) return;
        this.buildDashboard(data);
    }

    buildDashboard(data) {
        let htmlChunks = { team: "", seeding: "", knockout: "", groups: "", finalRank: "" };
        let state = { tournamentOver: false, tournamentWon: false };
        let timeline = {
            seeding: { exists: false, finished: false, target: "section-seeding", completedMatches: 0 },
            knockout: { exists: false, finished: false, target: "section-knockout", completedMatches: 0 },
            eliminatoire: { exists: false, finished: false, target: "", completedMatches: 0 },
            carre: { exists: false, finished: false, target: "", completedMatches: 0 },
            finale: { exists: false, finished: false, target: "section-finale", completedMatches: 0 }
        };
        let gameStats = { total: 0, completed: 0 };
        let bluePhaseCount = 0;
        let redPhaseCount = 0;
        let lastValidRowIndex = -1;
        for (let r = data.length - 1; r >= 0; r--) {
            if (data[r] && data[r].some(c => c && String(c).trim() !== "")) {
                lastValidRowIndex = r;
                break;
            }
        }

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const r0 = String(row[0] || "");
            const isLastRow = (i === lastValidRowIndex);

            if (isLastRow) {
                htmlChunks.finalRank = this.renderFinalRankBlock(row, r0, state);
            }

            if (state.tournamentOver && !isLastRow) continue;

            let teamText = row.find(c => has(c, "TEAM :") || has(c, "TEAM:"));
            if (teamText) {
                htmlChunks.team = this.renderTeamBlock(teamText);
            }
            else if (has(r0, "PHASE DE SEEDING")) {
                let { games, seedingScore, nextIndex } = this.parseSeeding(data, i, lastValidRowIndex);
                htmlChunks.seeding = this.renderSeedingBlock(games, seedingScore);
                let phaseTotal = games.length;
                let phaseCompleted = games.filter(g => g.place && String(g.place).trim() !== "" && !has(g.place, "???") && !has(g.place, "ATTENTE")).length;

                timeline.seeding.exists = true;
                timeline.seeding.finished = phaseTotal > 0 && phaseCompleted === phaseTotal;
                timeline.seeding.completedMatches = phaseCompleted;

                gameStats.total += phaseTotal;
                gameStats.completed += phaseCompleted;

                i = nextIndex - 1;
            }
            else if (has(r0, "PHASE DE KNOCKOUT")) {
                let { games, qualif, score, nextIndex } = this.parseKnockout(data, i, lastValidRowIndex, state);
                htmlChunks.knockout = this.renderKnockoutBlock(games, qualif, score);
                let phaseTotal = games.length;
                let phaseCompleted = games.filter(g => g.resultat && String(g.resultat).trim() !== "" && !has(g.resultat, "???") && !has(g.resultat, "ATTENTE")).length;

                timeline.knockout.exists = true;
                timeline.knockout.finished = phaseTotal > 0 && phaseCompleted === phaseTotal;
                timeline.knockout.completedMatches = phaseCompleted;

                gameStats.total += phaseTotal;
                gameStats.completed += phaseCompleted;

                i = nextIndex - 1;
            }
            else if (isGroupPhase(row)) {
                let groupTitle = row.find(c => isGroupPhase(c)) || row[0];
                let isF = has(groupTitle, "PHASE FINALE");
                let isR = has(groupTitle, "PHASE A") || has(groupTitle, "PHASE À") || has(groupTitle, "PHASE À 3 ÉQUIPES");
                let { chunk, nextIndex, blueCount, redCount, qStatus, gamesCount, completedCount, articleId } = this.renderGroupBlock(data, i, lastValidRowIndex, state, bluePhaseCount, redPhaseCount);
                htmlChunks.groups += chunk;
                let isFinished = gamesCount > 0 && completedCount === gamesCount;
                if (isF) {
                    timeline.finale.exists = true;
                    if (state.tournamentWon || isFinished) timeline.finale.finished = true;
                    timeline.finale.completedMatches += completedCount;
                } else if (isR) {
                    timeline.carre.completedMatches += completedCount;
                    if (!timeline.carre.exists) {
                        timeline.carre.exists = true;
                        timeline.carre.finished = isFinished;
                        timeline.carre.target = articleId;
                    } else {
                        timeline.carre.finished = timeline.carre.finished && isFinished;
                    }
                    if (has(groupTitle, "4 ÉQUIPES") || has(groupTitle, "4 EQUIPES")) {
                        timeline.carre.target = articleId;
                    }
                } else {
                    if (!timeline.eliminatoire.exists) {
                        timeline.eliminatoire.exists = true;
                        timeline.eliminatoire.finished = isFinished;
                        timeline.eliminatoire.target = articleId;
                    } else {
                        timeline.eliminatoire.finished = timeline.eliminatoire.finished && isFinished;
                    }
                    timeline.eliminatoire.completedMatches += completedCount;
                    if (has(groupTitle, "32 ÉQUIPES") || has(groupTitle, "PHASE ÉLIMINATOIRE (32 ÉQUIPES)")) {
                        timeline.eliminatoire.target = articleId;
                    }
                }

                gameStats.total += gamesCount;
                gameStats.completed += completedCount;

                bluePhaseCount = blueCount;
                redPhaseCount = redCount;
                i = nextIndex - 1;
            }
        }

        const container = document.getElementById('dashboard-container');
        if (container) {
            const trackerHtml = this.renderTracker(timeline, state, gameStats);
            
            // Construction conditionnelle pour ne pas encombrer le dashboard
            let fullHtml = htmlChunks.team + trackerHtml + htmlChunks.seeding;

            // On affiche le Knockout si le Seeding est fini OU si le Knockout a commencé
            if (timeline.seeding.finished || timeline.knockout.completedMatches > 0) {
                fullHtml += htmlChunks.knockout;
            }

            // On affiche les Groupes si le Knockout est fini OU si un match de groupe est complété
            const groupStarted = gameStats.completed > (timeline.seeding.completedMatches + timeline.knockout.completedMatches);
            if (timeline.knockout.finished || groupStarted) {
                if (htmlChunks.groups) fullHtml += `<div>${htmlChunks.groups}</div>`;
            }

            // On affiche le rang final uniquement si le tournoi est fini
            if (state.tournamentOver) {
                fullHtml += htmlChunks.finalRank;
            }

            if (container.innerHTML !== fullHtml && fullHtml.trim() !== "") {
                container.innerHTML = fullHtml;
            }
        }
    }

    renderTeamBlock(teamText) {
        let cleanTeam = teamText.replace(/TEAM\s*:/i, '').trim();
        let avatarHtml = this.avatarUrl ? `<div class="flex-shrink-0 transition-transform duration-300 hover:scale-105" style="filter: drop-shadow(6px 6px 0px rgba(0,0,0,0.8));"><div class="bg-[var(--pixel-orange)] p-[4px]" style="clip-path: polygon(8px 0, calc(100% - 8px) 0, calc(100% - 8px) 8px, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 8px calc(100% - 8px), 0 calc(100% - 8px), 0 8px, 8px 8px);"><img src="${this.avatarUrl}" alt="Avatar" class="h-[80px] md:h-[140px] lg:h-[180px] w-auto max-w-full object-cover block" style="clip-path: polygon(4px 0, calc(100% - 4px) 0, calc(100% - 4px) 4px, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 4px calc(100% - 4px), 0 calc(100% - 4px), 0 4px, 4px 4px);"></div></div>` : '';
        return `<section class="mb-6 md:mb-12 flex justify-center w-full px-2 md:px-0"><div class="pixel-card border-b-4 px-4 py-5 md:px-8 md:p-8 w-full max-w-[920px]" style="border-bottom-color: var(--pixel-orange);"><div class="flex flex-col md:flex-row items-center justify-center gap-5 md:gap-8">${avatarHtml}<div class="flex flex-col items-center md:items-start text-center md:text-left"><h1 class="text-[var(--pixel-orange)] font-text text-base md:text-xl lg:text-2xl mb-2 tracking-widest drop-shadow-[0_0_6px_rgba(245,158,11,0.5)]">>> JOUEURS ENGAGÉS <<</h1><p class="text-2xl md:text-4xl lg:text-5xl font-pixel text-white tracking-wider leading-snug">${cleanTeam}</p></div></div></div></section>`;
    }

    renderFinalRankBlock(row, r0, state) {
        let finalRankText = r0 || row.find(c => (c || '').trim()) || "";
        const exitKeywords = ["ÉLIMINÉ", "ELIMINE", "GAGNÉ", "GAGNE", "CHAMPION", "VICTOIRE", "DÉFAITE", "TOP", "CLASSEMENT", "FINI", "1ER", "2EME", "3EME"];
        const isExplicitEnd = exitKeywords.some(kw => has(finalRankText, kw));
        if (isExplicitEnd) state.tournamentOver = true;
        const isHeaderOnly = (has(finalRankText, "PHASE") || has(finalRankText, "JEUX") || has(finalRankText, "QUALIFIÉ") || has(finalRankText, "WIN ?")) && !isExplicitEnd;
        if (state.tournamentOver && !isHeaderOnly && finalRankText?.trim()) {
            if (isHeaderOnly) finalRankText = state.tournamentWon ? "CHAMPIONS !" : "TOURNOI TERMINÉ";
            let isWin = state.tournamentWon || ["WIN", "1ER", "GAGNÉ", "OUI", "TOP 1", "CHAMPIONS", "VICTOIRE"].some(kw => has(finalRankText, kw));
            if (isWin) state.tournamentWon = true;
            let c = state.tournamentWon ? "var(--pixel-green)" : "var(--pixel-red)";
            let bg = state.tournamentWon ? "rgba(100, 255, 218, 0.08)" : "rgba(229, 57, 53, 0.08)";
            let sh = state.tournamentWon ? "rgba(100, 255, 218, 0.3)" : "rgba(229, 57, 53, 0.3)";
            return `<section class="pixel-animate-enter mt-10 md:mt-16 mb-12 md:mb-20 flex justify-center w-full px-2 md:px-0"><div class="pixel-card border-4 px-6 py-8 md:px-12 md:py-16 w-full max-w-[800px] relative overflow-hidden" style="border-color: ${c}; text-align: center; background: ${bg}; box-shadow: 0 0 30px ${sh}, 8px 8px 0px rgba(0,0,0,0.9);"><div class="absolute top-0 left-0 w-full h-1 opacity-50" style="background: ${c};"></div><h2 class="text-slate-400 font-text text-xl md:text-4xl mb-4 tracking-[0.2em] uppercase">RÉSULTAT FINAL</h2><p class="text-3xl md:text-7xl font-pixel tracking-widest animate-pulse" style="color: ${c}; text-shadow: 4px 4px 0px rgba(0,0,0,0.8);">${finalRankText.toUpperCase()}</p><div class="mt-6 flex justify-center gap-4 opacity-30"><span style="color: ${c};">★</span><span style="color: ${c};">★</span><span style="color: ${c};">★</span></div></div></section>`;
        }
        return "";
    }

    parseSeeding(data, start, lastIndex) {
        let games = [], seedingScore = "", j = start + 1;
        while (j < data.length && !has(String(data[j][0] || ""), "PHASE DE KNOCKOUT")) {
            let sub = data[j];
            if (sub[0] && !has(sub[0], "JEUX")) games.push({ name: sub[0], place: sub[3], heure: sub[9] || sub[10] || '' });
            let sIdx = sub.findIndex(c => has(c, ">> SEEDING") || has(c, "SEED FINALE") || has(c, "CLASSEMENT FINAL"));
            if (sIdx !== -1) {
                let found = sub.slice(sIdx + 1).find(v => v && String(v).trim() !== "");
                if (found) seedingScore = found;
            }
            if (j === lastIndex) { j++; break; }
            j++;
        }
        return { games, seedingScore, nextIndex: j };
    }

    renderSeedingBlock(games, score) {
        let gHtml = games.map((g, idx) => `<div class="grid ${this.is2026 ? 'grid-cols-6' : 'grid-cols-4'} text-center items-stretch border-b border-black/50 last:border-0 hover:bg-white/5 transition-colors ${idx % 2 === 0 ? "bg-[#18181b]" : "bg-[#27272a]/50"}"><div class="col-span-2 font-pixel text-[9px] md:text-base lg:text-xl uppercase py-1.5 md:py-3 px-1 flex items-center justify-center" style="color: var(--pixel-orange);">${g.name}</div><div class="col-span-2 font-text text-sm md:text-xl lg:text-2xl ${g.place === '???' ? 'text-slate-600' : 'text-white'} py-1.5 md:py-3 px-1 flex items-center justify-center border-l border-[#27272a]/50">${g.place || '???'}</div>${this.is2026 ? `<time class="col-span-2 font-pixel italic text-[7px] md:text-xs lg:text-base text-slate-400 py-1.5 md:py-3 px-1 border-l border-[#27272a]/50 flex justify-center items-center">${g.heure}</time>` : ''}</div>`).join('');
        const displayScore = score || "EN ATTENTE...";
        const isWaiting = has(displayScore, 'EN ATTENTE');
        const scoreFooter = `<div class="flex border-t-[3px] border-[#27272a] mt-auto flex-col md:flex-row"><div class="bg-[#18181b] flex-1 p-2.5 md:p-3 flex items-center justify-center"><span class="font-text text-base md:text-2xl text-slate-400">SEED FINALE</span></div><div class="flex-1 p-2.5 md:p-3 flex items-center justify-center md:border-l-[3px] border-t-[3px] md:border-t-0 border-[#27272a]" style="background: ${isWaiting ? 'rgba(255, 255, 255, 0.05)' : 'rgba(245, 158, 11, 0.1)'};"><span class="font-pixel text-xl md:text-5xl" style="color: ${isWaiting ? '#94a3b8' : 'var(--pixel-orange)'};">${displayScore}</span></div></div>`;
        return `<section id="section-seeding" class="pixel-card mt-6 mx-2 md:mx-0"><header class="pixel-header-orange px-2.5 py-3 md:px-4 md:p-5 flex flex-col justify-center items-center text-center relative"><div class="text-slate-300 font-text text-sm md:text-xl mb-1 tracking-widest">RÉSULTATS DE LA</div><h2 class="font-pixel text-lg md:text-3xl tracking-widest" style="color: var(--pixel-orange);">PHASE DE SEEDING</h2></header><div class="p-2 md:p-0"><div class="w-full overflow-x-auto pb-2"><div class="min-w-[500px]"><div class="grid ${this.is2026 ? 'grid-cols-6' : 'grid-cols-4'} font-pixel text-[10px] md:text-sm text-slate-500 p-1.5 md:p-3 text-center bg-[#09090b] border-b border-[#27272a]"><div class="col-span-2">JEUX</div><div class="col-span-2">PLACE</div>${this.is2026 ? `<div class="col-span-2">HEURE DU LIVE :</div>` : ''}</div><div class="bg-[#0f0f13]">${gHtml}</div></div></div></div>${scoreFooter}</section>`;
    }

    parseKnockout(data, start, lastIndex, state) {
        let games = [], qualif = "", score = "", j = start + 1;
        while (j < data.length && !isGroupPhase(data[j])) {
            let sub = data[j];
            let qIdx = sub.findIndex(c => has(c, "QUALIFIÉ"));
            if (qIdx !== -1) {
                let vals = sub.slice(qIdx + 1).filter(v => v.trim() !== "");
                qualif = vals[0] || ""; score = vals[1] || "";
                let isO = has(qualif, "OUI") || has(qualif, "WIN");
                let isAttente = has(qualif, "EN ATTENTE") || qualif.trim() === "";
                if (!isO && !isAttente) state.tournamentOver = true;
            } else if (sub[0] && !has(sub[0], "JEUX") && !has(sub[0], "PHASE")) {
                if (this.is2026) games.push({ name: sub[0], choix: sub[3] || '', contre: sub[4] || '', score: [sub[6] || ''], resultat: sub[7] || '', vies: sub[8] || '', heure: sub[9] || '' });
                else games.push({ name: sub[0], choix: '', contre: sub[3] || '', score: [sub[5] || ''], resultat: sub[6] || '', vies: sub[7] || '', heure: '' });
            } else if (!sub[0] && (sub[6] || sub[5]) && games.length > 0) games[games.length - 1].score.push(sub[6] || sub[5]);
            if (j === lastIndex) { j++; break; }
            j++;
        }
        return { games, qualif, score, nextIndex: j };
    }

    renderKnockoutBlock(games, qualif, score) {
        let gHtml = games.map((g, idx) => {
            let rc = has(g.resultat, "GAGNÉ") || has(g.resultat, "VICTOIRE") ? "text-[var(--pixel-green)]" : (has(g.resultat, "PERDU") || has(g.resultat, "DÉFAITE") || has(g.resultat, "NON") ? "text-[var(--pixel-red)]" : (has(g.resultat, "ATTENTE") ? "text-slate-600" : "text-white"));
            let nv = parseInt(g.vies);
            let vd = !isNaN(nv) && nv > 0 ? `<div class="flex gap-1 justify-center flex-wrap" style="text-shadow: 1.5px 1.5px 0px rgba(0,0,0,0.8);">${Array(nv).fill('<span style="color: var(--pixel-red);">♥</span>').join('')}</div>` : (nv === 0 ? `<span class="font-pixel text-slate-600">X</span>` : `<span class="text-slate-700">-</span>`);
            let cJ = this.is2026 ? 'col-span-2' : 'col-span-3', cC = this.is2026 ? 'col-span-2' : 'col-span-3', cS = this.is2026 ? 'col-span-2' : 'col-span-3';
            return `<div class="grid grid-cols-12 text-[10px] text-center border-b border-black/50 last:border-0 hover:bg-white/5 items-stretch ${idx % 2 === 0 ? "bg-[#18181b]" : "bg-[#27272a]/50"}"><div class="${cJ} font-pixel text-[8px] md:text-base lg:text-xl px-1 py-1.5 md:py-3 flex items-center justify-center uppercase" style="color: var(--pixel-green);">${g.name}</div>${this.is2026 ? `<div class="col-span-2 font-text text-[8px] md:text-sm lg:text-base text-white px-1 py-1.5 flex items-center justify-center border-l border-[#27272a]/50">${g.choix}</div>` : ''}<div class="${cC} font-text text-[10px] md:text-lg lg:text-xl text-[var(--pixel-red)] px-1 py-1.5 md:py-3 flex items-center justify-center border-l border-[#27272a]/50">${g.contre}</div><div class="${cS} font-text text-[10px] md:text-xl lg:text-2xl text-white px-1 py-1.5 md:py-3 flex flex-col justify-center gap-0.5 border-l border-[#27272a]/50">${g.score.map(s => `<div>${s}</div>`).join('')}</div><div class="col-span-2 font-pixel text-[7px] md:text-sm lg:text-lg ${rc} px-1 py-1.5 md:py-3 flex items-center justify-center uppercase border-l border-[#27272a]/50">${g.resultat}</div><div class="col-span-1 py-1.5 md:py-3 flex justify-center items-center border-l border-[#27272a]">${vd}</div>${this.is2026 ? `<time class="col-span-1 font-pixel italic text-[7px] md:text-xs lg:text-base text-slate-400 px-1 py-1.5 md:py-3 flex justify-center items-center border-l border-[#27272a]/50">${g.heure}</time>` : ''}</div>`;
        }).join('');
        let iO = has(qualif, "OUI") || has(qualif, "WIN");
        let bgR = iO ? "rgba(100, 255, 218, 0.1)" : (has(qualif, "EN ATTENTE") ? "rgba(255, 255, 255, 0.05)" : "rgba(229, 57, 53, 0.1)");
        let tR = iO ? "var(--pixel-green)" : (has(qualif, "EN ATTENTE") ? "#94a3b8" : "var(--pixel-red)");
        let hH = this.is2026 ? `<div class="col-span-2">JEUX</div><div class="col-span-2">CHOIX</div><div class="col-span-2">CONTRE QUI</div><div class="col-span-2">SCORE</div><div class="col-span-2">RÉSULTATS</div><div class="col-span-1">VIES</div><div class="col-span-1">LIVE</div>` : `<div class="col-span-3">JEUX</div><div class="col-span-3">CONTRE QUI ?</div><div class="col-span-3">SCORE</div><div class="col-span-2">RÉSULTATS</div><div class="col-span-1">VIES</div>`;
        return `<section id="section-knockout" class="pixel-card mt-6 md:mt-10 mx-2 md:mx-0"><header class="pixel-header-green px-3 py-4 md:px-5 md:p-6 flex flex-col justify-center items-center text-center relative"><div class="text-slate-300 font-text text-base md:text-xl mb-1 tracking-widest">RÉSULTATS DE LA</div><h2 class="font-pixel text-lg md:text-3xl tracking-widest" style="color: var(--pixel-green);">PHASE DE KNOCKOUT</h2></header><div class="p-2 md:p-0"><div class="w-full overflow-x-auto pb-2"><div class="min-w-[800px]"><div class="grid grid-cols-12 font-pixel text-[10px] md:text-sm text-slate-500 p-1.5 md:p-3 text-center bg-[#09090b] border-b border-[#27272a]">${hH}</div><div class="bg-[#0f0f13]">${gHtml}</div></div></div></div>${qualif ? `<div class="flex border-t-[3px] border-[#27272a] mt-auto flex-col md:flex-row"><div class="bg-[#18181b] flex-1 p-2.5 md:p-3 flex items-center justify-center"><span class="font-text text-base md:text-2xl text-slate-400">QUALIFIÉ ?</span></div><div class="flex-1 p-2.5 md:p-3 flex items-center justify-center md:border-l-[3px] border-t-[3px] md:border-t-0 border-[#27272a]" style="background: ${bgR};"><span class="font-pixel text-xl md:text-5xl" style="color: ${tR};">${qualif}</span></div>${score ? `<div class="bg-[#09090b] w-full md:w-[30%] p-2.5 md:p-3 flex items-center justify-center border-t-[3px] md:border-t-0 md:border-l-[3px] border-[#27272a]"><span class="font-pixel text-base md:text-2xl" style="color: var(--pixel-green);">${score}</span></div>` : ''}</div>` : ''}</section>`;
    }

    renderGroupBlock(data, start, lastIndex, state, blueCount, redCount) {
        let groupTitle = data[start].find(c => isGroupPhase(c)) || data[start][0];
        let tTitle = "", teams = "", cTitle = "", contre = "", games = [], qStatus = "", qScore = "";
        let isF = has(groupTitle, "PHASE FINALE"), isE = has(groupTitle, "PHASE ÉLIMINATOIRE (32 ÉQUIPES)"), isR = has(groupTitle, "PHASE À 4 ÉQUIPES") || has(groupTitle, "PHASE À 3 ÉQUIPES");
        let j = start + 1;
        while (j < data.length && !isGroupPhase(data[j])) {
            let sub = data[j];
            let isHeaderRow = sub.some(c => has(c, "JEUX") || has(c, "PHASE") || has(c, "RÉSULTATS"));
            let qIdx = isHeaderRow ? -1 : sub.findIndex(c => has(c, "QUALIFIÉ") || has(c, "WIN"));

            if (qIdx !== -1) {
                let vals = sub.slice(qIdx + 1).filter(v => v.trim() !== "");
                qStatus = vals[0] || ""; qScore = vals[1] || "";
                let isO = has(qStatus, "OUI") || has(qStatus, "WIN");
                let isAttente = has(qStatus, "EN ATTENTE") || qStatus.trim() === "";

                if (isF && isO) { state.tournamentOver = true; state.tournamentWon = true; }
                else if (!isO && !isAttente) state.tournamentOver = true;
            } else if (sub.some(c => { const tc = normalizeText(c); return tc.includes("teams presentes") || tc.includes("contre"); })) {
                let pIdx = sub.findIndex(c => normalizeText(c).includes("teams presentes")), cIdx = sub.findIndex(c => normalizeText(c).includes("contre"));
                if (pIdx !== -1) { tTitle = sub[pIdx]; teams = sub.slice(pIdx + 1).find(c => (c || '').trim() && !has(c, "CONTRE")) || (data[j + 1] && (data[j + 1][pIdx] || '').trim() && !has(data[j + 1][pIdx], "JEUX") ? data[j + 1][pIdx] : ""); }
                if (cIdx !== -1) { cTitle = sub[cIdx]; contre = sub.slice(cIdx + 1).find(c => (c || '').trim() && !has(c, "TEAMS")) || (data[j + 1] && (data[j + 1][cIdx] || '').trim() && !has(data[j + 1][cIdx], "JEUX") ? data[j + 1][cIdx] : ""); }
            } else if (sub.some(c => (c || '').trim()) && !has(sub[0], "JEUX") && !has(sub[0], "PHASE")) {
                const isVal = (teams && has(sub[0], teams)) || (contre && has(sub[0], contre)) || ((sub[0] || '').trim() === "???");
                if (!isVal && (sub[0] || '').trim()) {
                    let pJ = sub[4] || sub[3] || sub[5] || sub[6] || "";
                    let p = sub[7] || sub[6] || sub[5] || sub[4] || "";
                    if (pJ === p) p = sub[7] || sub[6] || ""; // Avoid duplication if same column picked
                    if (pJ.trim() || p.trim() || sub[0].length < 50) {
                        games.push({ name: sub[0], placeJeu: pJ, place: p, heure: sub[8] || sub[9] || sub[10] || '' });
                    }
                }
            }
            if (j === lastIndex) { j++; break; }
            j++;
        }
        let hC = isF ? "pixel-header-violet" : (isR ? "pixel-header-red" : "pixel-header-blue");
        let tC = isF ? "var(--pixel-violet)" : (isR ? "var(--pixel-red)" : ["#60a5fa", "#3b82f6", "#2563eb", "#1d4ed8", "#1e40af"][blueCount % 5]);
        if (!isF && !isR) blueCount++;
        if (isR) redCount++;
        let gH = games.map((g, idx) => {
            let res = isF ? (g.placeJeu || g.place) : g.place;
            let pc = has(res, "EN ATTENTE") ? "#94a3b8" : (has(res, "GAGNÉ") || has(res, "VICTOIRE") ? "var(--pixel-green)" : (has(res, "PERDU") || has(res, "DÉFAITE") ? "var(--pixel-red)" : tC));
            if (isF) { let cJ = this.is2026 ? 'col-span-7' : 'col-span-8', cR = this.is2026 ? 'col-span-3' : 'col-span-4'; return `<div class="grid grid-cols-12 gap-0 items-stretch border-b border-black/50 last:border-0 hover:bg-white/5 transition-colors ${idx % 2 === 0 ? "bg-[#18181b]" : "bg-[#27272a]/50"}"><div class="${cJ} font-pixel text-[9px] md:text-base lg:text-xl uppercase px-1 py-1.5 md:py-3 flex items-center justify-center text-center" title="${g.name}" style="color: ${tC};">${g.name}</div><div class="${cR} font-pixel text-[10px] md:text-lg lg:text-2xl py-1.5 md:py-3 px-1 flex items-center justify-center border-l border-[#27272a]" style="color: ${pc};">${res}</div>${this.is2026 ? `<time class="col-span-2 font-pixel italic text-[7px] md:text-xs lg:text-base text-slate-400 py-1.5 md:py-3 px-1 flex items-center justify-center border-l border-[#27272a]">${g.heure}</time>` : ''}</div>`; }
            else if (isE) return `<div class="grid grid-cols-12 gap-0 items-stretch border-b border-black/50 last:border-0 hover:bg-white/5 transition-colors ${idx % 2 === 0 ? "bg-[#18181b]" : "bg-[#27272a]/50"}"><div class="col-span-4 font-pixel text-[9px] md:text-base lg:text-xl uppercase px-1 py-1.5 md:py-3 flex items-center justify-center text-center" title="${g.name}" style="color: ${tC};">${g.name}</div><div class="col-span-4 font-text text-[10px] md:text-lg lg:text-xl text-slate-400 py-1.5 md:py-3 px-1 flex items-center justify-center border-l border-[#27272a]">${g.placeJeu}</div><div class="col-span-4 font-pixel text-[10px] md:text-lg lg:text-xl py-1.5 md:py-3 px-1 flex items-center justify-center border-l border-[#27272a]" style="color: ${pc};">${res}</div></div>`;
            else { let cRJ = this.is2026 ? 'col-span-3' : 'col-span-4', cP = this.is2026 ? 'col-span-3' : 'col-span-4'; return `<div class="grid grid-cols-12 gap-0 items-stretch border-b border-black/50 last:border-0 hover:bg-white/5 transition-colors ${idx % 2 === 0 ? "bg-[#18181b]" : "bg-[#27272a]/50"}"><div class="col-span-4 font-pixel text-[9px] md:text-base lg:text-xl uppercase px-1 py-1.5 md:py-3 flex items-center justify-center text-center" title="${g.name}" style="color: ${tC};">${g.name}</div><div class="${cRJ} font-text text-[10px] md:text-lg lg:text-xl text-slate-400 py-1.5 md:py-3 px-1 flex items-center justify-center border-l border-[#27272a]">${g.placeJeu}</div><div class="${cP} font-pixel text-[10px] md:text-lg lg:text-xl py-1.5 md:py-3 px-1 flex items-center justify-center border-l border-[#27272a]" style="color: ${pc};">${g.place}</div>${this.is2026 ? `<time class="col-span-2 font-pixel italic text-[7px] md:text-xs lg:text-base text-slate-400 py-1.5 md:py-3 px-1 flex items-center justify-center border-l border-[#27272a]">${g.heure}</time>` : ''}</div>`; }
        }).join('');
        let hH = isF ? (this.is2026 ? `<div class="col-span-7">JEUX</div><div class="col-span-3">RÉSULTATS</div><div class="col-span-2">LIVE</div>` : `<div class="col-span-8">JEUX</div><div class="col-span-4">RÉSULTATS</div>`) : (isE ? `<div class="col-span-4">JEUX</div><div class="col-span-4">RÉSULTATS SUR LE JEU</div><div class="col-span-4">WIN?</div>` : (this.is2026 ? `<div class="col-span-4">JEUX</div><div class="col-span-3">RÉSULTATS DU JEU</div><div class="col-span-3">PLACE</div><div class="col-span-2">LIVE</div>` : `<div class="col-span-4">JEUX</div><div class="col-span-4">RÉSULTATS DU JEU</div><div class="col-span-4">PLACE</div>`));
        let qH = ""; if (qStatus) { let isO = has(qStatus, "OUI") || has(qStatus, "WIN"); let bg = isO ? "rgba(100, 255, 218, 0.1)" : (has(qStatus, "EN ATTENTE") ? "rgba(255, 255, 255, 0.05)" : "rgba(229, 57, 53, 0.1)"); let tr = isO ? "var(--pixel-green)" : (has(qStatus, "EN ATTENTE") ? "#94a3b8" : "var(--pixel-red)"); qH = `<div class="flex border-t-[3px] border-[#27272a] mt-auto flex-col md:flex-row"><div class="bg-[#18181b] flex-1 p-2.5 md:p-3 flex items-center justify-center"><span class="font-text text-base md:text-2xl text-slate-400">${isF ? "WIN ?" : "QUALIFIÉ ?"}</span></div><div class="flex-1 p-2.5 md:p-3 flex items-center justify-center md:border-l-[3px] border-t-[3px] md:border-t-0 border-[#27272a]" style="background: ${bg};"><span class="font-pixel text-xl md:text-5xl" style="color: ${tr};">${qStatus}</span></div>${qScore ? `<div class="bg-[#09090b] w-full md:w-[30%] p-2.5 md:p-3 flex items-center justify-center border-t-[3px] md:border-t-0 md:border-l-[3px] border-[#27272a]"><span class="font-pixel text-base md:text-2xl" style="color: ${tC};">${qScore}</span></div>` : ''}</div>`; }
        let tH = "";
        if (cTitle && tTitle) {
            tH = `<div class="flex flex-col md:flex-row border-b-2 border-[#27272a]">
                    <div class="w-full md:w-[30%] flex-none flex flex-col md:border-r-2 border-[#27272a]">
                        <div class="bg-[rgba(88,101,242,0.15)] p-2 md:p-3 text-center font-text text-base md:text-2xl text-slate-300 border-b border-[#27272a]">${cTitle}</div>
                        <div class="bg-[rgba(229,57,53,0.1)] p-2 md:p-4 text-center font-pixel text-sm md:text-xl text-[var(--pixel-red)] h-full flex items-center justify-center">${contre}</div>
                    </div>
                    <div class="flex-1 flex flex-col">
                        <div class="bg-[rgba(88,101,242,0.15)] p-2 md:p-3 text-center font-text text-base md:text-2xl text-slate-300 border-b border-[#27272a]">${tTitle}</div>
                        <div class="bg-[rgba(245,158,11,0.15)] p-2 md:p-4 text-center font-pixel text-sm md:text-xl text-[var(--pixel-orange)] h-full flex items-center justify-center">${teams}</div>
                    </div>
                  </div>`;
        } else if (tTitle || teams || cTitle || contre) {
            const title = tTitle || cTitle || "";
            const val = teams || contre || "";
            const isRed = !!cTitle;
            const bg = isRed ? "rgba(229,57,53,0.1)" : "rgba(245,158,11,0.15)";
            const color = isRed ? "var(--pixel-red)" : "var(--pixel-orange)";
            tH = `<div class="border-b-2 border-[#27272a]">
                    ${title ? `<div class="bg-[rgba(88,101,242,0.15)] p-2 md:p-3 text-center font-text text-base md:text-2xl text-slate-300 border-b border-[#27272a]">${title}</div>` : ''}
                    <div class="p-2 md:p-4 text-center font-pixel text-sm md:text-xl h-full flex items-center justify-center" style="background: ${bg}; color: ${color};">${val}</div>
                  </div>`;
        }
        let articleId = isF ? "section-finale" : (isR ? `section-carre-${redCount}` : `section-eliminatoire-${blueCount}`);
        let chunk = `<article id="${articleId}" class="pixel-card mt-6 md:mt-10 flex flex-col h-full mx-2 md:mx-0"><header class="${hC} px-3 py-4 md:px-5 md:p-6 flex flex-col justify-center items-center text-center relative"><div class="text-slate-300 font-text text-base md:text-xl mb-1 tracking-widest">RÉSULTATS DE LA</div><h2 class="font-pixel text-lg md:text-3xl tracking-widest" style="color: ${tC};">${groupTitle}</h2></header>${tH}<div class="flex-grow bg-[#0f0f13] p-2 md:p-0 border-t border-[#27272a] md:border-0"><div class="w-full overflow-x-auto pb-2"><div class="min-w-[600px]"><div class="grid grid-cols-12 gap-0 font-pixel text-[10px] md:text-sm text-slate-500 p-1.5 md:p-2 text-center bg-[#09090b] border-b border-[#27272a]">${hH}</div>${gH || '<div class="p-6 md:p-8 text-center text-slate-600 font-text text-lg md:text-2xl pt-8 md:pt-10">EN ATTENTE...</div>'}</div></div></div>${qH}</article>`;

        let completedCount = games.filter(g => {
            let res = isF ? (g.placeJeu || g.place) : g.place;
            return res && String(res).trim() !== "" && !has(res, "???") && !has(res, "ATTENTE");
        }).length;

        return { chunk, nextIndex: j, blueCount, redCount, qStatus, gamesCount: games.length, completedCount, articleId };
    }

    renderTracker(timeline, state, gameStats) {
        if (!timeline.seeding.exists && !timeline.knockout.exists && !timeline.eliminatoire.exists && !timeline.carre.exists && !timeline.finale.exists) return "";

        let steps = [
            { id: "seeding", label: "SEEDING", target: timeline.seeding.target, exists: timeline.seeding.exists, finished: timeline.seeding.finished },
            { id: "knockout", label: "KNOCKOUT", target: timeline.knockout.target, exists: timeline.knockout.exists, finished: timeline.knockout.finished },
            { id: "eliminatoire", label: "ÉLIMINATOIRES", target: timeline.eliminatoire.target, exists: timeline.eliminatoire.exists, finished: timeline.eliminatoire.finished },
            { id: "carre", label: "CARRÉ FINAL", target: timeline.carre.target, exists: timeline.carre.exists, finished: timeline.carre.finished },
            { id: "finale", label: "FINALE", target: timeline.finale.target, exists: timeline.finale.exists, finished: timeline.finale.finished }
        ];

        let seedingProg = (timeline.seeding.completedMatches || 0) * 3;
        let knockoutProg = (timeline.knockout.completedMatches || 0) * 4;
        let elimProg = (timeline.eliminatoire.completedMatches || 0) * 5;
        let carreProg = (timeline.carre.completedMatches || 0) * 4;
        let finaleProg = (timeline.finale.completedMatches || 0) * (15 / 7);

        let progress = Math.min(100, Math.round(seedingProg + knockoutProg + elimProg + carreProg + finaleProg));
        if (state.tournamentWon) progress = 100;
        if (progress >= 100 && !state.tournamentWon) progress = 99;

        let activeFound = false;
        let breadcrumbs = steps.map((s, idx) => {
            let isActive = false;
            if (s.exists && !s.finished && !activeFound) {
                isActive = true;
                activeFound = true;
            }

            let connectorLine = "";
            if (idx < steps.length - 1) {
                let lineClass = s.finished ? "bg-[var(--pixel-green)] shadow-[0_0_5px_var(--pixel-green)]" : "bg-[#27272a]";
                connectorLine = `<div class="w-2.5 md:w-5 lg:w-6 h-0.5 md:h-1 ${lineClass} mx-0 md:mx-1 transition-all duration-500 rounded-full"></div>`;
            }

            let statusClass = "";
            if (s.finished) {
                statusClass = "text-[var(--pixel-green)] border-[var(--pixel-green)] shadow-[0_0_8px_rgba(100,255,218,0.3)]";
            } else if (isActive) {
                if (s.id === "finale") {
                    statusClass = "text-[var(--pixel-violet)] border-[var(--pixel-violet)] shadow-[0_0_20px_rgba(168,85,247,0.6)] animate-pulse scale-105";
                } else {
                    statusClass = "text-[var(--pixel-orange)] border-[var(--pixel-orange)] shadow-[0_0_12px_rgba(245,158,11,0.6)] animate-pulse";
                }
            } else {
                statusClass = "text-slate-500 border-[#27272a] opacity-60 bg-[#09090b]";
            }

            let iconSvg = "";
            if (s.id === "finale" && (isActive || s.finished)) {
                iconSvg = `<svg class="w-2.5 h-2.5 md:w-3.5 md:h-3.5 ${isActive ? 'animate-bounce' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="${isActive ? 'filter: drop-shadow(0 0 5px var(--pixel-violet));' : ''}"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l9-5-9-5-9 5 9 5zm0 0l9-5-9-5-9 5 9 5zm0 0v6m0 0l9-5-9-5-9 5 9 5zm0 0v6"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 21h6"></path></svg>`;
            } else if (s.finished) {
                iconSvg = `<svg class="w-2.5 h-2.5 md:w-3.5 md:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>`;
            } else if (isActive) {
                iconSvg = `<svg class="w-2.5 h-2.5 md:w-3.5 md:h-3.5 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M13 5l7 7-7 7M5 5l7 7-7 7"></path></svg>`;
            } else {
                iconSvg = `<svg class="w-2.5 h-2.5 md:w-3.5 md:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>`;
            }

            let bg = s.finished ? "bg-[rgba(100,255,218,0.05)]" : (isActive ? (s.id === "finale" ? "bg-[rgba(168,85,247,0.15)]" : "bg-[rgba(245,158,11,0.1)]") : "bg-transparent");
            let pointer = "cursor-default hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_0_8px_rgba(255,255,255,0.1)]";

            return `
                <div class="flex items-center">
                    <div class="flex items-center gap-1 md:gap-1.5 px-2 py-1 md:px-3 md:py-1.5 border-2 ${statusClass} ${bg} ${pointer} font-pixel text-[7px] md:text-[9px] lg:text-[11px] transition-all duration-300"
                         aria-label="${s.label} - ${s.finished ? 'Terminé' : (isActive ? 'En cours' : 'Bloqué')}">
                        <span class="flex-shrink-0">${iconSvg}</span>
                        <span class="whitespace-nowrap tracking-wider pt-0.5">${s.label}</span>
                    </div>
                    ${connectorLine}
                </div>
            `;
        }).join('');

        const phaseTransitions = [
            { pos: 6, color: "rgba(100,255,218,0.2)" },
            { pos: 30, color: "rgba(100,255,218,0.2)" },
            { pos: 65, color: "rgba(100,255,218,0.2)" },
            { pos: 85, color: "var(--pixel-violet)" }
        ];
        let phaseMarkersHtml = phaseTransitions.map(m => `
            <div class="absolute top-0 h-full w-[1px] z-10" style="left: ${m.pos}%; background-color: ${m.color}; opacity: 0.5;"></div>
        `).join('');

        let finaleTicks = Array.from({ length: 7 }).map((_, i) => {
            let isLast = i === 6;
            let pos = 85 + ((i + 1) * (15 / 7));
            if (pos > 100) pos = 100;
            return `<div class="absolute top-1/2 -translate-y-1/2 ${isLast ? 'w-[2px] md:w-[3px] h-3 md:h-4 bg-[var(--pixel-violet)] shadow-[0_0_5px_var(--pixel-violet)]' : 'w-[1px] h-1.5 md:h-2 bg-slate-500'} z-20" style="left: calc(${pos}% - ${isLast ? '2px' : '0px'})"></div>`;
        }).join('');

        let activeStep = steps.find(s => s.exists && !s.finished) || steps.find(s => !s.exists);
        let phaseName = activeStep ? activeStep.label : "TERMINÉ";

        return `
            <section class="mt-8 md:mt-12 mb-8 md:mb-12 flex justify-center w-full px-2 md:px-0 pixel-animate-enter">
                <div class="w-full max-w-[920px] pixel-card border-[3px] md:border-4 border-[#27272a] bg-[#09090b] p-5 md:p-8 relative flex flex-col items-center" style="box-shadow: 0 10px 30px -10px rgba(0,0,0,0.8), inset 0 0 20px rgba(0,0,0,0.5);">
                    <div class="absolute -top-4 md:-top-5 left-1/2 -translate-x-1/2 bg-[#09090b] px-4 py-1.5 font-pixel text-[10px] md:text-sm text-white border-2 border-[var(--pixel-green)] shadow-[0_0_12px_rgba(100,255,218,0.2)] rounded-sm flex items-center gap-2 whitespace-nowrap">
                        <span class="text-[var(--pixel-green)] animate-pulse">>></span> SUIVI DU TOURNOI <span class="text-[var(--pixel-green)] animate-pulse"><<</span>
                    </div>
                    
                    <div class="flex flex-wrap justify-center items-center mt-2 mb-8 md:mb-10 overflow-x-auto w-full pb-3 pt-2" style="scrollbar-width: none;">
                        <div class="flex items-center min-w-max px-2">
                            ${breadcrumbs}
                        </div>
                    </div>
                    
                    <div class="w-full relative px-1 md:px-8">
                        <div class="flex justify-between items-end mb-2 md:mb-3">
                            <div class="font-pixel text-[8px] md:text-[10px] text-slate-500 uppercase tracking-widest flex flex-col items-center gap-1 md:gap-1.5 w-16 md:w-20">
                                <svg class="w-4 h-4 md:w-5 md:h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                <span>DÉBUT</span>
                            </div>
                            <div class="flex flex-col items-center">
                                <span class="font-pixel text-[10px] md:text-base text-[var(--pixel-green)] bg-[rgba(100,255,218,0.1)] px-3 md:px-4 py-1 rounded-sm border border-[var(--pixel-green)] shadow-[0_0_8px_rgba(100,255,218,0.2)] mb-1.5">${progress}%</span>
                                <span class="font-pixel text-[8px] md:text-[11px] text-slate-400 uppercase tracking-tighter">
                                    ${state.tournamentWon ?
                '<span class="text-[var(--pixel-violet)] animate-pulse">TOURNOI TERMINÉ</span>' :
                `<span class="text-[var(--pixel-green)] opacity-70">PHASE ACTUELLE :</span> ${phaseName}`
            }
                                </span>
                            </div>
                            <div class="font-pixel text-[8px] md:text-[10px] text-[var(--pixel-violet)] uppercase tracking-widest flex flex-col items-center gap-1 md:gap-1.5 w-16 md:w-20">
                                <svg class="w-4 h-4 md:w-5 md:h-5 text-[var(--pixel-violet)] drop-shadow-[0_0_4px_var(--pixel-violet)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"></path></svg>
                                <span class="drop-shadow-[0_0_4px_var(--pixel-violet)]">VICTOIRE</span>
                            </div>
                        </div>
                        <div class="h-4 md:h-6 w-full bg-[#0f0f13] border-[3px] border-[#27272a] relative p-[2px] rounded-sm shadow-inner overflow-hidden">
                            ${phaseMarkersHtml}
                            <div class="absolute top-0 left-0 w-full h-full z-10 pointer-events-none">
                                ${finaleTicks}
                            </div>
                            
                            <div class="h-full bg-[var(--pixel-green)] transition-all duration-1000 ease-out relative rounded-[1px] z-0" style="width: ${progress}%; box-shadow: inset 0 0 10px rgba(255,255,255,0.3), 0 0 12px rgba(100,255,218,0.4);">
                                ${progress > 0 && progress < 100 ? `<div class="absolute top-0 right-0 w-1 md:w-2 h-full bg-white opacity-80 animate-pulse shadow-[0_0_8px_white]"></div>` : ''}
                                <div class="absolute top-0 left-0 w-full h-full opacity-30 mix-blend-overlay" style="background-image: repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,0.8) 10px, rgba(0,0,0,0.8) 20px);"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        `;
    }

    async checkTwitchLive() {
        const streamers = ["theguill84", "nykho"];
        await Promise.all(streamers.map(async (streamer) => {
            try {
                const response = await fetch(`https://decapi.me/twitch/uptime/${streamer}`);
                const text = await response.text();
                const isLive = !text.includes("offline") && !text.includes("Error") && !text.includes("User not found");
                const badge = document.getElementById(`live-${streamer}`), link = document.getElementById(`link-${streamer}`);
                if (badge && link) { badge.classList.toggle('hidden', !isLive); const c = streamer === "theguill84" ? "text-[var(--pixel-orange)]" : "text-[#9146FF]"; link.classList.toggle(c, isLive); link.classList.toggle('text-slate-400', !isLive); }
            } catch (e) { }
        }));
    }

    getMockData() {
        return [["TEAM : LES MOCKERS FOUS"], [""], ["PHASE DE SEEDING"], ["JEUX", "", "", "PLACE", "", "", "", "", "", "HEURE"], ["MINECRAFT", "", "", "TOP 3", "", "", "", "", "", "13:00"], ["TRACKMANIA", "", "", "1ER", "", "", "", "", "", "14:00"], ["", "", "", ">> SEEDING", "2"], [""], ["PHASE DE KNOCKOUT"], ["JEUX", "", "", "CHOIX", "CONTRE QUI", "", "SCORE", "RÉSULTATS", "VIES", "LIVE"], ["WORMS", "", "", "OUI", "LES TARDTARDS", "", "2-0", "GAGNÉ", "3", "15:00"], ["TETRIS", "", "", "NON", "LES TARDTARDS", "", "1-3", "PERDU", "2", "16:00"], ["CULT OF THE LAMB", "", "", "OUI", "AUTRE TEAM", "", "3-0", "GAGNÉ", "2", "17:00"], ["", "", "QUALIFIÉ ?", "OUI", "2-1"], [""], ["PHASE ÉLIMINATOIRE (16 ÉQUIPES)"], ["CONTRE QUI ?", "", "", "TEAMS PRÉSENTES"], ["???", "", "", "???"], ["JEUX", "", "", "", "RÉSULTATS SUR LE JEU", "", "", "WIN?"], ["MINECRAFT", "", "", "", "1ER", "", "", "OUI"], ["VALORANT", "", "", "", "13-5", "", "", "OUI"], ["", "", "QUALIFIÉ ?", "OUI", "2-0"], [""], ["PHASE FINALE"], ["JEUX", "", "", "", "", "", "", "RÉSULTATS", "LIVE"], ["JEU MYSTÈRE", "", "", "", "VICTOIRE", "", "", "1ER", "21:00"], ["", "", "WIN ?", "OUI", "CHAMPIONS"], [""], ["WIN !"]];
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("scrollTopBtn");
    if (btn) {
        let isS = false;
        window.addEventListener("scroll", () => { if (!isS) { window.requestAnimationFrame(() => { btn.classList.toggle("opacity-0", window.scrollY <= 300); btn.classList.toggle("pointer-events-none", window.scrollY <= 300); btn.classList.toggle("opacity-100", window.scrollY > 300); btn.classList.toggle("pointer-events-auto", window.scrollY > 300); isS = false; }); isS = true; } }, { passive: true });
        btn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
    }
});
