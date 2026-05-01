// dashboard.js

const has = (cell, text) => String(cell || "").toUpperCase().includes(text.toUpperCase());

const isGroupPhase = (row) => {
    if (!row) return false;
    const cells = Array.isArray(row) ? row.slice(0, 3) : [row];
    return cells.some(cell => {
        const t = String(cell || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return t.includes("PHASE DE GROUPE") || t.includes("PHASE A") || t.includes("PHASE FINALE");
    });
};

class ZlanDashboard {
    // Ajout du paramètre is2026Format (par défaut sur false)
    constructor(encodedUrl, enableTwitchLive = false, avatarUrl = null, is2026Format = false) {
        this.sheetUrl = atob(encodedUrl);
        this.enableTwitchLive = enableTwitchLive;
        this.avatarUrl = avatarUrl;
        this.is2026 = is2026Format;
        this.isFetching = false;

        this.init();
        if (this.enableTwitchLive) {
            this.checkTwitchLive();
            setInterval(() => this.checkTwitchLive(), 120000);
        }
    }

    async init() {
        if (this.isFetching) return;
        this.isFetching = true;
        const statusEl = document.getElementById('status');

        try {
            const response = await fetch(`${this.sheetUrl}&timestamp=${Date.now()}&rnd=${Math.random()}`, { cache: 'no-store' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const csvData = await response.text();
            Papa.parse(csvData, {
                skipEmptyLines: false,
                complete: (results) => {
                    if (results?.data) this.buildDashboard(results.data);
                    this.isFetching = false;
                    setTimeout(() => this.init(), 30000);
                },
                error: (err) => {
                    console.error(err);
                    statusEl.innerHTML = `<span class="w-2.5 h-2.5 bg-[var(--pixel-red)] shadow-[0_0_8px_rgba(229,57,53,1)]"></span> <span style="color: var(--pixel-red)">ERREUR PARSE</span>`;
                    this.isFetching = false;
                    setTimeout(() => this.init(), 30000);
                }
            });
        } catch (error) {
            console.error("Erreur :", error);
            statusEl.innerHTML = `<span class="w-2.5 h-2.5 bg-[var(--pixel-red)] shadow-[0_0_8px_rgba(229,57,53,1)]"></span> <span style="color: var(--pixel-red)">HORS LIGNE</span>`;
            this.isFetching = false;
            setTimeout(() => this.init(), 30000);
        }
    }

    buildDashboard(data) {
        if (!data?.length) return;

        let htmlChunks = { team: "", seeding: "", knockout: "", groups: "", finalRank: "" };
        let state = { seedingFinished: false, knockoutFinished: false, groupFinished: true, tournamentOver: false, tournamentWon: false };

        let lastValidRowIndex = data.findLastIndex(row => row.some(c => c?.trim()));

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const r0 = String(row[0] || "");
            const isLastRow = (i === lastValidRowIndex);

            if (state.tournamentOver && !isLastRow) continue;

            // --- 1. JOUEURS ENGAGÉS ---
            let teamText = row.find(c => has(c, "TEAM :") || has(c, "TEAM:"));
            if (teamText) {
                let cleanTeam = teamText.replace(/TEAM\s*:/i, '').trim();
                let avatarHtml = this.avatarUrl ? `
                    <div class="flex justify-center mb-5 md:mb-8 mt-4">
                        <img src="${this.avatarUrl}" alt="Avatar" class="h-[80px] md:h-[160px] lg:h-[240px] w-auto max-w-full border-[3px] border-[var(--pixel-orange)] shadow-[6px_6px_0px_rgba(0,0,0,0.8)] object-cover">
                    </div>
                ` : '<div class="mt-4"></div>';

                htmlChunks.team = `
                    <section class="mb-6 md:mb-12 flex justify-center w-full px-2 md:px-0">
                        <div class="pixel-card border-b-4 px-4 py-5 md:px-8 md:p-10 w-full max-w-[920px]" style="border-bottom-color: var(--pixel-orange); text-align: center;">
                            <h1 class="text-[var(--pixel-orange)] font-text text-lg md:text-2xl mb-1.5 tracking-widest drop-shadow-[0_0_6px_rgba(245,158,11,0.5)]">>> JOUEURS ENGAGÉS <<</h1>
                            ${avatarHtml}
                            <p class="text-lg md:text-4xl font-pixel text-white tracking-wider">${cleanTeam}</p>
                        </div>
                    </section>`;
            }

            // --- 2. RÉSULTAT FINAL ---
            if (isLastRow) {
                let finalRankText = r0 || row.find(c => c?.trim()) || "";
                if (finalRankText?.trim()) {
                    let isWin = ["WIN", "1ER", "GAGNÉ", "OUI", "TOP 1"].some(kw => has(finalRankText, kw));
                    if (isWin) state.tournamentWon = true;

                    let colorVar = state.tournamentWon ? "var(--pixel-green)" : (state.tournamentOver ? "var(--pixel-red)" : "var(--pixel-green)");
                    let bgColor = state.tournamentWon ? "rgba(100, 255, 218, 0.05)" : (state.tournamentOver ? "rgba(229, 57, 53, 0.05)" : "rgba(100, 255, 218, 0.05)");

                    htmlChunks.finalRank = `
                        <section class="mt-6 md:mt-12 mb-10 md:mb-16 flex justify-center w-full px-2 md:px-0">
                            <div class="pixel-card border-2 px-4 py-5 md:px-10 md:p-13 w-full max-w-[720px]" style="border-color: ${colorVar}; text-align: center; background: ${bgColor};">
                                <h2 class="text-slate-400 font-text text-lg md:text-3xl mb-1 tracking-widest">RÉSULTAT FINAL</h2>
                                <p class="text-2xl md:text-6xl font-pixel tracking-widest" style="color: ${colorVar}; text-shadow: 3px 3px 0px rgba(0,0,0,0.5);">${finalRankText}</p>
                            </div>
                        </section>`;
                }
            }

            // --- 3. PHASE DE SEEDING ---
            else if (has(r0, "PHASE DE SEEDING")) {
                let games = [];
                let seedingScore = "";
                let j = i + 1;
                while (j < data.length && !has(data[j][0], "PHASE DE KNOCKOUT") && j !== lastValidRowIndex) {
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

                if (seedingScore && !has(seedingScore, "EN ATTENTE")) state.seedingFinished = true;

                let gamesHtml = games.map((g, idx) => `
                    <div class="grid ${this.is2026 ? 'grid-cols-6' : 'grid-cols-4'} text-center items-stretch border-b border-black/50 last:border-0 hover:bg-white/5 transition-colors ${idx % 2 === 0 ? "bg-[#18181b]" : "bg-[#27272a]/50"}">
                        <div class="col-span-2 font-pixel text-slate-200 text-[10px] md:text-lg lg:text-2xl uppercase py-1.5 md:py-3 px-1 flex items-center justify-center">${g.name}</div>
                        <div class="col-span-2 font-text text-sm md:text-xl lg:text-2xl ${g.place === '???' ? 'text-slate-600' : 'text-white'} py-1.5 md:py-3 px-1 flex items-center justify-center border-l border-[#27272a]/50">${g.place || '???'}</div>
                        ${this.is2026 ? `<time class="col-span-2 font-pixel italic text-[7px] md:text-xs lg:text-base text-slate-400 py-1.5 md:py-3 px-1 border-l border-[#27272a]/50 flex justify-center items-center">${g.heure}</time>` : ''}
                    </div>
                `).join('');

                htmlChunks.seeding = `
                    <section class="pixel-card mt-6 mx-2 md:mx-0">
                        <header class="pixel-header-orange px-2.5 py-3 md:px-4 md:p-5 flex flex-col justify-center items-center text-center relative">
                            <div class="text-slate-300 font-text text-sm md:text-xl mb-1 tracking-widest">RÉSULTATS DE LA</div>
                            <h2 class="font-pixel text-lg md:text-3xl tracking-widest" style="color: var(--pixel-orange);">PHASE DE SEEDING</h2>
                        </header>
                        <div class="p-2 md:p-0">
                            <div class="w-full overflow-x-auto pb-2">
                                <div class="min-w-[500px]">
                                    <div class="grid ${this.is2026 ? 'grid-cols-6' : 'grid-cols-4'} font-pixel text-[10px] md:text-sm text-slate-500 p-1.5 md:p-3 text-center bg-[#09090b] border-b border-[#27272a]">
                                        <div class="col-span-2">JEUX</div>
                                        <div class="col-span-2">PLACE</div>
                                        ${this.is2026 ? `<div class="col-span-2">HEURE DU LIVE :</div>` : ''}
                                    </div>
                                    <div class="bg-[#0f0f13]">${gamesHtml}</div>
                                </div>
                            </div>
                        </div>
                        ${seedingScore ? `
                        <div class="flex border-t-[3px] border-[#27272a] mt-auto flex-col md:flex-row">
                            <div class="bg-[#18181b] flex-1 p-2.5 md:p-3 flex items-center justify-center"><span class="font-text text-base md:text-2xl text-slate-400">SEED FINALE</span></div>
                            <div class="flex-1 p-2.5 md:p-3 flex items-center justify-center md:border-l-[3px] border-t-[3px] md:border-t-0 border-[#27272a]" style="background: ${has(seedingScore, 'EN ATTENTE') ? 'rgba(255, 255, 255, 0.05)' : 'rgba(245, 158, 11, 0.1)'};">
                                <span class="font-pixel text-xl md:text-5xl" style="color: ${has(seedingScore, 'EN ATTENTE') ? '#94a3b8' : 'var(--pixel-orange)'};">${seedingScore}</span>
                            </div>
                        </div>` : ''}
                    </section>`;
                i = j - 1;
            }

            // --- 4. PHASE DE KNOCKOUT ---
            else if (has(r0, "PHASE DE KNOCKOUT")) {
                if (!state.seedingFinished) {
                    while (i + 1 < data.length && !isGroupPhase(String(data[i + 1][0]))) i++;
                    continue;
                }

                let games = [], qualifKnockout = "", qualifKnockoutScore = "";
                let j = i + 1;

                while (j < data.length && !isGroupPhase(String(data[j][0])) && j !== lastValidRowIndex) {
                    let subRow = data[j];
                    let qualifIdx = subRow.findIndex(c => has(c, "QUALIFIÉ"));

                    if (qualifIdx !== -1) {
                        let vals = subRow.slice(qualifIdx + 1).filter(v => v.trim() !== "");
                        qualifKnockout = vals[0] || "";
                        qualifKnockoutScore = vals[1] || "";
                        if (!has(qualifKnockout, "OUI") && !has(qualifKnockout, "WIN") && !has(qualifKnockout, "EN ATTENTE") && qualifKnockout.trim()) {
                            state.tournamentOver = true;
                        }
                    } else if (subRow[0] && !has(subRow[0], "JEUX") && !has(subRow[0], "PHASE")) {
                        if (this.is2026) {
                            games.push({ name: subRow[0], choix: subRow[3] || '', contre: subRow[4] || '', score: [subRow[6] || ''], resultat: subRow[7] || '', vies: subRow[8] || '', heure: subRow[9] || '' });
                        } else {
                            // Format 2025 strict
                            games.push({ name: subRow[0], choix: '', contre: subRow[3] || '', score: [subRow[5] || ''], resultat: subRow[6] || '', vies: subRow[7] || '', heure: '' });
                        }
                    } else if (!subRow[0] && (subRow[6] || subRow[5]) && games.length > 0) {
                        games[games.length - 1].score.push(subRow[6] || subRow[5]);
                    }
                    j++;
                }

                if (qualifKnockout && !has(qualifKnockout, "EN ATTENTE")) state.knockoutFinished = true;

                let gamesHtml = games.map((g, idx) => {
                    let resColor = has(g.resultat, "GAGNÉ") || has(g.resultat, "VICTOIRE") ? "text-[var(--pixel-green)]" : (has(g.resultat, "PERDU") || has(g.resultat, "DÉFAITE") || has(g.resultat, "NON") ? "text-[var(--pixel-red)]" : "text-white");
                    let scoresHtml = g.score.map(s => `<div>${s}</div>`).join('');
                    let numVies = parseInt(g.vies);
                    let viesDisplay = !isNaN(numVies) && numVies > 0 ? `<div class="flex gap-1 justify-center flex-wrap" style="text-shadow: 1.5px 1.5px 0px rgba(0,0,0,0.8);">${Array(numVies).fill('<span style="color: var(--pixel-red);">♥</span>').join('')}</div>` : (numVies === 0 ? `<span class="font-pixel text-slate-600">X</span>` : `<span class="text-slate-700">-</span>`);

                    // Tailles de colonnes adaptées 2025 vs 2026
                    let colJeux = this.is2026 ? 'col-span-2' : 'col-span-3';
                    let colContre = this.is2026 ? 'col-span-2' : 'col-span-3';
                    let colScore = this.is2026 ? 'col-span-2' : 'col-span-3';

                    let htmlRow = `<div class="grid grid-cols-12 text-[10px] text-center border-b border-black/50 last:border-0 hover:bg-white/5 items-stretch ${idx % 2 === 0 ? "bg-[#18181b]" : "bg-[#27272a]/50"}">`;
                    htmlRow += `<div class="${colJeux} font-pixel text-slate-100 text-[9px] md:text-lg lg:text-2xl px-1 py-1.5 md:py-3 flex items-center justify-center uppercase">${g.name}</div>`;

                    if (this.is2026) {
                        let choixColor = has(g.choix, "OUI") || has(g.choix, "CHOISI") ? "text-[var(--pixel-green)]" : (has(g.choix, "NON") || has(g.choix, "BAN") ? "text-[var(--pixel-red)]" : "text-white");
                        htmlRow += `<div class="col-span-2 font-text text-[10px] md:text-lg lg:text-xl ${choixColor} px-1 py-1.5 flex items-center justify-center border-l border-[#27272a]/50">${g.choix}</div>`;
                    }

                    htmlRow += `<div class="${colContre} font-text text-[10px] md:text-lg lg:text-xl text-slate-400 px-1 py-1.5 md:py-3 flex items-center justify-center border-l border-[#27272a]/50">${g.contre}</div>`;
                    htmlRow += `<div class="${colScore} font-text text-[10px] md:text-xl lg:text-2xl text-white px-1 py-1.5 md:py-3 flex flex-col justify-center gap-0.5 border-l border-[#27272a]/50">${scoresHtml}</div>`;
                    htmlRow += `<div class="col-span-2 font-pixel text-[7px] md:text-sm lg:text-lg ${resColor} px-1 py-1.5 md:py-3 flex items-center justify-center uppercase border-l border-[#27272a]/50">${g.resultat}</div>`;
                    htmlRow += `<div class="col-span-1 py-1.5 md:py-3 flex justify-center items-center border-l border-[#27272a]">${viesDisplay}</div>`;

                    if (this.is2026) {
                        htmlRow += `<time class="col-span-1 font-pixel italic text-[7px] md:text-xs lg:text-base text-slate-400 px-1 py-1.5 md:py-3 flex justify-center items-center border-l border-[#27272a]/50">${g.heure}</time>`;
                    }
                    htmlRow += `</div>`;
                    return htmlRow;
                }).join('');

                let isOui = has(qualifKnockout, "OUI") || has(qualifKnockout, "WIN");
                let bgRight = isOui ? "rgba(100, 255, 218, 0.1)" : (has(qualifKnockout, "EN ATTENTE") ? "rgba(255, 255, 255, 0.05)" : "rgba(229, 57, 53, 0.1)");
                let textRight = isOui ? "var(--pixel-green)" : (has(qualifKnockout, "EN ATTENTE") ? "#94a3b8" : "var(--pixel-red)");

                // Header strict 2025 vs 2026
                let headerHtml = this.is2026
                    ? `<div class="col-span-2">JEUX</div><div class="col-span-2">CHOIX</div><div class="col-span-2">CONTRE QUI</div><div class="col-span-2">SCORE</div><div class="col-span-2">RÉSULTATS</div><div class="col-span-1">VIES</div><div class="col-span-1">LIVE</div>`
                    : `<div class="col-span-3">JEUX</div><div class="col-span-3">CONTRE QUI ?</div><div class="col-span-3">SCORE</div><div class="col-span-2">RÉSULTATS</div><div class="col-span-1">VIES</div>`;

                htmlChunks.knockout = `
                    <section class="pixel-card mt-6 md:mt-10 mx-2 md:mx-0">
                        <header class="pixel-header-green px-3 py-4 md:px-5 md:p-6 flex flex-col justify-center items-center text-center relative">
                            <div class="text-slate-300 font-text text-base md:text-xl mb-1 tracking-widest">RÉSULTATS DE LA</div>
                            <h2 class="font-pixel text-lg md:text-3xl tracking-widest" style="color: var(--pixel-green);">PHASE DE KNOCKOUT</h2>
                        </header>
                        <div class="p-2 md:p-0">
                            <div class="w-full overflow-x-auto pb-2">
                                <div class="min-w-[800px]">
                                    <div class="grid grid-cols-12 font-pixel text-[10px] md:text-sm text-slate-500 p-1.5 md:p-3 text-center bg-[#09090b] border-b border-[#27272a]">
                                        ${headerHtml}
                                    </div>
                                    <div class="bg-[#0f0f13]">${gamesHtml}</div>
                                </div>
                            </div>
                        </div>
                        ${qualifKnockout ? `
                        <div class="flex border-t-[3px] border-[#27272a] mt-auto flex-col md:flex-row">
                            <div class="bg-[#18181b] flex-1 p-2.5 md:p-3 flex items-center justify-center"><span class="font-text text-base md:text-2xl text-slate-400">QUALIFIÉ ?</span></div>
                            <div class="flex-1 p-2.5 md:p-3 flex items-center justify-center md:border-l-[3px] border-t-[3px] md:border-t-0 border-[#27272a]" style="background: ${bgRight};">
                                <span class="font-pixel text-xl md:text-5xl" style="color: ${textRight};">${qualifKnockout}</span>
                            </div>
                            ${qualifKnockoutScore ? `<div class="bg-[#09090b] w-full md:w-[30%] p-2.5 md:p-3 flex items-center justify-center border-t-[3px] md:border-t-0 md:border-l-[3px] border-[#27272a]"><span class="font-pixel text-base md:text-2xl" style="color: var(--pixel-green);">${qualifKnockoutScore}</span></div>` : ''}
                        </div>` : ''}
                    </section>`;
                i = j - 1;
            }

            // --- 5. GROUPES & FINALES ---
            else if (isGroupPhase(row)) {
                if (!state.knockoutFinished || !state.groupFinished) {
                    while (i + 1 < data.length && !isGroupPhase(data[i + 1])) i++;
                    continue;
                }

                let groupTitle = row.find(c => isGroupPhase(c)) || row[0];
                let teamsTitle = "", teams = "", games = [], qualifStatus = "", qualifStatusScore = "";
                let isFinale = has(groupTitle, "PHASE FINALE");
                let isPhaseA = has(groupTitle, "PHASE A") || has(groupTitle, "PHASE À");

                let j = i + 1;
                while (j < data.length && !isGroupPhase(data[j]) && j !== lastValidRowIndex) {
                    let subRow = data[j];
                    let qualifIdx = subRow.findIndex(c => has(c, "QUALIFIÉ") || has(c, "WIN"));

                    if (qualifIdx !== -1) {
                        let vals = subRow.slice(qualifIdx + 1).filter(v => v.trim() !== "");
                        qualifStatus = vals[0] || "";
                        qualifStatusScore = vals[1] || "";
                        let isOui = has(qualifStatus, "OUI") || has(qualifStatus, "WIN");
                        if (isFinale && isOui) { state.tournamentOver = true; state.tournamentWon = true; }
                        else if (!isOui && !has(qualifStatus, "EN ATTENTE") && qualifStatus.trim()) { state.tournamentOver = true; }
                    } else if (subRow.some(c => has(c, "TEAMS PRÉSENTES"))) {
                        teamsTitle = subRow.find(c => has(c, "TEAMS PRÉSENTES"));
                        let potentialTeams = subRow.find(c => c.trim() !== "" && !has(c, "TEAMS PRÉSENTES"));
                        if (potentialTeams) teams = potentialTeams;
                    } else if (subRow[0] && !has(subRow[0], "JEUX") && !has(subRow[0], "PHASE")) {
                        if (games.length === 0 && !teams) {
                            teams = subRow[0];
                        } else if ((subRow[4] && subRow[4].trim() !== "") || (subRow[7] && subRow[7].trim() !== "") || (!((subRow[0].includes(" - ") || subRow[0].includes(" & ")) && subRow[0].length > 20) && subRow[0].length < 50)) {
                            games.push({ name: subRow[0], placeJeu: subRow[4] || subRow[3] || '', place: subRow[7] || subRow[6] || '', heure: subRow[8] || subRow[9] || '' });
                        }
                    }
                    j++;
                }

                let headerClass = isFinale ? "pixel-header-violet" : (isPhaseA ? "pixel-header-red" : "pixel-header-blue");
                let titleColor = isFinale ? "var(--pixel-violet)" : (isPhaseA ? "var(--pixel-red)" : "var(--pixel-blue)");

                let gamesHtml = games.map((g, idx) => {
                    let resultText = isFinale ? (g.placeJeu || g.place) : g.place;
                    let placeColor = has(resultText, "EN ATTENTE") ? "#94a3b8" : (has(resultText, "GAGNÉ") || has(resultText, "VICTOIRE") ? "var(--pixel-green)" : (has(resultText, "PERDU") || has(resultText, "DÉFAITE") ? "var(--pixel-red)" : titleColor));

                    if (isFinale) {
                        let colJeux = this.is2026 ? 'col-span-7' : 'col-span-8';
                        let colRes = this.is2026 ? 'col-span-3' : 'col-span-4';
                        return `<div class="grid grid-cols-12 gap-0 items-stretch border-b border-black/50 last:border-0 hover:bg-white/5 transition-colors ${idx % 2 === 0 ? "bg-[#18181b]" : "bg-[#27272a]/50"}">
                                    <div class="${colJeux} font-pixel text-slate-100 text-[10px] md:text-lg lg:text-2xl uppercase px-1 py-1.5 md:py-3 flex items-center justify-center text-center" title="${g.name}">${g.name}</div>
                                    <div class="${colRes} font-pixel text-[10px] md:text-lg lg:text-2xl py-1.5 md:py-3 px-1 flex items-center justify-center border-l border-[#27272a]" style="color: ${placeColor};">${resultText}</div>
                                    ${this.is2026 ? `<time class="col-span-2 font-pixel italic text-[7px] md:text-xs lg:text-base text-slate-400 py-1.5 md:py-3 px-1 flex items-center justify-center border-l border-[#27272a]">${g.heure}</time>` : ''}
                                </div>`;
                    } else {
                        let colResJeu = this.is2026 ? 'col-span-3' : 'col-span-4';
                        let colPlace = this.is2026 ? 'col-span-3' : 'col-span-4';
                        return `<div class="grid grid-cols-12 gap-0 items-stretch border-b border-black/50 last:border-0 hover:bg-white/5 transition-colors ${idx % 2 === 0 ? "bg-[#18181b]" : "bg-[#27272a]/50"}">
                                    <div class="col-span-4 font-pixel text-slate-100 text-[10px] md:text-lg lg:text-2xl uppercase px-1 py-1.5 md:py-3 flex items-center justify-center text-center" title="${g.name}">${g.name}</div>
                                    <div class="${colResJeu} font-text text-[10px] md:text-lg lg:text-xl text-slate-400 py-1.5 md:py-3 px-1 flex items-center justify-center border-l border-[#27272a]">${g.placeJeu}</div>
                                    <div class="${colPlace} font-pixel text-[10px] md:text-lg lg:text-xl py-1.5 md:py-3 px-1 flex items-center justify-center border-l border-[#27272a]" style="color: ${placeColor};">${g.place}</div>
                                    ${this.is2026 ? `<time class="col-span-2 font-pixel italic text-[7px] md:text-xs lg:text-base text-slate-400 py-1.5 md:py-3 px-1 flex items-center justify-center border-l border-[#27272a]">${g.heure}</time>` : ''}
                                </div>`;
                    }
                }).join('');

                let groupHeaderHtml = '';
                if (isFinale) {
                    groupHeaderHtml = this.is2026
                        ? `<div class="col-span-7">JEUX</div><div class="col-span-3">RÉSULTATS</div><div class="col-span-2">LIVE</div>`
                        : `<div class="col-span-8">JEUX</div><div class="col-span-4">RÉSULTATS</div>`;
                } else {
                    groupHeaderHtml = this.is2026
                        ? `<div class="col-span-4">JEUX</div><div class="col-span-3">RÉSULTATS DU JEU</div><div class="col-span-3">PLACE</div><div class="col-span-2">LIVE</div>`
                        : `<div class="col-span-4">JEUX</div><div class="col-span-4">RÉSULTATS DU JEU</div><div class="col-span-4">PLACE</div>`;
                }

                let qualifHtml = "";
                if (qualifStatus) {
                    let isOui = has(qualifStatus, "OUI") || has(qualifStatus, "WIN");
                    let bgRight = isOui ? "rgba(100, 255, 218, 0.1)" : (has(qualifStatus, "EN ATTENTE") ? "rgba(255, 255, 255, 0.05)" : "rgba(229, 57, 53, 0.1)");
                    let textRight = isOui ? "var(--pixel-green)" : (has(qualifStatus, "EN ATTENTE") ? "#94a3b8" : "var(--pixel-red)");
                    qualifHtml = `
                        <div class="flex border-t-[3px] border-[#27272a] mt-auto flex-col md:flex-row">
                            <div class="bg-[#18181b] flex-1 p-2.5 md:p-3 flex items-center justify-center"><span class="font-text text-base md:text-2xl text-slate-400">${isFinale ? "WIN ?" : "QUALIFIÉ ?"}</span></div>
                            <div class="flex-1 p-2.5 md:p-3 flex items-center justify-center md:border-l-[3px] border-t-[3px] md:border-t-0 border-[#27272a]" style="background: ${bgRight};">
                                <span class="font-pixel text-xl md:text-5xl" style="color: ${textRight};">${qualifStatus}</span>
                            </div>
                            ${qualifStatusScore ? `<div class="bg-[#09090b] w-full md:w-[30%] p-2.5 md:p-3 flex items-center justify-center border-t-[3px] md:border-t-0 md:border-l-[3px] border-[#27272a]"><span class="font-pixel text-base md:text-2xl" style="color: ${titleColor};">${qualifStatusScore}</span></div>` : ''}
                        </div>`;
                }

                htmlChunks.groups += `
                    <article class="pixel-card mt-6 md:mt-10 flex flex-col h-full mx-2 md:mx-0">
                        <header class="${headerClass} px-3 py-4 md:px-5 md:p-6 flex flex-col justify-center items-center text-center relative">
                            <div class="text-slate-300 font-text text-base md:text-xl mb-1 tracking-widest">RÉSULTATS DE LA</div>
                            <h2 class="font-pixel text-lg md:text-3xl tracking-widest" style="color: ${titleColor};">${groupTitle}</h2>
                        </header>
                        ${teamsTitle ? `<div class="bg-[rgba(88,101,242,0.15)] p-2 md:p-3 text-center font-text text-base md:text-2xl text-slate-300 border-b border-[#27272a]">${teamsTitle}</div>` : ''}
                        ${teams ? `<div class="bg-[rgba(245,158,11,0.15)] p-2 md:p-4 text-center font-pixel text-sm md:text-xl text-[var(--pixel-orange)] border-b-2 border-[#27272a]">${teams}</div>` : ''}
                        <div class="flex-grow bg-[#0f0f13] p-2 md:p-0 border-t border-[#27272a] md:border-0">
                            <div class="w-full overflow-x-auto pb-2">
                                <div class="min-w-[600px]">
                                    <div class="grid grid-cols-12 gap-0 font-pixel text-[10px] md:text-sm text-slate-500 p-1.5 md:p-2 text-center bg-[#09090b] border-b border-[#27272a]">
                                        ${groupHeaderHtml}
                                    </div>
                                    ${gamesHtml || '<div class="p-6 md:p-8 text-center text-slate-600 font-text text-lg md:text-2xl pt-8 md:pt-10">EN ATTENTE...</div>'}
                                </div>
                            </div>
                        </div>
                        ${qualifHtml}
                    </article>`;

                state.groupFinished = qualifStatus && !has(qualifStatus, "EN ATTENTE");
                i = j - 1;
            }
        }

        const container = document.getElementById('dashboard-container');
        const fullHtml = htmlChunks.team + htmlChunks.seeding + htmlChunks.knockout + (htmlChunks.groups ? `<div>${htmlChunks.groups}</div>` : '') + htmlChunks.finalRank;

        if (container.innerHTML !== fullHtml && fullHtml.trim() !== "") {
            container.innerHTML = fullHtml;
        }

        const status = document.getElementById('status');
        status.innerHTML = `<span class="w-2.5 h-2.5 bg-[var(--pixel-green)] shadow-[0_0_8px_rgba(100,255,218,1)]"></span> <span style="color: var(--pixel-green)">SYNC OK</span>`;
        status.className = "font-text text-lg md:text-xl flex items-center justify-center gap-2 mt-1 md:mt-0 w-full md:w-auto";
    }

    async checkTwitchLive() {
        const streamers = ["theguill84", "nykho"];
        await Promise.all(streamers.map(async (streamer) => {
            try {
                const response = await fetch(`https://decapi.me/twitch/uptime/${streamer}`);
                const text = await response.text();
                const liveBadge = document.getElementById(`live-${streamer}`);
                const linkElement = document.getElementById(`link-${streamer}`);

                if (liveBadge && linkElement) {
                    const isLive = !text.includes("offline") && !text.includes("Error") && !text.includes("User not found");
                    liveBadge.classList.toggle('hidden', !isLive);

                    const activeColor = streamer === "theguill84" ? "text-[var(--pixel-orange)]" : "text-[#9146FF]";
                    linkElement.classList.toggle(activeColor, isLive);
                    linkElement.classList.toggle('text-slate-400', !isLive);
                }
            } catch (e) {
                console.error(`Erreur Twitch ${streamer}:`, e);
            }
        }));
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
                    if (window.scrollY > 300) {
                        scrollTopBtn.classList.remove("opacity-0", "pointer-events-none");
                        scrollTopBtn.classList.add("opacity-100", "pointer-events-auto");
                    } else {
                        scrollTopBtn.classList.remove("opacity-100", "pointer-events-auto");
                        scrollTopBtn.classList.add("opacity-0", "pointer-events-none");
                    }
                    isScrolling = false;
                });
                isScrolling = true;
            }
        }, { passive: true });

        scrollTopBtn.addEventListener("click", () => {
            window.scrollTo({ top: 0, behavior: "smooth" });
        });
    }
});