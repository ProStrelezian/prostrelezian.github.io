// Bloc du progress bar
const progressBar = document.querySelector('.progress_bar');
progressBar.style.display = "none";

window.addEventListener('scroll', handleScroll);

function handleScroll() {
    progressBar.style.display = "block";
    const height = document.body.scrollHeight; // taille du site
    const windowHeight = window.innerHeight; // taille de l'affichage
    const position = window.scrollY; // la position en pixels du document
    
    const trackLength = height - windowHeight; // taille du site - la partie affichée sur l'écran en ce moment (exemple : 1000px)
    
    const percentage = 
          Math.floor((position / trackLength) * 100); // pourcentage du site déjà parcouru
    
    progressBar
        .style.right = 100 - percentage + '%';
  }


/* Chart pour les langues */

function chart_langue() {
  const ctx = document.getElementById('chartlangues');
      
  new Chart(ctx, {
      type: 'bar', // Diagramme avec des barres
      data: {
            labels: ['Français', 'Anglais', 'Japonais', 'Espagnol'],
            datasets: [{
              label: 'Score /1000',
              data: [1000, 750, 230, 260],
              backgroundColor: [
                'rgba(255, 99, 132, 0.2)',
                'rgba(255, 159, 64, 0.2)',
                'rgba(255, 205, 86, 0.2)',
                'rgba(75, 192, 192, 0.2)'],
              borderWidth: 2
            }]
          },
          options: {
            indexAxis: 'y', // Option pour mettre les barres horizontales
            scales: {
              y: {
                beginAtZero: true // pour commencer à 0
              },
            }
          }
  });
}

chart_langue()

/* Changement d'identité de la page */

function idpage(){
  var nomid1 = document.getElementById("identity");
  var nomid2 = document.getElementById("progress_bar");
  var nomid3 = document.getElementById("end_page");
  

  let s;
  let confirm = window.confirm("Veux-tu changer l'identité de celui qui as fait la page ?");


  if (confirm == true) {
      
      s = prompt("Quelle est la nouvelle identité de la personne sur cette page ?");
  } else {
      window.alert("Dommage !")
  }

  nomid1.textContent = s;
  nomid2.textContent = '@Tous domaines réservés - Copyright 2024 - ' + s;
  nomid3.textContent = '© 2024 ' + s;
  document.title = s + ' - CV';
  console.log('Cette page appartient désormais à ' + s + '!')
};
