document.addEventListener('DOMContentLoaded', () => {
    // Compteur de passage
    const secretBtn = document.getElementById('strelezian-secret');
    const counterSpan = document.getElementById('visit-counter');
    const countVal = document.getElementById('visit-count');

    if (secretBtn && counterSpan && countVal) {
        const isVisited = localStorage.getItem('zlan_visited');
        const url = isVisited 
            ? 'https://api.counterapi.dev/v1/zlan_strelezian/visits' 
            : 'https://api.counterapi.dev/v1/zlan_strelezian/visits/up';

        fetch(url)
            .then(res => {
                if (!res.ok) throw new Error('Erreur réseau API');
                return res.json();
            })
            .then(data => {
                // Gère count ou value au cas où l'API change son format
                const count = data.count !== undefined ? data.count : data.value;
                if(count !== undefined) {
                    countVal.textContent = count;
                    localStorage.setItem('zlan_visited', 'true');
                } else {
                    countVal.textContent = "N/A";
                }
            })
            .catch(err => {
                console.error('Erreur compteur:', err);
                countVal.textContent = "ERR";
            });

        secretBtn.addEventListener('click', () => {
            counterSpan.classList.toggle('hidden');
        });
    }
});