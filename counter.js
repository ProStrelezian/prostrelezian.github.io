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
            .then(res => res.json())
            .then(data => {
                if(data && data.count) {
                    countVal.textContent = data.count;
                    localStorage.setItem('zlan_visited', 'true');
                }
            })
            .catch(err => console.error('Erreur compteur:', err));

        secretBtn.addEventListener('click', () => {
            counterSpan.classList.toggle('hidden');
        });
    }
});