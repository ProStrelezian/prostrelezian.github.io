// REMPLACER CETTE URL PAR CELLE DU GOOGLE SHEET 2025 (Format CSV export)
const _0x1a2b = 'aHR0cHM6Ly9kb2NzLmdvb2dsZS5jb20vc3ByZWFkc2hlZXRzL2QvMVFfVUNrV0hsWFVMZjdyU3RncjlJR0lGdE1YZUM0VVdRS3h5N05lVnd3bDQvZXhwb3J0P2Zvcm1hdD1jc3YmZ2lkPTA=';
const SHEET_URL = atob(_0x1a2b);
let isFetching = false;

async function init() {
    if (isFetching) return;
    isFetching = true;
    try {
        const urlAvecAntiCache = SHEET_URL + "&timestamp=" + Date.now() + "&rnd=" + Math.random();
        const response = await fetch(urlAvecAntiCache, {
            cache: 'no-store'
        });

        if (!response.ok) {
            throw new Error("HTTP error " + response.status);
        }

        const csvData = await response.text();

        Papa.parse(csvData, {
            skipEmptyLines: false,
            complete: function (results) {
                if (results && results.data) {
                    buildDashboard(results.data);
                }
                isFetching = false;
                setTimeout(init, 30000);
            },
            error: function (err) {
                console.error(err);
                document.getElementById('status').innerHTML = `<span class="w-2.5 h-2.5 bg-[var(--pixel-red)] shadow-[0_0_8px_rgba(229,57,53,1)]"></span> <span style="color: var(--pixel-red)">ERREUR PARSE</span>`;
                isFetching = false;
                setTimeout(init, 30000);
            }
        });
    } catch (error) {
        console.error("Erreur de chargement :", error);
        document.getElementById('status').innerHTML = `<span class="w-2.5 h-2.5 bg-[var(--pixel-red)] shadow-[0_0_8px_rgba(229,57,53,1)]"></span> <span style="color: var(--pixel-red)">HORS LIGNE</span>`;
        isFetching = false;
        setTimeout(init, 30000);
    }
}

function has(cell, text) {
    return cell != null && String(cell).toUpperCase().includes(text.toUpperCase());
}

const isGroupPhase = (row) => {
    if (!row) return false;
    // On vérifie les 3 premières colonnes au cas où le titre serait décalé par une fusion de cellules
    const cells = Array.isArray(row) ? row.slice(0, 3) : [row];
    return cells.some(cell => {
        if (!cell) return false;
        const t = String(cell).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return t.includes("PHASE DE GROUPE") || t.includes("PHASE A") || t.includes("PHASE FINALE");
    });
};

