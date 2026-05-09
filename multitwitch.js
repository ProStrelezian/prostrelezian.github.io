// Use Module Pattern to encapsulate logic and optimize performance
const MultitwitchApp = (function () {
    const state = {
        channels: { 1: '', 2: '', 3: '', 4: '', 5: '', 6: '' },
        players: {},
        draggedSlot: null,
        maxSlots: 6,
        activeChatTab: null,
        focusedSlot: null,
        visualOrder: { 1: 10, 2: 20, 3: 30, 4: 40, 5: 50, 6: 60 }
    };

    const DOM = {}; // Cached DOM nodes
    const SLOTS = {}; // Cached per-slot nodes

    function loadTwitchAPI() {
        return new Promise((resolve, reject) => {
            if (window.Twitch) {
                resolve(window.Twitch);
                return;
            }
            const script = document.createElement('script');
            script.src = 'https://player.twitch.tv/js/embed/v1.js';
            script.async = true;
            script.onload = () => resolve(window.Twitch);
            script.onerror = () => reject(new Error('Failed to load Twitch API'));
            document.head.appendChild(script);
        });
    }

    function initResizeObserver() {
        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                const width = entry.contentRect.width;
                const target = entry.target;
                
                target.classList.remove('container-sm', 'container-md', 'container-lg');
                
                if (width >= 650) {
                    target.classList.add('container-lg');
                } else if (width >= 450) {
                    target.classList.add('container-md');
                } else {
                    target.classList.add('container-sm');
                }
            }
        });
        if (DOM.mtVideos) {
            resizeObserver.observe(DOM.mtVideos);
        }
    }

    function initDOM() {
        DOM.mtVideos = document.getElementById('mt-videos');
        DOM.chatIframesContainer = document.getElementById('chat-iframes-container');
        DOM.addInput = document.getElementById('add-stream-input');
        DOM.toggleChatBtn = document.getElementById('toggle-chat-btn');
        DOM.chatTabs = document.querySelectorAll('.chat-tab-btn');
        DOM.streamCards = document.querySelectorAll('.stream-card');
        DOM.fullscreenBtn = document.getElementById('fullscreen-btn');

        for (let i = 1; i <= state.maxSlots; i++) {
            SLOTS[i] = {
                card: document.getElementById(`card-stream-${i}`),
                player: document.getElementById(`player-stream-${i}`),
                title: document.getElementById(`title-stream-${i}`),
                chatBtn: document.querySelector(`.chat-tab-btn[data-target="${i}"]`)
            };
            SLOTS[i].card.style.order = state.visualOrder[i];
            SLOTS[i].card.style.viewTransitionName = `card-${i}`;
            if (SLOTS[i].chatBtn) SLOTS[i].chatBtn.style.order = state.visualOrder[i];
        }
    }

    function bindEvents() {
        document.getElementById('add-stream-btn').addEventListener('click', addStream);
        DOM.addInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addStream();
        });
        
        DOM.toggleChatBtn.addEventListener('click', toggleChat);
        document.getElementById('share-btn').addEventListener('click', shareLayout);
        document.getElementById('reset-btn').addEventListener('click', resetStreams);
        
        document.getElementById('fix-connexion-btn').addEventListener('click', () => {
            window.open('https://www.twitch.tv/login', '_blank', 'width=500,height=600');
        });

        // Event delegation for stream card controls
        document.querySelectorAll('.remove-stream-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const slot = parseInt(e.currentTarget.dataset.slot);
                if (slot) updateStream(slot, '');
            });
        });

        // Focus stream button
        document.querySelectorAll('.focus-stream-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const slot = parseInt(e.currentTarget.dataset.slot);
                toggleFocus(slot);
            });
        });

        // Chat tab switching
        DOM.chatTabs.forEach(btn => {
            btn.addEventListener('click', (e) => {
                switchChat(e.currentTarget.dataset.target);
            });
        });

        // Drag & Drop
        DOM.streamCards.forEach(card => {
            card.addEventListener('dragstart', (e) => {
                state.draggedSlot = parseInt(card.id.split('-').pop());
                e.dataTransfer.effectAllowed = 'move';
                requestAnimationFrame(() => {
                    card.style.opacity = '0.5';
                });
            });
            
            card.addEventListener('dragover', (e) => e.preventDefault());
            
            card.addEventListener('drop', (e) => {
                e.preventDefault();
                const targetSlot = parseInt(card.id.split('-').pop());
                const sourceSlot = state.draggedSlot;
                
                DOM.streamCards.forEach(c => c.style.opacity = '1');
                
                if (sourceSlot === targetSlot || !sourceSlot) return;

                // Télémétrie : Analyse du Drag & Drop
                if (window.plausible) window.plausible('Drag and Drop', { props: { action: 'reorder' } });

                const performSwap = () => {
                    const tempOrder = state.visualOrder[sourceSlot];
                    state.visualOrder[sourceSlot] = state.visualOrder[targetSlot];
                    state.visualOrder[targetSlot] = tempOrder;
                    
                    SLOTS[sourceSlot].card.style.order = state.visualOrder[sourceSlot];
                    SLOTS[targetSlot].card.style.order = state.visualOrder[targetSlot];
                    
                    if (SLOTS[sourceSlot].chatBtn) SLOTS[sourceSlot].chatBtn.style.order = state.visualOrder[sourceSlot];
                    if (SLOTS[targetSlot].chatBtn) SLOTS[targetSlot].chatBtn.style.order = state.visualOrder[targetSlot];
                    
                    updateLayout();
                    syncURL(); // Mettre à jour l'URL avec le nouvel ordre
                };

                if (document.startViewTransition) {
                    document.startViewTransition(() => performSwap());
                } else {
                    performSwap();
                }
            });

            card.addEventListener('dragend', () => {
                DOM.streamCards.forEach(c => c.style.opacity = '1');
            });
        });

        // Mobile menu
        const menuBtn = document.getElementById('mobile-menu-btn');
        const mobileMenu = document.getElementById('mobile-menu');
        const menuIcon = document.getElementById('mobile-menu-icon');
        if (menuBtn && mobileMenu && menuIcon) {
            menuBtn.addEventListener('click', () => {
                mobileMenu.classList.toggle('hidden');
                mobileMenu.classList.toggle('flex');
                if (mobileMenu.classList.contains('hidden')) {
                    menuIcon.setAttribute('d', 'M4 6h16M4 12h16M4 18h16');
                } else {
                    menuIcon.setAttribute('d', 'M6 18L18 6M6 6l12 12');
                }
            });
        }

        // Fullscreen
        if (DOM.fullscreenBtn) {
            DOM.fullscreenBtn.addEventListener('click', () => {
                if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen().catch(() => {});
                } else {
                    document.exitFullscreen();
                }
            });
        }

        document.addEventListener('fullscreenchange', () => {
            const isFs = document.fullscreenElement !== null;
            document.body.classList.toggle('is-fullscreen', isFs);
            document.documentElement.classList.toggle('is-fullscreen', isFs);
            if (DOM.fullscreenBtn) DOM.fullscreenBtn.innerHTML = isFs ? '❌ QUITTER PLEIN ÉCRAN' : '📺 PLEIN ÉCRAN';
        });
    }

    function getTwitchParents() {
        const host = window.location.hostname;
        const hostWithPort = window.location.host;
        const parents = ['localhost', '127.0.0.1', 'strelezian.github.io', 'prostrelezian.github.io', 'zlan.guill.tv'];
        if (host && !parents.includes(host)) parents.push(host);
        if (hostWithPort && hostWithPort.includes(':')) {
            const p = hostWithPort.split(':')[0];
            if (!parents.includes(p)) parents.push(p);
        }
        return parents;
    }

    function updateAudio() {
        let audioSlot = null;
        // 1. Prioritize focused stream
        if (state.focusedSlot && state.channels[state.focusedSlot]) {
            audioSlot = state.focusedSlot;
        } else {
            // 2. Otherwise use the first active stream
            for (let i = 1; i <= state.maxSlots; i++) {
                if (state.channels[i]) {
                    audioSlot = i;
                    break;
                }
            }
        }

        // Apply mute/unmute
        for (let i = 1; i <= state.maxSlots; i++) {
            if (state.players[i]) {
                if (i === audioSlot) {
                    state.players[i].setMuted(false);
                } else {
                    state.players[i].setMuted(true);
                }
            }
        }
    }

    function saveChannels() {
        localStorage.setItem('zlan_mt_channels', JSON.stringify(state.channels));
    }

    function syncURL() {
        const activeStreams = Object.keys(state.channels)
            .filter(slot => state.channels[slot])
            .sort((a, b) => state.visualOrder[a] - state.visualOrder[b])
            .map(slot => state.channels[slot]);
            
        const url = new URL(window.location.href);
        if (activeStreams.length > 0) {
            url.searchParams.set('streams', activeStreams.join(','));
        } else {
            url.searchParams.delete('streams');
        }
        window.history.replaceState({}, document.title, url.toString());
    }

    function updateLayout() {
        if (!DOM.mtVideos) return;
        let activeCount = 0;
        let lowestOrder = Infinity;
        let firstSlot = null;

        for (let i = 1; i <= state.maxSlots; i++) {
            const card = SLOTS[i].card;
            if (card) {
                const isActive = !!state.channels[i];
                if (isActive) {
                    activeCount++;
                    if (state.visualOrder[i] < lowestOrder) {
                        lowestOrder = state.visualOrder[i];
                        firstSlot = i;
                    }
                }
                // Avoid unnecessary reflows by checking first
                if (isActive && card.style.display !== 'flex') card.style.display = 'flex';
                if (!isActive && card.style.display !== 'none') card.style.display = 'none';
                
                card.classList.remove('is-visual-first');
            }
        }
        
        if (firstSlot && SLOTS[firstSlot].card) {
            SLOTS[firstSlot].card.classList.add('is-visual-first');
        }
        
        DOM.mtVideos.classList.remove('layout-0', 'layout-1', 'layout-2', 'layout-3', 'layout-4', 'layout-5', 'layout-6');
        DOM.mtVideos.classList.add(`layout-${activeCount}`);

        if (activeCount < 2 && state.focusedSlot) {
            state.focusedSlot = null;
            renderFocus();
        }
    }

    function toggleFocus(slot) {
        const performFocus = () => {
            if (state.focusedSlot === slot) {
                state.focusedSlot = null;
                if (window.plausible) window.plausible('Focus Mode', { props: { state: 'disabled' } });
            } else {
                state.focusedSlot = slot;
                if (window.plausible) window.plausible('Focus Mode', { props: { state: 'enabled' } });
            }
            renderFocus();
        };

        if (document.startViewTransition) {
            document.startViewTransition(() => performFocus());
        } else {
            performFocus();
        }
    }

    function renderFocus() {
        DOM.mtVideos.classList.remove('has-focus');
        DOM.streamCards.forEach(c => c.classList.remove('is-focused'));

        if (state.focusedSlot && state.channels[state.focusedSlot]) {
            DOM.mtVideos.classList.add('has-focus');
            const activeCard = SLOTS[state.focusedSlot].card;
            if (activeCard) {
                activeCard.classList.add('is-focused');
            }
        }
        
        updateAudio();
    }

    function updateStream(slot, channelName, switchChatToThis = false) {
        const newChannel = channelName ? channelName.trim().toLowerCase() : '';
        const oldChannel = state.channels[slot];

        if (newChannel === oldChannel && state.players[slot]) return;

        const slotDOM = SLOTS[slot];
        let chatIframe = document.getElementById(`iframe-chat-${slot}`);

        const parents = getTwitchParents();
        const parentParams = parents.map(p => `parent=${p}`).join('&');

        if (newChannel) {
            // Embed Player
            if (!state.players[slot] && window.Twitch) {
                state.players[slot] = new Twitch.Player(`player-stream-${slot}`, {
                    channel: newChannel,
                    width: '100%',
                    height: '100%',
                    muted: true,
                    parent: parents
                });
                state.players[slot].addEventListener(Twitch.Player.READY, updateAudio);
            } else if (state.players[slot]) {
                state.players[slot].setChannel(newChannel);
            }

            if (slotDOM.player) slotDOM.player.classList.remove('invisible');

            // Dynamically create or update iframe
            if (!chatIframe) {
                chatIframe = document.createElement('iframe');
                chatIframe.id = `iframe-chat-${slot}`;
                chatIframe.className = 'w-full h-full';
                chatIframe.style.display = 'none';
                chatIframe.setAttribute('frameborder', '0');
                chatIframe.setAttribute('allow', 'autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; storage-access');
                DOM.chatIframesContainer.appendChild(chatIframe);
            }
            
            const newSrc = `https://www.twitch.tv/embed/${newChannel}/chat?${parentParams}&darkpopout`;
            if (chatIframe.src !== newSrc) chatIframe.src = newSrc;

            if (slotDOM.chatBtn) {
                slotDOM.chatBtn.textContent = newChannel.toUpperCase();
                slotDOM.chatBtn.classList.remove('hidden');
            }
            if (slotDOM.title) slotDOM.title.textContent = newChannel.toUpperCase();
        } else {
            // Remove stream
            if (slotDOM.player) {
                slotDOM.player.innerHTML = '';
                slotDOM.player.classList.add('invisible');
            }
            delete state.players[slot];

            if (chatIframe) {
                chatIframe.remove(); // Completely remove to free memory
            }
            
            if (slotDOM.chatBtn) {
                slotDOM.chatBtn.classList.add('hidden');
                if (state.activeChatTab == slot) {
                    // Find next available
                    let nextSlot = Object.keys(state.channels).find(k => state.channels[k] && k != slot);
                    switchChat(nextSlot || null);
                }
            }
            if (slotDOM.title) slotDOM.title.textContent = '';

            if (state.focusedSlot === slot) {
                state.focusedSlot = null;
                renderFocus();
            }
        }

        state.channels[slot] = newChannel;
        saveChannels();
        updateLayout();
        updateAudio();
        syncURL();

        if (newChannel && switchChatToThis) {
            switchChat(slot);
        }
    }

    function switchChat(target) {
        if (state.activeChatTab == target) return;

        const oldTarget = state.activeChatTab;
        state.activeChatTab = target;

        if (oldTarget) {
            const oldIframe = document.getElementById(`iframe-chat-${oldTarget}`);
            if (oldIframe) oldIframe.style.display = 'none';
            
            const oldBtn = SLOTS[oldTarget]?.chatBtn;
            if (oldBtn) {
                oldBtn.classList.remove('text-[var(--pixel-violet)]');
                oldBtn.classList.add('text-slate-500');
            }
        }

        if (target) {
            const iframe = document.getElementById(`iframe-chat-${target}`);
            if (iframe) iframe.style.display = 'block';
            
            const activeBtn = SLOTS[target]?.chatBtn;
            if (activeBtn) {
                activeBtn.classList.remove('text-slate-500');
                activeBtn.classList.add('text-[var(--pixel-violet)]');
                activeBtn.classList.remove('hidden');
            }
        }
    }

    async function addStream() {
        const newChannel = DOM.addInput.value.trim().toLowerCase();
        if (!newChannel) return;

        if (Object.values(state.channels).includes(newChannel)) {
            DOM.addInput.value = '';
            return;
        }

        let emptySlot = null;
        for(let i = 1; i <= state.maxSlots; i++) {
            if(!state.channels[i]) {
                emptySlot = i;
                break;
            }
        }
        
        if (!emptySlot) {
            alert("Vous avez déjà 6 streams actifs !");
            return;
        }

        const btn = document.getElementById('add-stream-btn');
        const oldBtnText = btn.textContent;
        btn.textContent = "VERIF...";
        btn.disabled = true;
        DOM.addInput.disabled = true;

        try {
            const response = await fetch(`https://decapi.me/twitch/id/${newChannel}`);
            const text = await response.text();

            if (text.toLowerCase().includes("user not found") || text.includes("Error:")) {
                alert(`La chaîne Twitch "${newChannel}" n'existe pas.`);
                return;
            }
            
            // Télémétrie : Analyse des chaînes les plus ajoutées
            if (window.plausible) window.plausible('Stream Added', { props: { channel: newChannel } });
            
            updateStream(emptySlot, newChannel, true);
            DOM.addInput.value = '';
        } catch (error) {
            console.error("Erreur lors de la vérification Twitch:", error);
            // En cas d'erreur de l'API tiers, on ajoute quand même par précaution
            updateStream(emptySlot, newChannel, true);
            DOM.addInput.value = '';
        } finally {
            btn.textContent = oldBtnText;
            btn.disabled = false;
            DOM.addInput.disabled = false;
            DOM.addInput.focus();
        }
    }

    function resetStreams() {
        if (confirm("Voulez-vous vraiment réinitialiser les streams pour n'afficher que TheGuill84 et Nykho ?")) {
            const initial = { 1: 'theguill84', 2: 'nykho', 3: '', 4: '', 5: '', 6: '' };
            
            const performReset = () => {
                for (let i = 1; i <= state.maxSlots; i++) {
                    state.visualOrder[i] = i * 10;
                    SLOTS[i].card.style.order = state.visualOrder[i];
                    if (SLOTS[i].chatBtn) SLOTS[i].chatBtn.style.order = state.visualOrder[i];
                    updateStream(i, initial[i], false);
                }
                switchChat(1);
            };

            if (document.startViewTransition) {
                document.startViewTransition(() => performReset());
            } else {
                performReset();
            }
        }
    }

    function shareLayout() {
        const activeStreams = Object.values(state.channels).filter(c => c);
        if (activeStreams.length === 0) {
            alert("Ajoutez au moins un stream !");
            return;
        }
        navigator.clipboard.writeText(window.location.href)
            .then(() => alert("Lien copié !"))
            .catch(() => alert("Erreur de copie : " + window.location.href));
    }

    function toggleChat() {
        const isHidden = document.body.classList.toggle('chat-hidden');
        if (isHidden) {
            DOM.toggleChatBtn.innerHTML = `<svg class="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg> <span>AVEC TCHAT</span>`;
            localStorage.setItem('zlan_mt_chat_hidden', 'true');
        } else {
            DOM.toggleChatBtn.innerHTML = `<svg class="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"></path></svg> <span>SANS TCHAT</span>`;
            localStorage.setItem('zlan_mt_chat_hidden', 'false');
        }
    }

    function initializeApp() {
        initDOM();
        bindEvents();
        initResizeObserver();

        // Load Chat Preferences
        if (localStorage.getItem('zlan_mt_chat_hidden') === 'true') {
            toggleChat(); // Toggles to hidden mode
        }

        // Load initial streams
        const params = new URLSearchParams(window.location.search);
        const urlStreams = params.get('streams');
        let initial = { 1: 'theguill84', 2: 'nykho', 3: '', 4: '', 5: '', 6: '' };

        if (urlStreams) {
            const streamsList = urlStreams.split(',');
            initial = { 1: '', 2: '', 3: '', 4: '', 5: '', 6: '' };
            streamsList.forEach((ch, idx) => { if (idx < 6) initial[idx + 1] = ch; });
            // Do not replace state here, syncURL() inside updateStream will handle it.
        } else {
            const saved = localStorage.getItem('zlan_mt_channels');
            if (saved) {
                try { initial = JSON.parse(saved); } catch (e) {}
            }
        }

        // Initial layout setup required before adding streams
        updateLayout();

        loadTwitchAPI().then(() => {
            let firstActive = null;
            for (let i = 1; i <= state.maxSlots; i++) {
                if (initial[i]) {
                    updateStream(i, initial[i], false);
                    if (!firstActive) firstActive = i;
                }
            }
            if (firstActive) switchChat(firstActive);
        }).catch(err => {
            console.error(err);
            alert("Erreur lors du chargement du lecteur Twitch.");
        });
    }

    return { init: initializeApp };
})();

// Start Application
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', MultitwitchApp.init);
} else {
    MultitwitchApp.init();
}
