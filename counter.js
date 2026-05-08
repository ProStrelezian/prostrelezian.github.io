document.addEventListener('DOMContentLoaded', () => {
    // Compteur de passage
    const secretBtn = document.getElementById('strelezian-secret');
    const counterSpan = document.getElementById('visit-counter');
    const countVal = document.getElementById('visit-count');

    if (secretBtn && counterSpan && countVal) {
        const isVisited = localStorage.getItem('zlan_visited');
        const baseUrl = 'https://api.counterapi.dev/v1/zlan_strelezian/visits';

        const getCounter = async (increment) => {
            const url = increment ? `${baseUrl}/up` : baseUrl;
            try {
                let res = await fetch(url);
                
                // Si l'API retourne 404 (compteur expiré ou purgé côté serveur), on force sa recréation
                if (res.status === 404 && !increment) {
                    res = await fetch(`${baseUrl}/up`);
                }
                
                if (!res.ok) throw new Error(`Erreur API: ${res.status}`);
                
                const data = await res.json();
                const count = data.count !== undefined ? data.count : data.value;
                
                if (count !== undefined) {
                    countVal.textContent = count;
                    localStorage.setItem('zlan_visited', 'true');
                } else {
                    countVal.textContent = "N/A";
                }
            } catch (err) {
                console.error('Erreur compteur:', err);
                // En cas de vrai pépin réseau ou de blocage par un Adblocker (uBlock Origin, Brave...)
                countVal.textContent = "N/A";
            }
        };

        getCounter(!isVisited);

        secretBtn.addEventListener('click', () => {
            counterSpan.classList.toggle('hidden');
        });
    }
});