function buildDashboard(data) {
    if (!data || data.length === 0) return;

    let teamNameHtml = "";
    let seedingHtml = "";
    let knockoutHtml = "";
    let groupCardsHtml = "";
    let finalRankHtml = "";

    let seedingFinished = false;
    let knockoutFinished = false;
    let groupFinished = true;
    let tournamentOver = false;
    let tournamentWon = false;

    // ÉTAPE 1 : Trouver mathématiquement l'index de la toute dernière ligne remplie du Google Sheet
    let lastValidRowIndex = -1;
    for (let i = data.length - 1; i >= 0; i--) {
        if (data[i].some(c => c.trim() !== "")) {
            lastValidRowIndex = i;
            break;
        }
    }

    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const r0 = String(row[0] || "");

        // On identifie si c'est la ligne finale
        let isLastRow = (i === lastValidRowIndex);

        // Si le tournoi est fini et qu'on n'est pas sur la toute dernière ligne, on skip le reste.
        if (tournamentOver && !isLastRow) {
            continue;
        }

        // --- JOUEURS ENGAGÉS ---
        if (row.some(c => has(c, "TEAM :") || has(c, "TEAM:"))) {
            let teamText = row.find(c => has(c, "TEAM :") || has(c, "TEAM:")) || "";
            if (teamText) {
                let cleanTeam = teamText.replace(/TEAM\s*:/i, '').trim();
                teamNameHtml = `
                    <section class="mb-6 md:mb-12 flex justify-center w-full px-2 md:px-0" aria-labelledby="players-title">
                        <div class="pixel-card border-b-4 px-4 py-5 md:px-8 md:p-10 w-full max-w-[920px]" style="border-bottom-color: var(--pixel-orange); text-align: center;">
                            <h1 id="players-title" class="text-[var(--pixel-orange)] font-text text-lg md:text-2xl mb-1.5 tracking-widest drop-shadow-[0_0_6px_rgba(245,158,11,0.5)]">>> JOUEURS ENGAGÉS <<</h1>
                            <p class="text-lg md:text-4xl font-pixel text-white tracking-wider">
                                ${cleanTeam}
                            </p>
                        </div>
                    </section>
                `;
            }
        }

        // --- GÉNÉRATION DU RÉSULTAT FINAL (S'enclenche uniquement sur la dernière ligne) ---
        if (isLastRow) {
            // Récupère le texte de la dernière ligne, peu importe où il est écrit
            let finalRankText = r0 || row.find(c => c.trim() !== "") || "";

            if (finalRankText && finalRankText.trim() !== "") {
                let colorVar = tournamentWon ? "var(--pixel-green)" : (tournamentOver ? "var(--pixel-red)" : "var(--pixel-green)");
                let bgColor = tournamentWon ? "rgba(100, 255, 218, 0.05)" : (tournamentOver ? "rgba(229, 57, 53, 0.05)" : "rgba(100, 255, 218, 0.05)");

                if (has(finalRankText, "WIN") || has(finalRankText, "1ER") || has(finalRankText, "GAGNÉ") || has(finalRankText, "OUI") || has(finalRankText, "TOP 1")) {
                    colorVar = "var(--pixel-green)";
                    bgColor = "rgba(100, 255, 218, 0.05)";
                }

                finalRankHtml = `
                    <section class="mt-6 md:mt-12 mb-10 md:mb-16 flex justify-center w-full px-2 md:px-0" aria-labelledby="final-rank-title">
                        <div class="pixel-card border-2 px-4 py-5 md:px-10 md:p-13 w-full max-w-[720px]" style="border-color: ${colorVar}; text-align: center; background: ${bgColor};">
                            <h2 id="final-rank-title" class="text-slate-400 font-text text-lg md:text-3xl mb-1 tracking-widest">RÉSULTAT FINAL</h2>
                            <p class="text-2xl md:text-6xl font-pixel tracking-widest" style="color: ${colorVar}; text-shadow: 3px 3px 0px rgba(0,0,0,0.5);">${finalRankText}</p>
                        </div>
                    </section>`;
            }
        }

        // --- PHASE DE SEEDING ---
        else if (has(r0, "PHASE DE SEEDING")) {
            let games = [];
            let seedingScore = "";
            let j = i + 1;
            while (j < data.length && !has(data[j][0], "PHASE DE KNOCKOUT")) {
                // SÉCURITÉ : Ne jamais lire la dernière ligne comme faisant partie de la phase
                if (j === lastValidRowIndex) break;

                let subRow = data[j];
                if (subRow[0] && !has(subRow[0], "JEUX")) {
                    games.push({ name: subRow[0], place: subRow[3], heure: subRow[9] || subRow[10] || '' });
                }
                let seedIdx = subRow.findIndex(c => has(c, ">> SEEDING"));
                if (seedIdx !== -1) {
                    let vals = subRow.slice(seedIdx + 1).filter(v => v.trim() !== "");
                    seedingScore = vals[0] || "";
                }
                j++;
            }

            if (seedingScore && seedingScore.trim() !== "" && !seedingScore.toUpperCase().includes("EN ATTENTE")) {
                seedingFinished = true;
            }

            let gamesHtml = games.map((g, idx) => {
                let rowBg = idx % 2 === 0 ? "bg-[#18181b]" : "bg-[#27272a]/50";
                return `
                <div class="grid grid-cols-4 text-center items-stretch border-b border-black/50 last:border-0 hover:bg-white/5 transition-colors ${rowBg}">
                    <div class="col-span-2 font-pixel text-slate-200 text-[10px] md:text-lg lg:text-2xl uppercase py-1.5 md:py-3 px-1 flex items-center justify-center">${g.name}</div>
                    <div class="col-span-2 font-text text-sm md:text-xl lg:text-2xl ${g.place === '???' ? 'text-slate-600' : 'text-white'} py-1.5 md:py-3 px-1 flex items-center justify-center border-l border-[#27272a]/50">${g.place || '???'}</div>
                </div>
            `}).join('');

            seedingHtml = `
                <section class="pixel-card mt-6 mx-2 md:mx-0" aria-labelledby="seeding-title">
                    <header class="pixel-header-orange px-2.5 py-3 md:px-4 md:p-5 flex flex-col justify-center items-center text-center relative">
                        <div class="text-slate-300 font-text text-sm md:text-xl mb-1 tracking-widest">RÉSULTATS DE LA</div>
                        <h2 id="seeding-title" class="font-pixel text-lg md:text-3xl tracking-widest" style="color: var(--pixel-orange);">PHASE DE SEEDING</h2>
                    </header>
                    <div class="p-2 md:p-0">
                        <p class="md:hidden text-center text-slate-500 font-text text-sm mb-2 animate-pulse mt-2">👉 Glissez pour voir plus</p>
                        <div class="w-full overflow-x-auto pb-2">
                            <div class="min-w-[500px]">
                                <div class="grid grid-cols-4 font-pixel text-[10px] md:text-sm text-slate-500 p-1.5 md:p-3 text-center bg-[#09090b] border-b border-[#27272a]">
                                    <div class="col-span-2">JEUX</div>
                                    <div class="col-span-2">PLACE</div>
                                </div>
                                <div class="bg-[#0f0f13]">${gamesHtml}</div>
                            </div>
                        </div>
                    </div>
                    ${seedingScore ? `
                    <div class="flex border-t-[3px] border-[#27272a] mt-auto flex-col md:flex-row">
                        <div class="bg-[#18181b] flex-1 p-2.5 md:p-3 flex items-center justify-center">
                            <span class="font-text text-base md:text-2xl text-slate-400">SEED FINALE</span>
                        </div>
                        <div class="flex-1 p-2.5 md:p-3 flex items-center justify-center md:border-l-[3px] border-t-[3px] md:border-t-0 border-[#27272a]" style="background: ${seedingScore.toUpperCase().includes('EN ATTENTE') ? 'rgba(255, 255, 255, 0.05)' : 'rgba(245, 158, 11, 0.1)'};">
                            <span class="font-pixel text-xl md:text-5xl" style="color: ${seedingScore.toUpperCase().includes('EN ATTENTE') ? '#94a3b8' : 'var(--pixel-orange)'};">${seedingScore}</span>
                        </div>
                    </div>` : ''}
                </section>
            `;
            i = j - 1;
        }

        // --- PHASE DE KNOCKOUT ---
        else if (has(r0, "PHASE DE KNOCKOUT")) {
            if (!seedingFinished) {
                let j = i + 1;
                while (j < data.length && !isGroupPhase(String(data[j][0]))) { j++; }
                i = j - 1;
                continue;
            }

            let games = [];
            let qualifKnockout = "";
            let qualifKnockoutScore = "";
            let j = i + 1;

            while (j < data.length && !isGroupPhase(String(data[j][0]))) {
                // SÉCURITÉ : Ne jamais lire la dernière ligne comme faisant partie de la phase
                if (j === lastValidRowIndex) break;

                let subRow = data[j];

                let qualifIdx = subRow.findIndex(c => has(c, "QUALIFIÉ"));
                if (qualifIdx !== -1) {
                    let vals = subRow.slice(qualifIdx + 1).filter(v => v.trim() !== "");
                    qualifKnockout = vals[0] || "";
                    qualifKnockoutScore = vals[1] || "";

                    let statusUpper = qualifKnockout.trim().toUpperCase();
                    let isOui = statusUpper === "OUI" || statusUpper === "WIN";
                    let isAttente = statusUpper.includes("EN ATTENTE");

                    if (!isOui && !isAttente && statusUpper !== "") {
                        tournamentOver = true;
                    }
                } else if (subRow[0] && !has(subRow[0], "JEUX") && !has(subRow[0], "PHASE")) {
                    games.push({
                        name: subRow[0],
                        contre: subRow[3] || '',
                        score: [subRow[5] || ''],
                        resultat: subRow[6] || '',
                        vies: subRow[7] || '',
                    });
                } else if (!subRow[0] && (subRow[6] || subRow[5]) && games.length > 0) {
                    games[games.length - 1].score.push(subRow[6] || subRow[5]);
                }
                j++;
            }

            if (qualifKnockout && qualifKnockout.trim() !== "" && !qualifKnockout.toUpperCase().includes("EN ATTENTE")) {
                knockoutFinished = true;
            }

            let gamesHtml = games.map((g, idx) => {
                let resColor = "text-slate-500";
                if (has(g.resultat, "GAGNÉ") || has(g.resultat, "VICTOIRE")) {
                    resColor = "text-[var(--pixel-green)]";
                } else if (has(g.resultat, "PERDU") || has(g.resultat, "DÉFAITE") || has(g.resultat, "NON")) {
                    resColor = "text-[var(--pixel-red)]";
                } else if (has(g.resultat, "TOP")) {
                    resColor = "text-white";
                }

                let scoresHtml = g.score.map(s => `<div>${s}</div>`).join('');
                let rowBg = idx % 2 === 0 ? "bg-[#18181b]" : "bg-[#27272a]/50";

                let viesDisplay = g.vies;
                let numVies = parseInt(g.vies);
                if (!isNaN(numVies) && numVies > 0 && numVies <= 10) {
                    let hearts = [];
                    for (let h = 0; h < numVies; h++) {
                        hearts.push(`<span style="color: var(--pixel-red);">♥</span>`);
                    }
                    viesDisplay = `<div class="flex gap-1 justify-center flex-wrap font-text text-xs md:text-xl" style="text-shadow: 1.5px 1.5px 0px rgba(0,0,0,0.8);">${hearts.join('')}</div>`;
                } else if (numVies === 0) {
                    viesDisplay = `<span class="font-pixel text-slate-600 text-sm md:text-lg">X</span>`;
                } else if (!g.vies || g.vies.trim() === "") {
                    viesDisplay = `<span class="text-slate-700">-</span>`;
                }

                let choixColor = "text-slate-500";
                let choixText = (g.choix || "").toUpperCase();
                if (choixText === "OUI" || choixText.includes("CHOISI")) choixColor = "text-[var(--pixel-green)]";
                else if (choixText === "NON" || choixText.includes("BAN")) choixColor = "text-[var(--pixel-red)]";
                else if (choixText !== "") choixColor = "text-white";

                return `
                <div class="grid grid-cols-12 text-[10px] text-center border-b border-black/50 last:border-0 hover:bg-white/5 items-stretch ${rowBg}">
                    <div class="col-span-3 font-pixel text-slate-100 text-[9px] md:text-lg lg:text-2xl px-1 py-1.5 md:py-3 flex items-center justify-center uppercase">${g.name}</div>
                    <div class="col-span-3 font-text text-[10px] md:text-lg lg:text-xl text-slate-400 px-1 py-1.5 md:py-3 flex items-center justify-center border-l border-[#27272a]/50">${g.contre}</div>
                    <div class="col-span-3 font-text text-[10px] md:text-xl lg:text-2xl text-white px-1 py-1.5 md:py-3 flex flex-col justify-center gap-0.5 border-l border-[#27272a]/50">${scoresHtml}</div>
                    <div class="col-span-2 font-pixel text-[7px] md:text-sm lg:text-lg ${resColor} px-1 py-1.5 md:py-3 flex items-center justify-center uppercase border-l border-[#27272a]/50">${g.resultat}</div>
                    <div class="col-span-1 py-1.5 md:py-3 flex justify-center items-center border-l border-[#27272a]">${viesDisplay}</div>
                </div>
                `;
            }).join('');

            let qualifHtml = "";
            if (qualifKnockout) {
                let statusUpper = qualifKnockout.trim().toUpperCase();
                let isOui = statusUpper === "OUI" || statusUpper === "WIN";
                let isAttente = statusUpper.includes("EN ATTENTE");

                let bgRight = isOui ? "rgba(100, 255, 218, 0.1)" : (isAttente ? "rgba(255, 255, 255, 0.05)" : "rgba(229, 57, 53, 0.1)");
                let textRight = isOui ? "var(--pixel-green)" : (isAttente ? "#94a3b8" : "var(--pixel-red)");
                qualifHtml = `
                    <div class="flex border-t-[3px] border-[#27272a] mt-auto flex-col md:flex-row">
                        <div class="bg-[#18181b] flex-1 p-2.5 md:p-3 flex items-center justify-center">
                            <span class="font-text text-base md:text-2xl text-slate-400">QUALIFIÉ ?</span>
                        </div>
                        <div class="flex-1 p-2.5 md:p-3 flex items-center justify-center md:border-l-[3px] border-t-[3px] md:border-t-0 border-[#27272a]" style="background: ${bgRight};">
                            <span class="font-pixel text-xl md:text-5xl" style="color: ${textRight};">${qualifKnockout}</span>
                        </div>
                        ${qualifKnockoutScore ? `
                        <div class="bg-[#09090b] w-full md:w-[30%] p-2.5 md:p-3 flex items-center justify-center border-t-[3px] md:border-t-0 md:border-l-[3px] border-[#27272a]">
                            <span class="font-pixel text-base md:text-2xl" style="color: var(--pixel-green);">${qualifKnockoutScore}</span>
                        </div>
                        ` : ''}
                    </div>
                `;
            }

            knockoutHtml = `
                <section class="pixel-card mt-6 md:mt-10 mx-2 md:mx-0" aria-labelledby="knockout-title">
                    <header class="pixel-header-green px-3 py-4 md:px-5 md:p-6 flex flex-col justify-center items-center text-center relative">
                        <div class="text-slate-300 font-text text-base md:text-xl mb-1 tracking-widest">RÉSULTATS DE LA</div>
                        <h2 id="knockout-title" class="font-pixel text-lg md:text-3xl tracking-widest" style="color: var(--pixel-green);">PHASE DE KNOCKOUT</h2>
                    </header>
                    <div class="p-2 md:p-0">
                        <p class="md:hidden text-center text-slate-500 font-text text-sm mb-2 animate-pulse mt-2">👉 Glissez pour voir plus</p>
                        <div class="w-full overflow-x-auto pb-2">
                            <div class="min-w-[800px]">
                                <div class="grid grid-cols-12 font-pixel text-[10px] md:text-sm text-slate-500 p-1.5 md:p-3 text-center bg-[#09090b] border-b border-[#27272a]">
                                    <div class="col-span-3">JEUX</div>
                                    <div class="col-span-3">CONTRE QUI ?</div>
                                    <div class="col-span-3">SCORE</div>
                                    <div class="col-span-2">RÉSULTATS</div>
                                    <div class="col-span-1">VIES</div>
                                </div>
                                <div class="bg-[#0f0f13]">${gamesHtml}</div>
                            </div>
                        </div>
                    </div>
                    ${qualifHtml}
                </section>
            `;
            i = j - 1;
        }

        // --- GROUPES & FINALES ---
        else if (isGroupPhase(row)) {
            if (!knockoutFinished || !groupFinished) {
                let j = i + 1;
                while (j < data.length && !isGroupPhase(data[j])) { j++; }
                i = j - 1;
                continue;
            }

            let groupTitle = row.find(c => isGroupPhase(c)) || row[0];
            let teamsTitle = "";
            let teams = "";
            let games = [];
            let qualifStatus = "";
            let qualifStatusScore = "";

            let j = i + 1;
            while (j < data.length && !isGroupPhase(data[j])) {
                // SÉCURITÉ : Ne jamais lire la dernière ligne comme faisant partie de la phase
                if (j === lastValidRowIndex) break;

                let subRow = data[j];

                let qualifIdx = subRow.findIndex(c => has(c, "QUALIFIÉ") || has(c, "WIN"));
                if (qualifIdx !== -1) {
                    let vals = subRow.slice(qualifIdx + 1).filter(v => v.trim() !== "");
                    qualifStatus = vals[0] || "";
                    qualifStatusScore = vals[1] || "";

                    let statusUpper = qualifStatus.trim().toUpperCase();
                    let isOui = statusUpper === "OUI" || statusUpper === "WIN";
                    let isAttente = statusUpper.includes("EN ATTENTE");

                    if (has(groupTitle, "PHASE FINALE") && isOui) {
                        tournamentOver = true;
                        tournamentWon = true;
                    } else if (!isOui && !isAttente && statusUpper !== "") {
                        tournamentOver = true;
                    }

                } else if (subRow.some(c => has(c, "TEAMS PRÉSENTES"))) {
                    teamsTitle = subRow.find(c => has(c, "TEAMS PRÉSENTES"));
                    // On cherche si les teams sont sur la même ligne
                    let potentialTeams = subRow.find(c => c.trim() !== "" && !has(c, "TEAMS PRÉSENTES"));
                    if (potentialTeams) teams = potentialTeams;
                } else if (subRow[0] && !has(subRow[0], "JEUX") && !has(subRow[0], "PHASE")) {
                    if (games.length === 0 && !teams) {
                        teams = subRow[0];
                    } else {
                        // SÉCURITÉ : On n'ajoute que si la ligne contient des résultats ou n'est pas une liste de noms
                        let hasResult = (subRow[4] && subRow[4].trim() !== "") || (subRow[7] && subRow[7].trim() !== "");
                        // Une ligne est considérée comme une liste d'équipes si elle contient des séparateurs et qu'elle est longue
                        let isTeamList = (subRow[0].includes(" - ") || subRow[0].includes(" & ")) && subRow[0].length > 20;
                        
                        if (hasResult || (!isTeamList && subRow[0].length < 50)) {
                            games.push({
                                name: subRow[0],
                                placeJeu: subRow[4] || subRow[3] || '',
                                place: subRow[7] || subRow[6] || '',
                                heure: subRow[8] || subRow[9] || ''
                            });
                        }
                    }
                }
                j++;
            }

            let isFinale = has(groupTitle, "PHASE FINALE");
            let isPhaseA = has(groupTitle, "PHASE A"); // Couvre "PHASE À" et "PHASE A"
            let headerClass = "pixel-header-blue";
            let titleColor = "var(--pixel-blue)";
            if (isFinale) {
                headerClass = "pixel-header-violet";
                titleColor = "var(--pixel-violet)";
            } else if (isPhaseA) {
                headerClass = "pixel-header-red";
                titleColor = "var(--pixel-red)";
            }

            let gamesHtml = games.map((g, idx) => {
                let rowBg = idx % 2 === 0 ? "bg-[#18181b]" : "bg-[#27272a]/50";

                let resultText = isFinale ? (g.placeJeu || g.place) : g.place;
                let placeColor = titleColor;
                if (has(resultText, "EN ATTENTE")) placeColor = "#94a3b8";
                else if (has(resultText, "GAGNÉ") || has(resultText, "VICTOIRE")) placeColor = "var(--pixel-green)";
                else if (has(resultText, "PERDU") || has(resultText, "DÉFAITE")) placeColor = "var(--pixel-red)";
                else if (has(resultText, "NON JOUÉ")) placeColor = "#64748b";

                if (isFinale) {
                    return `
                    <div class="grid grid-cols-12 gap-0 items-stretch border-b border-black/50 last:border-0 hover:bg-white/5 transition-colors ${rowBg}">
                        <div class="col-span-8 font-pixel text-slate-100 text-[10px] md:text-lg lg:text-2xl uppercase px-1 py-1.5 md:py-3 flex items-center justify-center text-center" title="${g.name}">${g.name}</div>
                        <div class="col-span-4 font-pixel text-[10px] md:text-lg lg:text-2xl py-1.5 md:py-3 px-1 flex items-center justify-center border-l border-[#27272a]" style="color: ${placeColor};">${resultText}</div>
                    </div>
                    `;
                } else {
                    return `
                    <div class="grid grid-cols-12 gap-0 items-stretch border-b border-black/50 last:border-0 hover:bg-white/5 transition-colors ${rowBg}">
                        <div class="col-span-4 font-pixel text-slate-100 text-[10px] md:text-lg lg:text-2xl uppercase px-1 py-1.5 md:py-3 flex items-center justify-center text-center" title="${g.name}">${g.name}</div>
                        <div class="col-span-4 font-text text-[10px] md:text-lg lg:text-xl text-slate-400 py-1.5 md:py-3 px-1 flex items-center justify-center border-l border-[#27272a]">${g.placeJeu}</div>
                        <div class="col-span-4 font-pixel text-[10px] md:text-lg lg:text-xl py-1.5 md:py-3 px-1 flex items-center justify-center border-l border-[#27272a]" style="color: ${placeColor};">${g.place}</div>
                    </div>
                    `;
                }
            }).join('');

            let qualifHtml = "";
            if (qualifStatus) {
                let statusUpper = qualifStatus.trim().toUpperCase();
                let isOui = statusUpper === "OUI" || statusUpper === "WIN";
                let isAttente = statusUpper.includes("EN ATTENTE");

                let bgRight = isOui ? "rgba(100, 255, 218, 0.1)" : (isAttente ? "rgba(255, 255, 255, 0.05)" : "rgba(229, 57, 53, 0.1)");
                let textRight = isOui ? "var(--pixel-green)" : (isAttente ? "#94a3b8" : "var(--pixel-red)");
                let qualifLabel = has(groupTitle, "PHASE FINALE") ? "WIN ?" : "QUALIFIÉ ?";
                qualifHtml = `
                    <div class="flex border-t-[3px] border-[#27272a] mt-auto flex-col md:flex-row">
                        <div class="bg-[#18181b] flex-1 p-2.5 md:p-3 flex items-center justify-center">
                            <span class="font-text text-base md:text-2xl text-slate-400">${qualifLabel}</span>
                        </div>
                        <div class="flex-1 p-2.5 md:p-3 flex items-center justify-center md:border-l-[3px] border-t-[3px] md:border-t-0 border-[#27272a]" style="background: ${bgRight};">
                            <span class="font-pixel text-xl md:text-5xl" style="color: ${textRight};">${qualifStatus}</span>
                        </div>
                        ${qualifStatusScore ? `
                        <div class="bg-[#09090b] w-full md:w-[30%] p-2.5 md:p-3 flex items-center justify-center border-t-[3px] md:border-t-0 md:border-l-[3px] border-[#27272a]">
                            <span class="font-pixel text-base md:text-2xl" style="color: ${titleColor};">${qualifStatusScore}</span>
                        </div>
                        ` : ''}
                    </div>
                `;
            }

            let headerBlock = "";
            if (teamsTitle || teams) {
                headerBlock = `
                    ${teamsTitle ? `
                    <div class="bg-[rgba(88,101,242,0.15)] p-2 md:p-3 text-center font-text text-base md:text-2xl text-slate-300 border-b border-[#27272a]">
                        ${teamsTitle}
                    </div>
                    ` : ''}
                    ${teams ? `
                    <div class="bg-[rgba(245,158,11,0.15)] p-2 md:p-4 text-center font-pixel text-sm md:text-xl text-[var(--pixel-orange)] border-b-2 border-[#27272a]">
                        ${teams}
                    </div>
                    ` : ''}
                `;
            }

            groupCardsHtml += `
                <article class="pixel-card mt-6 md:mt-10 flex flex-col h-full mx-2 md:mx-0" aria-labelledby="group-title-${i}">
                    <header class="${headerClass} px-3 py-4 md:px-5 md:p-6 flex flex-col justify-center items-center text-center relative">
                        <div class="text-slate-300 font-text text-base md:text-xl mb-1 tracking-widest">RÉSULTATS DE LA</div>
                        <h2 id="group-title-${i}" class="font-pixel text-lg md:text-3xl tracking-widest" style="color: ${titleColor};">${groupTitle}</h2>
                    </header>
                    ${headerBlock}
                    <div class="flex-grow bg-[#0f0f13] p-2 md:p-0 border-t border-[#27272a] md:border-0">
                        <p class="md:hidden text-center text-slate-500 font-text text-sm mb-2 animate-pulse mt-2">👉 Glissez pour voir plus</p>
                        <div class="w-full overflow-x-auto pb-2">
                            <div class="min-w-[600px]">
                                <div class="grid grid-cols-12 gap-0 font-pixel text-[10px] md:text-sm text-slate-500 p-1.5 md:p-2 text-center bg-[#09090b] border-b border-[#27272a]">
                                    ${isFinale ? `
                                    <div class="col-span-8">JEUX</div>
                                    <div class="col-span-4">RÉSULTATS</div>
                                    ` : `
                                    <div class="col-span-4">JEUX</div>
                                    <div class="col-span-4">RÉSULTATS DU JEU</div>
                                    <div class="col-span-4">PLACE</div>
                                    `}
                                </div>
                                ${gamesHtml || '<div class="p-6 md:p-8 text-center text-slate-600 font-text text-lg md:text-2xl pt-8 md:pt-10">EN ATTENTE...</div>'}
                            </div>
                        </div>
                    </div>
                    ${qualifHtml}
                </article>
            `;

            if (qualifStatus && qualifStatus.trim() !== "" && !qualifStatus.toUpperCase().includes("EN ATTENTE")) {
                groupFinished = true;
            } else {
                groupFinished = false;
            }

            i = j - 1;
        }
    }

    let fullHtml = teamNameHtml + seedingHtml + knockoutHtml;
    if (groupCardsHtml) {
        fullHtml += `<div>${groupCardsHtml}</div>`;
    }
    if (finalRankHtml) {
        fullHtml += finalRankHtml;
    }

    const container = document.getElementById('dashboard-container');
    if (container.innerHTML !== fullHtml && fullHtml.trim() !== "") {
        container.innerHTML = fullHtml;
    }

    const status = document.getElementById('status');
    status.innerHTML = `<span class="w-2.5 h-2.5 bg-[var(--pixel-green)] shadow-[0_0_8px_rgba(100,255,218,1)]"></span> <span style="color: var(--pixel-green)">SYNC OK</span>`;
    status.className = "font-text text-lg md:text-xl flex items-center justify-center gap-2 mt-1 md:mt-0 w-full md:w-auto";
}

setTimeout(init, 2000);

// La vérification Twitch Live a été désactivée pour la page d'archive.