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