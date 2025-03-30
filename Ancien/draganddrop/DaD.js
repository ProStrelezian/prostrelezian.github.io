/* Gestion du Drag and Drop */

var element=null; // Variable globale de stockage de l'élément drag
var source=null;  // Variable globale de stockage de la zone d'éléments

document.addEventListener("readystatechange", function(evt) {
    if (document.readyState=="interactive") {
        /* Parcourir tous les éléments qui peuvent être dragé" */
        var drags=document.querySelectorAll("div.dragdrop");
        for (var i=0; i < drags.length; i++) {
            var d=drags[i];
            d.addEventListener("drag", function(evt) {
                /* Mise à jour du style de l'élément de départ */
                evt.currentTarget.style.border="2px dashed #aaa";
                evt.currentTarget.style.color="fff";
                evt.currentTarget.style.backgroundColor="#fff";
            });

            d.addEventListener("dragstart", function(evt) {
                /* Mise à jour du style de l'élément qui suit la souris */
                evt.currentTarget.style.backgroundColor="#6f6";
                // Sauvegarde dans les variables globales
                element=evt.currentTarget;
                source=evt.currentTarget.parentNode;
            });
            d.addEventListener("dragend", function(evt) {
                /* Retour à la normale en fin de drag and drop */
                evt.currentTarget.style.border="2px solid #333";
                evt.currentTarget.style.color="#000";
                element=null;
                source=null;
            });
        }

        /* Evénements dragover indispensables pour que l'event drop soit actif */
        var container=document.getElementById("container");
        var origine=document.getElementById("origine");
        container.addEventListener("dragover", function(evt) {
            event.preventDefault(); /* Pour autoriser le drop par JS */
        });
        origine.addEventListener("dragover", function(evt) {
            event.preventDefault();
        });

        /* Passage des activités de origine vers container */
        container.addEventListener("dragenter", function(evt) {
            if (source!==origine) {return false;}
            this.className="onDropZone"; /* container passe en surbrillance */
        });
        container.addEventListener("dragleave", function(evt) {
            if (source!==origine) {return false;}
            console.log(evt.path);
            if (evt.target.className=="dragdrop") { return false;}
            if (evt.relatedTarget.className=="dragdrop") { return false;}
            this.className=""; /* La surbrillance s'efface */
        });
        container.addEventListener("drop", function(evt) {
            if (source!==origine) {return false;}
            this.className="";
            this.appendChild(element); /* Déplacement de l'élément vers container */
            element=null;
            source=null;
        });

        /* Retour des activités de container vers origine */
        origine.addEventListener("dragenter", function(evt) {
            if (source!==container) {return false;}
            origine.className="onDropZone"; /* Origine passe en surbrillance */
        });
        origine.addEventListener("dragleave", function(evt) {
            if (source!==container) {return false;}
            if (evt.target.className=="dragdrop") { return false;}
            if (evt.relatedTarget.className=="dragdrop") { return false;}
            origine.className="";
        });
        origine.addEventListener("drop", function(evt) {
            if (source!==container) {return false;}
            this.className="";
            this.appendChild(element); /* Déplacement de l'élément vers origine */
            element=null;
            source=null;
        });
    }
});

/* Fonction qui retourne le tableau des activités retenues dans div#container */
function getActivites() {
    var container=document.getElementById("container");
    var activites=[];
    var elts=container.getElementsByClassName("dragdrop");

    var good_count = 0;  /*Calcul des bonnes réponses*/
    var total_count = 0; /*Total des réponses*/
    const wrong_rep = ['DN1', 'DN2', 'DN3','PN1','PN2','PN3','EN1','EN2']; /* Identifiants des mauvaises réponses */
    
    
    
    for (var i=0; i < elts.length; i++) {
        good_count += 1;
        total_count += 1;
        if (wrong_rep.includes(elts[i].dataset.id)) {
            activites.push(elts[i].innerHTML);
            good_count -= 1;
        }
    }

    if (total_count == 0) {
        return "Vous n'avez pas encore répondu !"
    } else {
        return 'Nombre de bonne(s) réponse(s) : ' + good_count + '/' + total_count + ' - Mauvaise(s) réponse(s) : ' + activites;
    };
}

/* Fonction qui met en avant les résultats */ 

function resultats() {
    rep = document.getElementById("reponses")
    console.log(getActivites())
    rep.innerHTML = getActivites();
}

/* Bloc du progress bar */

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
